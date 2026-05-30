import { RGBA, TextAttributes } from '@opentui/core';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';

import type { DialogConfig } from './types';

import { useKeyboardLayer } from '../keyboard-layer';

type DialogProps = {
    currentDialog: DialogConfig | null;
    close: () => void;
};

export function Dialog({ currentDialog, close }: DialogProps) {
    const { isTopLayer } = useKeyboardLayer();
    const dimensions = useTerminalDimensions();

    useKeyboard((key) => {
        if (!currentDialog || !isTopLayer('dialog')) return;

        if (key.name === 'escape') {
            close();
        }
    });

    if (!currentDialog) {
        return null;
    }

    const { title, children } = currentDialog;

    return (
        <box
            position="absolute"
            left={0}
            top={0}
            width={dimensions.width}
            height={dimensions.height}
            justifyContent="center"
            alignItems="center"
            backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
            zIndex={100}
            onMouseDown={() => close()}
        >
            <box
                width={Math.min(60, dimensions.width - 4)}
                height="auto"
                backgroundColor="cyan"
                paddingX={4}
                paddingY={1}
                flexDirection="column"
                gap={1}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <box
                    paddingBottom={1}
                    flexDirection="row"
                    alignItems="center"
                    justifyContent="space-between"
                >
                    <text attributes={TextAttributes.BOLD}>{title}</text>
                    <text
                        attributes={TextAttributes.DIM}
                        onMouseDown={() => close()}
                    >
                        esc
                    </text>
                </box>
                <box flexGrow={1}>{children}</box>
            </box>
        </box>
    );
}
