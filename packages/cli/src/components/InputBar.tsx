import type { KeyBinding } from '@opentui/core';

import { EmptyBorder } from './Border';
import { StatusBar } from './StatusBar';

type Props = {
    onSubmit: (text: string) => void;
    disabled?: boolean;
};

// keybinding action map
export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
    { name: 'return', action: 'submit' },
    { name: 'enter', action: 'submit' },
    { name: 'return', shift: true, action: 'newline' },
    { name: 'enter', shift: true, action: 'newline' },
];

export function InputBar({ onSubmit, disabled = false }: Props) {
    return (
        <box width="100%" alignItems="center">
            <box
                border={['left']}
                borderColor="#66ccff"
                customBorderChars={{
                    ...EmptyBorder,
                    vertical: '┃',
                    bottomLeft: '╹',
                }}
                width="100%"
            >
                <box
                    position="relative"
                    justifyContent="center"
                    paddingX={2}
                    paddingY={1}
                    backgroundColor="#1A1A24"
                    width="100%"
                    gap={1}
                >
                    <textarea
                        focused={!disabled}
                        placeholder={`开始你的冒险之旅...`}
                        keyBindings={TEXTAREA_KEY_BINDINGS}
                    />
                    <StatusBar />
                </box>
            </box>
        </box>
    );
}
