import type { InferResponseType } from 'hono/client';

import { TextAttributes } from '@opentui/core';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { apiClient } from '../../lib/apiClient';
import { getErrorMessage } from '../../lib/httpError';
import { useDialog } from '../../providers/dialog';
import { useToast } from '../../providers/toast';
import { DialogSearchList } from './dialog-search-list';

type Session = InferResponseType<
    (typeof apiClient.sessions)['$get'],
    200
>[number];

export const SessionsDialogContent = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const { close } = useDialog();
    const navigate = useNavigate();
    const { show } = useToast();

    //useEffcet get all sessions
    useEffect(() => {
        let ignore = false;

        const fetchSessions = async () => {
            try {
                const res = await apiClient.sessions.$get();
                if (!res.ok) {
                    throw new Error(await getErrorMessage(res));
                }

                const data = await res.json();
                if (!ignore) {
                    setSessions(data);
                    setLoading(false);
                }
            } catch (err) {
                if (!ignore) {
                    show({
                        variant: 'error',
                        message:
                            err instanceof Error
                                ? err.message
                                : 'Failed to fetch sessions',
                    });
                    close();
                }
            }
        };

        fetchSessions();

        return () => {
            ignore = true;
        };
    }, [close, show]);

    //处理选中逻辑，关闭弹窗并导航转到会话详情页
    const handleSelect = useCallback(
        (session: Session) => {
            close();
            navigate(`/sessions/${session.id}`);
        },
        [close, navigate],
    );

    if (loading) {
        return (
            <box flexDirection="column">
                <text attributes={TextAttributes.DIM}>Loading sessions...</text>
            </box>
        );
    }

    return (
        <DialogSearchList
            items={sessions}
            onSelect={handleSelect}
            filterFn={(s, query) =>
                s.title.toLowerCase().includes(query.toLowerCase())
            }
            renderItem={(session, isSelected) => (
                <>
                    <text
                        selectable={false}
                        fg={isSelected ? 'black' : 'white'}
                    >
                        {session.title}
                    </text>
                    <box flexGrow={1} />
                    <text
                        selectable={false}
                        fg={isSelected ? 'black' : undefined}
                        attributes={TextAttributes.DIM}
                    >
                        {format(
                            new Date(session.createdAt),
                            'yyyy年MM月dd日 hh:mm a',
                        )}
                    </text>
                </>
            )}
            getKey={(s) => s.id}
            placeholder="Search sessions"
            emptyText="No matching sessions"
        />
    );
};
