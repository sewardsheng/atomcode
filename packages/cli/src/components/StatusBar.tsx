import { TextAttributes } from '@opentui/core';

/**
 * Renders a horizontal status bar displaying the build label, a dimmed separator, and the current model/version.
 *
 * @returns A JSX element containing three text segments: "Build" in cyan, a dim gray "›" separator, and the model/version string ("opus-4-6").
 */
export function StatusBar() {
    return (
        <box flexDirection="row" gap={1}>
            <text fg="cyan">Build</text>
            <text attributes={TextAttributes.DIM} fg="gray">
                ›
            </text>
            <text>opus-4-6</text>
        </box>
    );
}
