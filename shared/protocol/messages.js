
export const MessageType = Object.freeze({
    INPUT: 'input',
    SNAPSHOT: 'snapshot',
});

export function validateInput(input) {
    return (
        input !== null &&
        typeof input === 'object' &&
        Number.isSafeInteger(input.seq) &&
        input.seq >= 0 &&
        Number.isSafeInteger(input.tick) &&
        input.tick >= 0 &&
        typeof input.thrust === 'boolean' &&
        Number.isInteger(input.turn) &&
        input.turn >= -1 &&
        input.turn <= 1 &&
        typeof input.fire === 'boolean'
    );
}
