
export function encode(message) {
    return JSON.stringify(message);
}

export function decode(data) {
    return JSON.parse(data);
}
