import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamText as aiStreamText } from "ai";
import { db } from "@atomcode/database/client";
import { Mode, MessageStatus } from "@atomcode/database/enums";
import { type ChatStreamEvent } from "@atomcode/shared";
import { isSupportedChatModel, resolveChatModel } from "../lib/models";

//确保请求体包含必要字段，并通过自定义 refine 验证模型是否受支持
const submitSchema = z.object({
    content: z.string(),     // 用户输入的内容
    mode: z.enum(Mode),      // 对话模式（来自数据库枚举）
    model: z.string().refine(isSupportedChatModel, "Unsupported model"), // 模型名称验证
});

const submitValidator = zValidator("json", submitSchema, (result, c) => {
    if (!result.success) {
        return c.json({ error: "Invalid request body" }, 400);
    }
});

// 防止同一会话被重复恢复，避免产生冲突的并发请求
const activeResumeSessionIds = new Set<string>();

// 构建对话历史记录 排除 错误消息和 空助手消息
function buildConversationHistory(
    messages: { role: "USER" | "ASSISTANT" | "ERROR"; content: string; status: MessageStatus }[],
) {
    return messages.flatMap((m) => {
        if (m.role === "ERROR") return [];
        if (m.role === "ASSISTANT" && m.content.length === 0) return [];
        return [
            {
                role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
                content: m.content
            },
        ];
    });
};

// 恢复最后一条用户消息，即 AI 还没来得及完整响应的消息
function getResumableUserMessage(
    messages: {
        role: "USER" | "ASSISTANT" | "ERROR";
        model: string;
        mode: Mode
    }[],
) {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "USER") {
        return null;
    }

    return lastMessage;
};


type StreamParams = {
    sessionId: string;
    model: string;
    history: { role: "user" | "assistant"; content: string }[];
    mode: Mode;
    abortController: AbortController;
};

async function streamAIResponse(
    stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
    params: StreamParams,
) {
    const { sessionId, model, history, mode, abortController } = params;
    const startTime = Date.now();
    const resolvedModel = resolveChatModel(model);
    let fullText = "";

    // 持久化中断消息到数据库
    const persistInterruptedMessage = async () => {
        // 没内容就return
        if (fullText.length === 0) return;

        const elapsedMs = Date.now() - startTime;

        await db.message.create({
            data: {
                sessionId,
                role: "ASSISTANT",
                status: MessageStatus.INTERRUPTED,
                model,
                content: fullText,
                mode,
                duration: Math.round(elapsedMs / 1000),
            },
        });
    };

    // stream 输出主流程
    try {
        const result = aiStreamText({
            model: resolvedModel.model,
            messages: history,
            abortSignal: abortController.signal,
        });

        for await (const part of result.fullStream) {
            //// SSE 连接中断时立即停止
            if (stream.aborted) break;

            if (part.type === "text-delta") {
                fullText += part.text;
                const event: ChatStreamEvent = { type: "text-delta", text: part.text };
                await stream.writeSSE({ event: "text-delta", data: JSON.stringify(event) });
            }

            if (part.type === "error") {
                throw part.error;
            }
        }

        if (stream.aborted || abortController.signal.aborted) {
            await persistInterruptedMessage();
            return;
        }


        const elapsedMs = Date.now() - startTime;

        //正常处理流程
        const assistantMessage = await db.message.create({
            data: {
                sessionId,
                role: "ASSISTANT",
                status: MessageStatus.COMPLETE,
                model,
                content: fullText,
                mode,
                duration: Math.round(elapsedMs / 1000),
            },
        });

        const doneEvent: ChatStreamEvent = {
            type: "done",
            messageId: assistantMessage.id,
            durationMs: elapsedMs,
        };

        await stream.writeSSE({ event: "done", data: JSON.stringify(doneEvent) });

    } catch (err) {
        // 主动中断，保存最后一条消息到数据库
        if (abortController.signal.aborted) {
            await persistInterruptedMessage();
            return;
        }

        const message = err instanceof Error ? err.message : String(err);

        await db.message.create({
            data: {
                sessionId,
                role: "ERROR",
                status: MessageStatus.COMPLETE,
                model,
                content: message,
                mode,
            },
        });

        const errorEvent: ChatStreamEvent = { type: "error", message };
        await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) });
    }
};


const app = new Hono()
    // 1. 检查会话是否存在
    // 2. 获取可恢复的用户消息
    // 3. 验证模型是否仍受支持
    // 4. 检查是否已有活跃的恢复请求（防并发）
    .post("/:sessionId/resume", async (c) => {
        const sessionId = c.req.param("sessionId");

        const session = await db.session.findUnique({
            where: { id: sessionId },
            include: { messages: { orderBy: { createdAt: "asc" } } },
        });

        if (!session) {
            return c.json({ error: "Session not found" }, 404);
        }

        const resumableMessage = getResumableUserMessage(session.messages);
        if (!resumableMessage) {
            return c.json({ error: "Session has no pending user message to resume" }, 409);
        }

        if (!isSupportedChatModel(resumableMessage.model)) {
            return c.json({
                error: `Session uses unsupported model: ${resumableMessage.model}`
            }, 409);
        }

        if (activeResumeSessionIds.has(sessionId)) {
            return c.json({
                error: "Session already has an active resume"
            }, 409);
        }

        activeResumeSessionIds.add(sessionId);

        const history = buildConversationHistory(session.messages);
        const abortController = new AbortController();

        try {
            return streamSSE(
                //context
                c,
                //stream
                async (stream) => {
                    stream.onAbort(() => {
                        abortController.abort();
                    });

                    try {
                        await streamAIResponse(stream, {
                            sessionId,
                            model: resumableMessage.model,
                            history,
                            mode: resumableMessage.mode,
                            abortController,
                        });
                    } finally {
                        activeResumeSessionIds.delete(sessionId);
                    }
                },
                //error
                async (err, stream) => {
                    activeResumeSessionIds.delete(sessionId);
                    const message = err instanceof Error ? err.message : String(err);
                    const errorEvent: ChatStreamEvent = { type: "error", message };
                    await stream.writeSSE({
                        event: "error",
                        data: JSON.stringify(errorEvent)
                    });
                },
            );
        } catch (error) {
            activeResumeSessionIds.delete(sessionId);
            throw error;
        }
    })
    .post("/:sessionId", submitValidator, async (c) => {
        const sessionId = c.req.param("sessionId");

        const session = await db.session.findUnique({
            where: { id: sessionId },
            include: { messages: { orderBy: { createdAt: "asc" } } },
        });

        if (!session) {
            return c.json({ error: "Session not found" }, 404);
        }

        const data = c.req.valid("json");

        await db.message.create({
            data: {
                sessionId,
                role: "USER",
                status: MessageStatus.COMPLETE,
                model: data.model,
                content: data.content,
                mode: data.mode,
            },
        });
        // 构建包含新消息的对话历史
        const history = buildConversationHistory([
            ...session.messages, // TODO: limit to last 10, 5 messages?
            {
                role: "USER" as const,
                content: data.content,
                status: MessageStatus.COMPLETE
            },
        ]);

        const abortController = new AbortController();

        return streamSSE(
            c,
            async (stream) => {
                stream.onAbort(() => {
                    abortController.abort();
                });

                await streamAIResponse(stream, {
                    sessionId,
                    model: data.model,
                    history,
                    mode: data.mode,
                    abortController,
                });
            },
            async (err, stream) => {
                const message = err instanceof Error ? err.message : String(err);
                const errorEvent: ChatStreamEvent = { type: "error", message };
                await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) });
            }
        );
    });

export default app;