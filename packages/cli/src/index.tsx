import { createCliRenderer, TextAttributes } from '@opentui/core';
import { createRoot } from '@opentui/react';

import { Header } from './components/Header';
import { InputBar } from './components/InputBar';

/**
 * Root application component that renders the centered CLI UI with a header and input area.
 *
 * The layout centers content, applies a dark background, and constrains the main content width.
 * The rendered tree includes a Header component and an InputBar; the InputBar is provided an empty
 * no-op `onSubmit` handler.
 *
 * @returns The root JSX element tree for the CLI application.
 */
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

const renderer = await createCliRenderer({
    targetFps: 120,
    exitOnCtrlC: false,
});
createRoot(renderer).render(<App />);
