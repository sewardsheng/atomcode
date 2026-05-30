import { useTerminalDimensions } from '@opentui/react';
import {
    createContext,
    useContext,
    useRef,
    useState,
    useCallback,
} from 'react';

import type { ToastOptions, ToastVariant } from './types';

import { Toast } from './Toast';
import { DEFAULT_TOAST_DURATION } from './types';

export type ToastContextValue = {
    show: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
    const value = useContext(ToastContext);
    if (!value) {
        throw new Error('useToast must be used within a ToastProvider');
    }

    return value;
}

// Provider Components
type ToastProviderProps = {
    children: React.ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
    const [currentToast, setCurrentToast] = useState<ToastOptions | null>(null);
    const timeoutHandleRef = useRef<NodeJS.Timeout | null>(null);

    const cleanCurrentTimeout = useCallback(() => {
        if (timeoutHandleRef.current) {
            clearTimeout(timeoutHandleRef.current);
            timeoutHandleRef.current = null;
        }
    }, []);

    const show = useCallback(
        (options: ToastOptions) => {
            const duration = options.duration ?? DEFAULT_TOAST_DURATION;

            cleanCurrentTimeout();
            setCurrentToast({
                variant: options.variant ?? 'info',
                ...options,
                duration,
            });

            timeoutHandleRef.current = setTimeout(() => {
                setCurrentToast(null);
            }, duration).unref();
        },
        [cleanCurrentTimeout],
    );

    const value: ToastContextValue = { show };
    return (
        <ToastContext.Provider value={value}>
            {children}
            <Toast currentToast={currentToast} />
        </ToastContext.Provider>
    );
}
