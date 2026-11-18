
export const PROTOCOL_VERSION = 0;

export function validateMessage(data) {
    if (
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        data.v !== PROTOCOL_VERSION
    ) {
        return false;
    }

    switch (data.type) {
        case 'join':
            return (
                Object.keys(data).length === 4 &&
                typeof data.roomId === 'string' &&
                data.roomId.length > 0 &&
                typeof data.playerName === 'string' &&
                data.playerName.trim().length >= 1 &&
                data.playerName.trim().length <= 30
            );

        case 'chat':
            return (
                Object.keys(data).length === 3 &&
                typeof data.message === 'string' &&
                data.message.trim().length >= 1 &&
                data.message.length <= 500
            );

        default:
            return false;
    }
}
