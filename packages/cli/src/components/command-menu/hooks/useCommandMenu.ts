import type { ScrollBoxRenderable } from "@opentui/core";
import type { Command } from "../types";
import { useMemo, useRef, useState } from "react";
import { getFilteredCommands } from "../utils/filterCommand";
import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../../../providers/keyboard-layer";


type UseCommandMenuReturn = {
    showCommandMenu: boolean;
    commandQuery: string;
    selectedIndex: number;
    scrollRef: React.RefObject<ScrollBoxRenderable | null>;
    handleContentChange: (text: string) => void;
    resolveCommand: (index: number) => Command | undefined;
    setSelectedIndex: (index: number) => void;
};

export function useCommandMenu(): UseCommandMenuReturn {
    const [showCommandMenu, setShowCommandMenu] = useState(false);
    const [textValue, setTextValue] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollRef = useRef<ScrollBoxRenderable>(null);
    const { pop, push, isTopLayer } = useKeyboardLayer();

    const commandQuery = showCommandMenu && textValue.startsWith("/") ? textValue.slice(1) : "";

    const filteredCommands = useMemo(() => getFilteredCommands(commandQuery), [commandQuery]);

    const close = () => {
        setShowCommandMenu(false);
        pop('command');
    }
    //handle content change
    //jump to top of the scroll box
    const handleContentChange = (text: string) => {
        setTextValue(text);
        setSelectedIndex(0);

        //jump to top of the scroll box
        const scrollbox = scrollRef.current;
        if (scrollbox) scrollbox.scrollTo(0)

        //check if the text is start with "/"
        const prefix = text.startsWith("/") ? text.slice(1) : null;
        if (prefix !== null && !prefix.includes(" ")) {
            setShowCommandMenu(true);
            push('command', () => {
                close();
                return true;
            });
        } else {
            close();
        }
    }

    //resolve the command by index
    const resolveCommand = (index: number): Command | undefined => {
        const cmd = filteredCommands[index];
        if (cmd) {
            close();
        }
        return cmd;
    }



    //arrow key move selection;
    //the list follow along when the highlight goes off-screen
    useKeyboard((key) => {
        if (!showCommandMenu || !isTopLayer("command")) return;

        const moveSelection = (delta: number) => {
            key.preventDefault();
            setSelectedIndex((index) => {
                const newIndex = delta < 0
                    ? Math.max(0, index + delta)
                    : Math.min(filteredCommands.length - 1, index + delta);

                const scrollbox = scrollRef.current;
                if (scrollbox) {
                    const needsScroll = delta < 0
                        ? newIndex < scrollbox.scrollTop
                        : newIndex > scrollbox.scrollTop;
                    if (needsScroll) {
                        scrollbox.scrollTo(newIndex);
                    }
                }
                return newIndex;
            });
        };

        const keyHandlers: Record<string, () => void> = {
            escape: () => {
                key.preventDefault();
                close();
            },
            up: () => moveSelection(-1),
            down: () => moveSelection(1),
        };

        keyHandlers[key.name]?.();
    })
    return {
        showCommandMenu,
        commandQuery,
        selectedIndex,
        scrollRef,
        handleContentChange,
        resolveCommand,
        setSelectedIndex,
    }
}
