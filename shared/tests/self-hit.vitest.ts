import {describe, expect, it} from 'vitest';
import {World} from '../sim/world.ts';
import {Ship} from '../sim/ship.ts';

describe('projectile ownership', () => {
  it('does not damage the shooter even when firing repeatedly', () => {
    const world = new World();
    const shooter = world.spawn(new Ship(100, 100));
    shooter.ownerId = 'player-a';

    for (let i = 0; i < 12; i++) {
      shooter.fire(world, i, 'player-a');
      world.step(1 / 30, new Map());
      for (let j = 0; j < 10; j++) world.step(1 / 30, new Map());
    }

    expect(shooter.hp).toBe(3);
    expect(shooter.alive).toBe(true);
  });

  it('still lets a projectile damage another player', () => {
    const world = new World();
    const shooter = world.spawn(new Ship(100, 100));
    shooter.ownerId = 'player-a';
    const other = world.spawn(new Ship(135, 100));
    other.ownerId = 'player-b';

    shooter.fire(world, 1, 'player-a');
    world.step(1 / 30, new Map());

    expect(shooter.hp).toBe(3);
    expect(other.hp).toBe(2);
  });
});
