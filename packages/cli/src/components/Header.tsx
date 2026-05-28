/**
 * Renders a centered header composed of two ASCII-styled text elements: "Atom" (gray) and "Code" (white).
 *
 * The elements are arranged horizontally with spacing and vertically centered.
 *
 * @returns The header as a JSX element.
 */
export function Header() {
    return (
        <box justifyContent="center" alignItems="center">
            <box
                flexDirection="row"
                justifyContent="center"
                gap={1}
                alignItems="center"
            >
                <ascii-font font="tiny" color="gray" text="Atom" />
                <ascii-font font="tiny" color="white" text="Code" />
            </box>
        </box>
    );
}
