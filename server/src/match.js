import { Asteroid } from '@dogfight/shared/sim/asteroid';
import { Vector2 } from '@dogfight/shared/sim/vector';
import { Pickup } from '@dogfight/shared/sim/pickup';
import { World } from '@dogfight/shared/sim/world';
import { Ship } from '@dogfight/shared/sim/ship';
import { wrap } from '@dogfight/shared/sim/arena';
import { inputAdapter } from '@dogfight/shared/sim/input';
import { validateInput } from '@dogfight/shared/protocol/messages';

const RATE = 30;
const STEP_MS = 1000 / RATE;
const NEUTRAL = { seq: -1, tick: 0, thrust: false, turn: 0, fire: false };

export class Match {
    constructor(room, onSnapshot, seed = 12345) {
        this.room = room;
        this.seed = seed;
        this.world = new World(seed);
        this.players = new Map();
        this.onSnapshot = onSnapshot;
        this.tickNumber = 0;
        this.running = false;
        this.timer = null;
        this.nextTick = 0;
        this.lastTickDuration = 0;
        this.lastTickJitter = 0;
        this.pendingEvents = [];
        this.world.events.subscribe(event => this.pendingEvents.push(event));
        const asteroid = this.world.spawn(new Asteroid(new Vector2(200, 150), new Vector2(60, 40), 25, 800, 500));
        this.world.spawn(new Pickup(300, 200, 'shield'));
        this.world.spawn(new Pickup(500, 350, 'rapid-fire'));
    }

    addPlayer(player) {
        // Avoid stacking every new player at exactly the same coordinates.
        const index = this.players.size;
        const ship = this.world.spawn(new Ship(320 + (index % 4) * 52, 220 + Math.floor(index / 4) * 52));
        ship.ownerId = player.id;
        const asteroid = [...this.world.ofKind('asteroid')][0];
        if (asteroid && !asteroid.homing) asteroid.homing = {targetId: ship.id, turnRate: 1.5};
        this.players.set(player.id, {ship, input: {...NEUTRAL}, lastProcessedSeq: -1, respawn: null});
        return ship;
    }

    removePlayer(id) {
        const state = this.players.get(id);
        if (!state) return;
        this.world.despawn(state.ship.id);
        this.players.delete(id);
    }

    receiveInput(id, input) {
        if (!validateInput(input)) return false;
        const state = this.players.get(id);
        if (!state || input.seq <= state.input.seq) return false;
        state.input = {...input};
        return true;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.nextTick = performance.now() + STEP_MS;
        this.schedule();
    }
    stop() { this.running = false; clearTimeout(this.timer); }
    schedule() {
        if (!this.running) return;
        this.timer = setTimeout(() => this.tick(), Math.max(0, this.nextTick - performance.now()));
    }

    tick() {
        if (!this.running) return;
        const start = performance.now();
        this.lastTickJitter = start - this.nextTick;
        this.tickNumber++;
        const inputs = new Map();
        for (const [id, state] of this.players) {
            if (!state.ship.alive) {
                state.respawn ??= this.tickNumber + RATE * 2;
                if (this.tickNumber >= state.respawn) {
                    state.ship = this.world.spawn(new Ship(320, 250));
                    state.ship.ownerId = id;
                    state.respawn = null;
                } else continue;
            }
            const input = state.input;
            inputs.set(state.ship.id, inputAdapter(input));
            if (input.fire) state.ship.fire(this.world, input.seq, id);
            state.lastProcessedSeq = input.seq;
        }
        this.world.step(1 / RATE, inputs);
        for (const ship of this.world.ofKind('ship')) wrap(ship, 800, 500);

        const entities = [...this.world].map(e => ({
            id: e.id,
            kind: e.kind,
            x: e.pos.x, y: e.pos.y, vx: e.vel.x, vy: e.vel.y,
            angle: e.angle, radius: e.radius,
            ...(e.ownerId && {ownerId: e.ownerId}),
            ...(e.shotSeq !== undefined && {shotSeq: e.shotSeq}),
            ...(e.kind === 'pickup' && {pickupType: e.type}),
        }));
        const snapshot = {
            type: 'snapshot', tick: this.tickNumber, seed: this.seed,
            entities, events: this.pendingEvents.splice(0), score: this.world.score,
            lastProcessedSeq: Object.fromEntries([...this.players].map(([id, state]) => [id, state.lastProcessedSeq])),
        };
        this.onSnapshot(this.room, snapshot);
        this.lastTickDuration = performance.now() - start;
        this.nextTick += STEP_MS;
        // Do not try to make up an unlimited backlog after a long pause.
        if (this.nextTick < performance.now() - STEP_MS * 3) this.nextTick = performance.now() + STEP_MS;
        this.schedule();
    }

    getStats() {
        return {tick: this.tickNumber, tickRate: RATE, tickDurationMs: this.lastTickDuration, tickJitterMs: this.lastTickJitter};
    }
}
