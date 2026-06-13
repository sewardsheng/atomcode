import { TextAttributes } from '@opentui/core';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import { Header } from '../components/Header';
import { InputBar } from '../components/InputBar';
import { usePromptConfig } from '../providers/prompt-config';

export function Home() {
    const navigate = useNavigate();
    const { mode, model } = usePromptConfig();
    const handleSubmit = useCallback(
        (text: string) => {
            navigate('/sessions/new', {
                state: { message: text, mode, model },
            });
        },
        [navigate, mode, model],
    );

    return (
        <box
            alignItems="center"
            justifyContent="center"
            flexGrow={1}
            gap={2}
            position="relative"
            width="100%"
            height="100%"
        >
            <Header />
            <box width="100%" maxWidth={78} paddingX={2} flexDirection="column">
                <InputBar onSubmit={handleSubmit} />
                <box
                    flexDirection="row"
                    gap={1}
                    flexShrink={0}
                    marginLeft="auto"
                >
                    <text>tab</text>
                    <text attributes={TextAttributes.DIM}>agents</text>
                </box>
            </box>
        </box>
    );
}
