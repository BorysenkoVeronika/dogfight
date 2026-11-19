import { mulberry32 } from './random.js';
import { detectCollisions } from './collision.js';
import { Explosion } from './explosion.js';
import { updateHoming } from './behaviors/homing.js';
import { createSimulationEvents } from './events.js';

export class World {
    static fromSnapshot(snapshot) {
        return structuredClone(snapshot);
    }

    #entities = new Map();
    score = 0;
    events = createSimulationEvents();

    constructor(seed = 12345) {
        this.random = mulberry32(seed);
    }

    spawn(entity) {
        this.#entities.set(entity.id, entity);
        return entity;
    }

    despawn(id) {
        const entity = this.#entities.get(id);

        if (entity) {
            entity.alive = false;
        }
    }

    get(id) {
        return this.#entities.get(id);
    }

    *[Symbol.iterator]() {
        yield* this.#entities.values();
    }

    *ofKind(kind) {
        for (const entity of this.#entities.values()) {
            if (entity.kind === kind) {
                yield entity;
            }
        }
    }


    step(dt, inputs) {
        for (const entity of this.#entities.values()) {
            if (!entity.alive) continue;

            if (entity.homing) {
                const target = this.get(entity.homing.targetId);
                updateHoming(entity, target, dt);
            }

            const input = entity.kind === 'ship'
                ? inputs instanceof Map
                    ? inputs.get(entity.id)
                    : inputs
                : undefined;

            if (entity.kind === 'ship' && !input) {
                continue;
            }

            entity.update(dt, input);
        }

        this.#resolveCollisions();

        this.#sweep();
    }


    #resolveCollisions() {
        const collisions = detectCollisions(this);

        for (const [a, b] of collisions) {
            if (!a.alive || !b.alive) continue;

            const bullet = a.kind === 'bullet' ? a : b.kind === 'bullet' ? b : null;
            const target = bullet === a ? b : a;

            if (bullet && (target.kind === 'ship' || target.kind === 'asteroid')) {
                const wasAlive = target.alive;

                target.takeDamage(1);
                bullet.alive = false;
                this.events.emit('hit')

                if (target.kind === 'asteroid' && wasAlive && !target.alive) {
                    this.score += 10;

                    this.events.emit('scoreChanged', this.score);
                }

                if (target.kind === 'ship' && wasAlive && !target.alive) {
                    this.spawn(new Explosion(target.pos, 20, this.random));
                    this.events.emit('exploded')
                }
            }

            if (
                (a.kind === 'ship' && b.kind === 'asteroid') ||
                (a.kind === 'asteroid' && b.kind === 'ship')
            ) {
                const ship = a.kind === 'ship' ? a : b;
                const wasAlive = ship.alive;

                ship.takeDamage(1);

                if (wasAlive && !ship.alive) {
                    this.spawn(new Explosion(ship.pos, 20, this.random));
                    this.events.emit('exploded')
                }
            }

            if (
                (a.kind === 'ship' && b.kind === 'pickup') ||
                (a.kind === 'pickup' && b.kind === 'ship')
            ) {
                const pickup = a.kind === 'pickup' ? a : b;
                const ship = a.kind === 'ship' ? a : b;

                ship.applyPickup(pickup.type);
                pickup.alive = false;
            }
        }
    }

    #sweep() {
        for (const [id, entity] of this.#entities) {
            if (!entity.alive) {
                this.#entities.delete(id);
            }
        }
    }

}
