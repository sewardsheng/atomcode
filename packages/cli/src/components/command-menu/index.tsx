import type { RefObject } from 'react';

import { TextAttributes, type ScrollBoxRenderable } from '@opentui/core';

import { useTheme } from '../../providers/theme';
import { COMMANDS } from './commands/command';
import { getFilteredCommands } from './utils/filterCommand';

const MAX_VISIBLE_ITEMS = 6;

// COMMAND COL WIDTH
const COMMAND_COL_WIDTH =
    Math.max(...COMMANDS.map((cmd) => cmd.name.length)) + 4;

type CommandMenuProps = {
    query: string;
    selectedIndex: number;
    scrollRef: RefObject<ScrollBoxRenderable | null>;
    onSelect: (index: number) => void;
    onExecute: (index: number) => void;
};

export function CommandMenu({
    query,
    selectedIndex,
    scrollRef,
    onSelect,
    onExecute,
}: CommandMenuProps) {
    const filteredCommands = getFilteredCommands(query);
    const visibleHeight = Math.min(filteredCommands.length, MAX_VISIBLE_ITEMS);

    const { colors } = useTheme();

    // No matching commands
    if (filteredCommands.length === 0) {
        return (
            <box paddingX={1}>
                <text attributes={TextAttributes.DIM}>
                    No matching commands
                </text>
            </box>
        );
    }

    return (
        <scrollbox ref={scrollRef} height={visibleHeight}>
            {filteredCommands.map((cmd, i) => {
                const isSelected = i === selectedIndex;

                return (
                    <box
                        key={cmd.value}
                        flexDirection="row"
                        paddingX={1}
                        height={1}
                        overflow="hidden"
                        backgroundColor={
                            isSelected ? colors.selection : undefined
                        }
                        onMouseMove={() => onSelect(i)}
                        onMouseDown={() => onExecute(i)}
                    >
                        <box width={COMMAND_COL_WIDTH} flexShrink={0}>
                            <text
                                selectable={false}
                                fg={isSelected ? 'black' : 'white'}
                            >
                                /{cmd.name}
                            </text>
                        </box>
                        <box flexGrow={1} flexShrink={1} overflow="hidden">
                            <text
                                selectable={false}
                                fg={isSelected ? 'black' : 'gray'}
                            >
                                {cmd.description}
                            </text>
                        </box>
                    </box>
                );
            })}
        </scrollbox>
    );
}
