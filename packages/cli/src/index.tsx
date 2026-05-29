import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';

import { Header } from './components/Header';
import { InputBar } from './components/InputBar';
import { ToastProvider } from './providers/toast';

function App() {
    return (
        <ToastProvider>
            <box
                alignItems="center"
                justifyContent="center"
                backgroundColor="#0d0d12"
                width="100%"
                height="100%"
                gap={2}
            >
                <Header />
                <box width="100%" maxWidth={78} paddingX={2}>
                    <InputBar onSubmit={() => {}} />
                </box>
            </box>
        </ToastProvider>
    );
}

const renderer = await createCliRenderer({
    targetFps: 120,
    exitOnCtrlC: false,
});
createRoot(renderer).render(<App />);
