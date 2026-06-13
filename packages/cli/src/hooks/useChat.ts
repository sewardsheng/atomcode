import { useState, useRef, useCallback, useEffect } from "react";
import { EventSourceParserStream } from "eventsource-parser/stream";
import prettyMs from "pretty-ms";
import type { ClientResponse } from "hono/client";
import { apiClient } from "../lib/apiClient";
import { getErrorMessage } from "../lib/httpError";
import type { Mode } from "@atomcode/database/enums";
import {
    chatStreamEventSchema,
    type SupportedChatModelId
} from "@atomcode/shared";

export type ClientToolCallPart = {
    type: "tool-call";
    id: string;
    name: string;
    args: Record<string, unknown>;
    result?: string;
    status: "calling" | "done";
};

export type ClientMessagePart =
    | { type: "reasoning"; text: string }
    | ClientToolCallPart
    | { type: "text"; text: string };

export type Message =
    | {
        id: string;
        role: "user";
        content: string;
        mode: Mode;
        model: SupportedChatModelId
    }
    | {
        id: string;
        role: "assistant";
        content: string;
        mode: Mode;
        model: SupportedChatModelId;
        parts: ClientMessagePart[];
        duration?: string;
        interrupted?: boolean;
    }
    | { id: string; role: "error"; content: string };

type StreamingState =
    | { status: "idle" }
    | {
        status: "streaming";
        parts: ClientMessagePart[];
        mode: Mode;
        model: SupportedChatModelId
    };

type ActiveStream = {
    requestId: string;
    controller: AbortController;
    mode: Mode;
    model: SupportedChatModelId;
    parts: ClientMessagePart[];
    interruptedCaptured: boolean;
};

type SubmitParams = {
    userText: string;
    mode: Mode;
    model: SupportedChatModelId;
};

type RunStreamParams = {
    mode: Mode;
    model: SupportedChatModelId;
    request: (controller: AbortController) => Promise<ClientResponse<unknown>>;
};

export function useChat(
    sessionId: string,
    initialMessages: Message[],
) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [streaming, setStreaming] = useState<StreamingState>({
        status: "idle"
    });
    const activeStreamRef = useRef<ActiveStream | null>(null);

    const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
        setMessages((prev) => updater(prev));
    }, []);

    const isActiveRequest = useCallback((requestId: string) => {
        return activeStreamRef.current?.requestId === requestId;
    }, []);

    // 发送流式消息片段到UI
    const emitParts = useCallback((
        requestId: string,
        parts: ClientMessagePart[],
    ) => {
        if (!isActiveRequest(requestId)) return;
        //// 创建片段快照，避免引用问题
        const snapshot = [...parts];
        const activeStream = activeStreamRef.current;
        if (!activeStream) return;

        activeStream.parts = snapshot;
        setStreaming({
            status: "streaming",
            parts: snapshot,
            mode: activeStream.mode,
            model: activeStream.model,
        });
    }, [isActiveRequest]);

    //捕获中断时的部分回复消息
    const captureInterruptedMessage = useCallback((
        activeStream: ActiveStream
    ) => {
        if (
            activeStream.interruptedCaptured ||
            activeStream.parts.length === 0
        ) {
            return;
        }
        // 标记为已捕获，防止重复处理
        activeStream.interruptedCaptured = true;
        // 拼接所有文本片段为完整文本
        const parts = [...activeStream.parts];
        const fullText = parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("");
        // 将中断的消息添加到消息列表
        updateMessages((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                role: "assistant",
                content: fullText,
                mode: activeStream.mode,
                model: activeStream.model,
                parts,
                interrupted: true,
            },
        ]);
    }, [updateMessages]);

    const clearStream = useCallback(
        (requestId: string) => {
            if (!isActiveRequest(requestId)) return;

            activeStreamRef.current = null;
            setStreaming({ status: "idle" });
        },
        [isActiveRequest],
    );

    // 解析 SSE 流并更新消息状态
    const handleStream = useCallback(async (
        response: ClientResponse<unknown>,
        activeStream: ActiveStream
    ) => {
        if (!isActiveRequest(activeStream.requestId)) return;

        if (!response.ok) {
            const message = await getErrorMessage(response);
            updateMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "error",
                    content: message,
                },
            ]);
            return;
        };

        const parts: ClientMessagePart[] = [];

        const stream = response
            .body!.pipeThrough(new TextDecoderStream())  // 将字节流解码为文本
            .pipeThrough(new EventSourceParserStream());


        for await (const { data } of stream) {
            // 在处理每个事件前检查请求是否仍然活跃
            if (!isActiveRequest(activeStream.requestId)) return;

            let event;

            try {
                event = chatStreamEventSchema.parse(JSON.parse(data));
            } catch (err) {
                const message = err instanceof Error ? err.message : "Invalid stream event";
                updateMessages((prev) => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        role: "error",
                        content: message,
                    },
                ]);
                break;
            }

            switch (event.type) {
                case "reasoning-delta": {
                    const last = parts[parts.length - 1];
                    if (last && last.type === "reasoning") {
                        last.text += event.text;
                    } else {
                        parts.push({ type: "reasoning", text: event.text });
                    }
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "tool-call":
                    parts.push({
                        type: "tool-call",
                        id: event.toolCallId,
                        name: event.toolName,
                        args: event.args,
                        status: "calling",
                    });
                    emitParts(activeStream.requestId, parts);
                    break;
                case "tool-result": {
                    const tc = parts.find(
                        (p): p is ClientToolCallPart => p.type === "tool-call" && p.id === event.toolCallId,
                    );
                    if (tc) {
                        tc.result = event.result;
                        tc.status = "done";
                    }
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "text-delta": {
                    const last = parts[parts.length - 1];
                    if (last && last.type === "text") {
                        last.text += event.text;
                    } else {
                        parts.push({ type: "text", text: event.text });
                    }
                    emitParts(activeStream.requestId, parts);
                    break;
                }
                case "done": {
                    // 处理完成事件：保存完整的助手回复
                    if (!isActiveRequest(activeStream.requestId)) return;

                    const fullText = parts
                        .filter((p) => p.type === "text")
                        .map((p) => p.text)
                        .join("");

                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: event.messageId,
                            role: "assistant",
                            content: fullText,
                            mode: activeStream.mode,
                            model: activeStream.model,
                            duration: prettyMs(event.durationMs),
                            parts: [...parts],
                        },
                    ]);
                    break;
                }
                case "error":
                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            role: "error",
                            content: event.message,
                        },
                    ]);
                    break;
            }
        }
    }, [updateMessages, emitParts, isActiveRequest]);

    // 运行流: 创建请求、管理生命周期、处理响应和错误
    const runStream = useCallback(async (
        { mode, model, request }: RunStreamParams
    ) => {
        // 创建 AbortController 用于后续取消请求
        const controller = new AbortController();
        // 创建活跃流对象
        const activeStream: ActiveStream = {
            requestId: crypto.randomUUID(), // 生成唯一请求ID
            controller,
            mode,
            model,
            parts: [],
            interruptedCaptured: false,
        };
        // 设置为当前活跃流
        activeStreamRef.current = activeStream;
        // 更新流式状态为传输中
        setStreaming({ status: "streaming", parts: [], mode, model });

        try {
            const response = await request(controller);
            await handleStream(response, activeStream);
        } catch (err) {
            // 如果是用户主动取消的请求（AbortError），不做错误处理
            if (err instanceof DOMException && err.name === "AbortError") {
                return;
            }
            // 如果请求已经不再活跃，忽略错误
            if (!isActiveRequest(activeStream.requestId)) return;

            const msg = err instanceof Error ? err.message : String(err);
            updateMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "error",
                    content: msg,
                },
            ]);
        } finally {
            // 无论成功还是失败，都要清理流状态
            clearStream(activeStream.requestId);
        }
    }, [clearStream, handleStream, isActiveRequest, updateMessages]);

    const stopActiveStream = useCallback((
        capturePartial: boolean
    ) => {
        const activeStream = activeStreamRef.current;
        if (!activeStream) return;

        // 如果需要，捕获并保存部分回复
        if (capturePartial) {
            captureInterruptedMessage(activeStream);
        }
        // 清理状态
        activeStreamRef.current = null;
        setStreaming({ status: "idle" });
        // 取消网络请求
        activeStream.controller.abort();
    }, [captureInterruptedMessage]);

    //恢复未完成的对话
    const resume = useCallback(async (
        { mode, model }: Omit<SubmitParams, "userText">
    ) => {
        await runStream({
            mode,
            model,
            request: async (controller) => {
                return apiClient.chat[":sessionId"].resume.$post(
                    { param: { sessionId } },
                    { init: { signal: controller.signal } },
                );
            },
        });
    }, [runStream, sessionId]);

    // 当页面刷新或重新进入时，如果最后一条是用户消息而没有助手回复，则自动触发恢复
    const hasAutoResumedRef = useRef(false);
    useEffect(() => {
        // 如果已经自动恢复过，直接返回
        if (hasAutoResumedRef.current) return;

        // 检查最后一条消息是否为用户消息（表示需要恢复）
        const last = initialMessages[initialMessages.length - 1];
        if (!last || last.role !== "user") return;

        //先改flag再触发恢复
        hasAutoResumedRef.current = true;
        void resume({ mode: last.mode, model: last.model });
    }, [initialMessages, resume]);

    // 提交用户消息
    //先保存当前正在进行中的部分回复，添加用户消息，触发新的流式请求

    const submit = useCallback(async (
        { userText, mode, model }: SubmitParams
    ) => {
        // 显示部分回复（发送新消息前先保存当前流的部分回复）
        stopActiveStream(true);

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: userText,
            mode,
            model,
        };
        // 添加用户消息到列表
        updateMessages((prev) => [...prev, userMessage]);

        await runStream({
            mode,
            model,
            request: async (controller) => {
                return apiClient.chat[":sessionId"].$post(
                    {
                        param: { sessionId },
                        json: { content: userText, mode, model }
                    },
                    { init: { signal: controller.signal } },
                );
            },
        });
    }, [runStream, sessionId, updateMessages, stopActiveStream]);

    //取消当前流式请求，不保存
    const abort = useCallback(() => {
        stopActiveStream(false);
    }, [stopActiveStream]);

    // 中断当前流式请求，保存部分回复
    const interrupt = useCallback(() => {
        stopActiveStream(true);
    }, [stopActiveStream]);

    return { messages, streaming, submit, abort, interrupt };
};