import { useTerminalDimensions } from '@opentui/react';

import type { ToastOptions, ToastVariant } from './types';

import { SplitBorderChars } from '../../components/Border';
import { useTheme } from '../theme';

type ToastProps = {
    currentToast: ToastOptions | null;
};

export function Toast({ currentToast }: ToastProps) {
    const { colors } = useTheme();
    if (!currentToast) {
        return null;
    }

    const { width } = useTerminalDimensions();

    const variantColor: Record<ToastVariant, string> = {
        info: colors.info,
        success: colors.success,
        error: colors.error,
    };
    const borderColor = currentToast.variant
        ? variantColor[currentToast.variant]
        : variantColor.info;

    return (
        <box
            position="absolute"
            justifyContent="center"
            alignItems="flex-start"
            top={2}
            right={2}
            width={Math.max(1, Math.min(60, width - 6))}
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            backgroundColor={colors.surface}
            borderColor={borderColor}
            border={['left', 'right']}
            customBorderChars={SplitBorderChars}
        >
            <box flexDirection="column" gap={1} width="100%">
                <text fg="#E0E0E0" wrapMode="word" width="100%">
                    {currentToast.message}
                </text>
            </box>
        </box>
    );
}
