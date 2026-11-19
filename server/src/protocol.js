
import { validateInput } from '@dogfight/shared/protocol/messages';

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

        case 'input':
            return (
                Object.keys(data).length === 7 &&
                validateInput({
                    seq: data.seq,
                    tick: data.tick,
                    thrust: data.thrust,
                    turn: data.turn,
                    fire: data.fire,
                })
            );


        case 'ping':
            return Object.keys(data).length === 3 && Number.isFinite(data.sentAt) && data.sentAt >= 0;

        case 'networkConfig':
            return (
                Object.keys(data).length === 5 &&
                Number.isFinite(data.latency) &&
                data.latency >= 0 &&
                data.latency <= 1000 &&
                Number.isFinite(data.jitter) &&
                data.jitter >= 0 &&
                data.jitter <= 500 &&
                Number.isFinite(data.drop) &&
                data.drop >= 0 &&
                data.drop <= 100
            );


        default:
            return false;
    }
}
