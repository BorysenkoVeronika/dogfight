import { mulberry32 } from './random.ts';
import { detectCollisions } from './collision.ts';
import { Explosion } from './explosion.ts';
import { Ship } from './ship.ts';
import { Asteroid } from './asteroid.ts';
import { Pickup } from './pickup.ts';
import { updateHoming } from './behaviors/homing.ts';
import { createSimulationEvents } from './events.ts';
import type {Entity} from './entity.ts';
import type {KeyInput, EntityKind, EntityId} from '../types.ts';

export class World implements Iterable<Entity> {
    static fromSnapshot<T>(snapshot: T): T { return structuredClone(snapshot); }
    #entities = new Map<EntityId, Entity>();
    score = 0;
    events = createSimulationEvents();
    readonly random: () => number;
    constructor(seed: number = 12345) { this.random = mulberry32(seed); }
    spawn<T extends Entity>(entity: T): T { this.#entities.set(entity.id, entity); return entity; }
    despawn(id: EntityId): void {const entity = this.#entities.get(id);if (entity) entity.alive = false;}
    get(id: EntityId): Entity | undefined {return this.#entities.get(id);}
    *[Symbol.iterator](): IterableIterator<Entity> {yield* this.#entities.values();}
    *ofKind(kind: EntityKind): IterableIterator<Entity> {
        for (const entity of this.#entities.values()) if (entity.kind === kind) yield entity;
    }
    step(dt: number, inputs: Map<number, KeyInput> | KeyInput): void {
        for (const entity of this.#entities.values()) {
            if (!entity.alive) continue;
            if (entity.homing) updateHoming(entity, this.get(entity.homing.targetId), dt);
            if (entity instanceof Ship) {
                const input = inputs instanceof Map ? inputs.get(entity.id) : inputs;
                if (input) entity.update(dt, input);
            } else entity.update(dt);
        }
        this.#resolveCollisions();this.#sweep();
    }
    #resolveCollisions(): void {
        for (const [a,b] of detectCollisions(this)) {
            if (!a.alive || !b.alive) continue;
            const bullet = a.kind === 'bullet' ? a : b.kind === 'bullet' ? b : null;
            const target = bullet === a ? b : a;
            if (bullet && (target instanceof Ship || target instanceof Asteroid)) {
                // A projectile must never damage the ship that fired it.
                if (target instanceof Ship && bullet.ownerId && bullet.ownerId === target.ownerId) continue;
                const wasAlive = target.alive;
                target.takeDamage(1);bullet.alive = false;
                this.events.emit('hit',null);
                if (target instanceof Asteroid && wasAlive && !target.alive) {
                    this.score += 10;this.events.emit('scoreChanged',this.score);
                }
                if (target instanceof Ship && wasAlive && !target.alive) {
                    this.spawn(new Explosion(target.pos,20,this.random));this.events.emit('exploded',null);
                }
            }
            if ((a instanceof Ship && b instanceof Asteroid) || (b instanceof Ship && a instanceof Asteroid)) {
                const ship = a instanceof Ship ? a : b;
                const wasAlive = ship.alive;ship.takeDamage(1);
                if (wasAlive && !ship.alive) {this.spawn(new Explosion(ship.pos,20,this.random));this.events.emit('exploded',null);}
            }
            if (a instanceof Ship && b instanceof Pickup) {a.applyPickup(b.type); b.alive = false;}
            else if (b instanceof Ship && a instanceof Pickup) {b.applyPickup(a.type);a.alive = false;}
        }
    }
    #sweep(): void {for (const [id,entity] of this.#entities) if (!entity.alive) this.#entities.delete(id);}
}
