import type { KeyBinding } from '@opentui/core';
import type { TextareaRenderable } from '@opentui/core';

import { useRenderer } from '@opentui/react';
import { useRef, useCallback, useEffect } from 'react';

import type { Command } from './command-menu/types';

import { useToast } from '../providers/toast';
import { EmptyBorder } from './Border';
import { CommandMenu } from './command-menu';
import { useCommandMenu } from './command-menu/hooks/useCommandMenu';
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
    const textareaRef = useRef<TextareaRenderable>(null);
    const onSubmitRef = useRef<() => void>(() => {});
    const toast = useToast();
    const renderer = useRenderer();
    const {
        showCommandMenu,
        commandQuery,
        selectedIndex,
        scrollRef,
        handleContentChange,
        resolveCommand,
        setSelectedIndex,
    } = useCommandMenu();

    const handleTextareaContentChange = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        handleContentChange(textarea.plainText);
    }, []);

    const handleSubmit = useCallback(() => {
        if (disabled) return;

        const textarea = textareaRef.current;
        if (!textarea) return;

        const text = textarea.plainText.trim();
        if (text.length === 0) return;

        onSubmit(text);
        textarea.setText('');
    }, [disabled, onSubmit]);

    const handleCommand = useCallback(
        (command: Command | undefined) => {
            const textarea = textareaRef.current;
            if (!textarea || !command) return;

            textarea.setText('');

            if (command.action) {
                command.action({
                    exit: () => renderer.destroy(),
                    toast,
                });
            } else {
                textarea.insertText(command.value + ' ');
            }
        },
        [renderer, toast],
    );

    const handleCommandExecute = useCallback(
        (index: number) => {
            const command = resolveCommand(index);
            handleCommand(command);
        },
        [resolveCommand, handleCommand],
    );

    // 确保textarea的提交处理函数始终读取最新的状态
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.onSubmit = () => {
            onSubmitRef.current();
        };
    }, []);

    onSubmitRef.current = () => {
        if (disabled) return;
        if (showCommandMenu) {
            const command = resolveCommand(selectedIndex);
            handleCommand(command);
            return;
        }

        handleSubmit();
    };

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
                    {showCommandMenu && (
                        <box
                            position="absolute"
                            bottom="100%"
                            left={0}
                            width="100%"
                            backgroundColor="#1A1A24"
                            zIndex={10}
                        >
                            <CommandMenu
                                query={commandQuery}
                                selectedIndex={selectedIndex}
                                scrollRef={scrollRef}
                                onSelect={setSelectedIndex}
                                onExecute={handleCommandExecute}
                            />
                        </box>
                    )}
                    <textarea
                        ref={textareaRef}
                        focused={!disabled}
                        placeholder={`开始你的冒险之旅...`}
                        keyBindings={TEXTAREA_KEY_BINDINGS}
                        onContentChange={handleTextareaContentChange}
                    />
                    <StatusBar />
                </box>
            </box>
        </box>
    );
}
