import type {InputState, KeyInput} from '../types.ts';
// The same input adapter is used for authoritative ticks and local prediction.
export function inputAdapter(input: InputState): KeyInput {
    return {
        isDown(key: string): boolean {
            if (key === 'ArrowUp') return input.thrust;
            if (key === 'ArrowLeft') return input.turn === -1;
            if (key === 'ArrowRight') return input.turn === 1;
            return false;
        },
    };
}
