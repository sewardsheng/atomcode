import type { InferResponseType } from 'hono/client';

import { MessageStatus, Mode } from '@atomcode/database/enums';
import {
    messagePartsSchema,
    type SupportedChatModelId,
} from '@atomcode/shared';
import { useKeyboard } from '@opentui/react';
import prettyMs from 'pretty-ms';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';

import { UserMessage, BotMessage, ErrorMessage } from '../components/messages';
import { SessionShell } from '../components/SessionShell';
import {
    type Message,
    type ClientMessagePart,
    useChat,
} from '../hooks/useChat';
import { apiClient } from '../lib/apiClient';
import { getErrorMessage } from '../lib/httpError';
import { useKeyboardLayer } from '../providers/keyboard-layer';
import { usePromptConfig } from '../providers/prompt-config';
import { useToast } from '../providers/toast';

type SessionData = InferResponseType<
    (typeof apiClient.sessions)[':id']['$get'],
    200
>;

const sessionLocationSchema = z.object({
    session: z.custom<SessionData>(
        (val) => val != null && typeof val === 'object' && 'id' in val,
    ),
});

function mapDbMessages(dbMessages: SessionData['messages']): Message[] {
    return dbMessages.map((m): Message => {
        if (m.role === 'ERROR') {
            return { id: m.id, role: 'error', content: m.content };
        }

        if (m.role === 'USER') {
            return {
                id: m.id,
                role: 'user',
                content: m.content,
                mode: m.mode,
                model: m.model as SupportedChatModelId,
            };
        }
        const parsedParts =
            m.parts == null ? null : messagePartsSchema.safeParse(m.parts);
        const parts: ClientMessagePart[] = parsedParts?.success
            ? parsedParts.data.map((p) =>
                  p.type === 'tool-call'
                      ? { ...p, status: 'done' as const }
                      : p,
              )
            : [];
        return {
            id: m.id,
            role: 'assistant',
            content: m.content,
            model: m.model as SupportedChatModelId,
            mode: m.mode,
            parts,
            ...(m.duration != null
                ? { duration: prettyMs(m.duration * 1000) }
                : {}),
            interrupted: m.status === MessageStatus.INTERRUPTED,
        };
    });
}

function ChatMessage({ msg }: { msg: Message }) {
    if (msg.role === 'user') {
        return <UserMessage message={msg.content} mode={msg.mode} />;
    }

    if (msg.role === 'error') {
        return <ErrorMessage message={msg.content} />;
    }

    return (
        <BotMessage
            parts={msg.parts}
            model={msg.model}
            mode={msg.mode}
            duration={msg.duration}
            streaming={false}
            interrupted={msg.interrupted}
        />
    );
}
function SessionChat({ session }: { session: SessionData }) {
    const [initialMessages] = useState(() => mapDbMessages(session.messages));
    const { mode, model } = usePromptConfig();
    const { isTopLayer } = useKeyboardLayer();
    const { messages, streaming, submit, abort, interrupt } = useChat(
        session.id,
        initialMessages,
    );

    // 当用户离开会话时，停止回复。
    useEffect(() => {
        return () => abort();
    }, [abort]);

    // 当用户在流式回复中按下 ESC 键时，取消回复。
    useKeyboard((key) => {
        if (
            key.name === 'escape' &&
            isTopLayer('base') &&
            streaming.status === 'streaming'
        ) {
            key.preventDefault();
            interrupt();
        }
    });

    return (
        <SessionShell
            onSubmit={(text) =>
                submit({
                    userText: text,
                    mode,
                    model,
                })
            }
            loading={streaming.status === 'streaming'}
            interruptible={streaming.status === 'streaming'}
        >
            {messages.map((msg) => (
                <ChatMessage key={msg.id} msg={msg} />
            ))}
            {streaming.status === 'streaming' && streaming.parts.length > 0 && (
                <BotMessage
                    parts={streaming.parts}
                    model={streaming.model}
                    mode={streaming.mode}
                    streaming
                />
            )}
        </SessionShell>
    );
}
export function Session() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const toast = useToast();

    const prefetched = useMemo(() => {
        const parsed = sessionLocationSchema.safeParse(location.state);
        return parsed.success ? parsed.data.session : null;
    }, [location.state]);

    const [session, setSession] = useState<SessionData | null>(prefetched);

    useEffect(() => {
        // Skip fetch if session was passed via location state
        if (prefetched) return;

        setSession(null);

        if (!id) return;

        let ignore = false;
        const fetchSession = async () => {
            try {
                const res = await apiClient.sessions[':id'].$get({
                    param: { id },
                });
                if (ignore) return;

                if (!res.ok) throw new Error(await getErrorMessage(res));

                const resolved = await res.json();
                setSession(resolved);
            } catch (err) {
                if (ignore) return;
                toast.show({
                    variant: 'error',
                    message:
                        err instanceof Error
                            ? err.message
                            : 'Failed to load session',
                });
                navigate('/', { replace: true });
            }
        };

        fetchSession();
        return () => {
            ignore = true;
        };
    }, [id, prefetched, toast, navigate]);

    if (!session) {
        return <SessionShell onSubmit={() => {}} inputDisabled loading />;
    }

    return <SessionChat key={session.id} session={session} />;
}
