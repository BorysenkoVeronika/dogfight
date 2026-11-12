export function createInput(target) {
    const down = new Set();
    const pressed = new Set();

    target.addEventListener('keydown', (event) => {
        if (!down.has(event.code)) {
            pressed.add(event.code);
        }

        down.add(event.code);
    });

    target.addEventListener('keyup', (event) => {
        down.delete(event.code);
    });

    return {
        isDown: (code) => down.has(code),
        justPressed: (code) => pressed.has(code),
        endFrame: () => pressed.clear(),
    };
}