import { createContext, useContext, useState, useCallback } from 'react';

import type { DialogConfig } from './types';

import { useKeyboardLayer } from '../keyboard-layer';
import { Dialog } from './dialog';

export type DialogContextValue = {
    open: (config: DialogConfig) => void;
    close: () => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
    const value = useContext(DialogContext);
    if (!value) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return value;
}

type DialogProviderProps = {
    children: React.ReactNode;
};

export function DialogProvider({ children }: DialogProviderProps) {
    const [currentDialog, setCurrentDialog] = useState<DialogConfig | null>(
        null,
    );
    const { push, pop } = useKeyboardLayer();

    const close = useCallback(() => {
        setCurrentDialog(null);
        pop('dialog');
    }, [pop]);

    const open = useCallback(
        (config: DialogConfig) => {
            setCurrentDialog(config);
            push('dialog', () => {
                close();
                return true;
            });
        },
        [push, close],
    );

    const value: DialogContextValue = {
        open,
        close,
    };

    return (
        <DialogContext.Provider value={value}>
            {children}
            <Dialog currentDialog={currentDialog} close={close} />
        </DialogContext.Provider>
    );
}
