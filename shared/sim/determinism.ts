import { Ship } from './ship.ts';
import { wrap } from './arena.ts';
import { mulberry32 } from './random.ts';
import { inputAdapter } from './input.ts';

// Same pure computation runs in Node and in the browser, 1,000 fixed steps.
export function determinismHash(): string {
    const random = mulberry32(202605);
    const ship = new Ship(400, 250);
    for (let i = 0; i < 1000; i++) {
        const input = {thrust: random() > 0.35, turn: Math.floor(random() * 3) - 1};
        ship.update(1 / 30, inputAdapter({thrust: input.thrust, turn: input.turn === -1 ? -1 : input.turn === 0 ? 0 : 1}));
        wrap(ship, 800, 500);
    }
    const state = [ship.pos.x, ship.pos.y, ship.vel.x, ship.vel.y, ship.angle]
        .map(n => n.toFixed(9)).join('|');
    let hash = 2166136261;
    for (const char of state) {hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619);}
    return (hash >>> 0).toString(16).padStart(8, '0');
}
