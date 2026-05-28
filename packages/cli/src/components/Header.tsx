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
