import { createCliRenderer, TextAttributes } from '@opentui/core';
import { createRoot } from '@opentui/react';

import { Header } from './components/Header';
import { InputBar } from './components/InputBar';

function App() {
    return (
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
    );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
