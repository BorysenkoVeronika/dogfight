// The same input adapter is used for authoritative ticks and local prediction.
export function inputAdapter(input) {
    return {
        isDown(key) {
            if (key === 'ArrowUp') return input.thrust;
            if (key === 'ArrowLeft') return input.turn === -1;
            if (key === 'ArrowRight') return input.turn === 1;
            return false;
        },
    };
}
