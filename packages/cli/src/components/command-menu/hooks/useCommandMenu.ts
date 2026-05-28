import type { ScrollBoxRenderable } from "@opentui/core";
import type { Command } from "../types";
import { useMemo, useRef, useState } from "react";
import { getFilteredCommands } from "../utils/filterCommand";
import { useKeyboard } from "@opentui/react";

type UseCommandMenuReturn = {
    showCommandMenu: boolean;
    commandQuery: string;
    selectedIndex: number;
    scrollRef: React.RefObject<ScrollBoxRenderable | null>;
    handleContentChange: (text: string) => void;
    resolveCommand: (index: number) => Command | undefined;
    setSelectedIndex: (index: number) => void;
};

/**
 * Provides state and handlers for a slash-command selection menu tied to a text input.
 *
 * Manages whether the menu is visible, the active command query (input after a leading `/`),
 * the highlighted command index, a scrollable container ref to keep the highlight in view,
 * content-change handling that toggles the menu and resets selection, command resolution that
 * dismisses the menu when a valid command is selected, and keyboard navigation for the menu.
 *
 * @returns An object with:
 * - `showCommandMenu`: `true` when the command menu is visible.
 * - `commandQuery`: the current command query string (input after the leading `/`), or `""`.
 * - `selectedIndex`: the index of the currently highlighted command.
 * - `scrollRef`: a ref to the scrollable command list used to keep the highlighted item visible.
 * - `handleContentChange`: `(text: string) => void` — updates input state, resets selection, scrolls to top, and shows/hides the menu based on the input.
 * - `resolveCommand`: `(index: number) => Command | undefined` — returns the command at `index` and hides the menu if the command exists.
 * - `setSelectedIndex`: React state setter for `selectedIndex`.
 */
export function useCommandMenu(): UseCommandMenuReturn {
    const [showCommandMenu, setShowCommandMenu] = useState(false);
    const [textValue, setTextValue] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollRef = useRef<ScrollBoxRenderable>(null);

    const commandQuery = showCommandMenu && textValue.startsWith("/") ? textValue.slice(1) : "";

    const filteredCommands = useMemo(() => getFilteredCommands(commandQuery), [commandQuery]);

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
        } else {
            setShowCommandMenu(false);
        }
    }

    //resolve the command by index
    const resolveCommand = (index: number): Command | undefined => {
        const cmd = filteredCommands[index];
        if (cmd) {
            setShowCommandMenu(false);
        }
        return cmd;
    }



    //arrow key move selection;
    //the list follow along when the highlight goes off-screen
    useKeyboard((key) => {
        if (!showCommandMenu) return;

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
                setShowCommandMenu(false);
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
