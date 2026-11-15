# Dogfight — Lab 01

## Overview

A small JavaScript game built with Vite and HTML Canvas.

The project explores the JavaScript event loop, `requestAnimationFrame`, fixed-timestep simulation, keyboard input and interpolated rendering.

## Features

- Fixed-timestep game loop (60 updates per second).
- Keyboard controls for ship rotation and thrust.
- Ship movement with acceleration, drag and speed limit.
- Arena wrap-around.
- Interpolated rendering.
- DPR-aware and responsive Canvas.
- HUD displaying simulation steps, FPS and frame duration.

## Controls

- **Arrow Up:** Thrust.
- **Arrow Left:** Rotate left.
- **Arrow Right:** Rotate right.

## Project Structure

```text
src/
  main.js
  loop.js
  input.js
  sim/
    ship.js
    arena.js
  render/
    canvas.js
    draw.js
```

## M4 — Experiments

### Experiment 1 — Blocking the Main Thread

**Setup:** Added a synchronous busy-wait of 100 ms every 60 frames inside the render function.

**Observations:**
- The game visibly freezes during the blocking operation.
- Rendering is interrupted while JavaScript is busy.
- Frame duration increases significantly after the block.
- FPS temporarily decreases.

**Conclusion:**

JavaScript executes synchronously on the main thread. While a function is running, other JavaScript tasks and rendering callbacks cannot execute on that thread. Therefore, a 100 ms synchronous operation cannot be worked around by another JavaScript callback running on the same thread.

### Experiment 2 — requestAnimationFrame vs setInterval

**Using setInterval (16 ms):**
- FPS: approximately 62–63.
- Frame duration: 15–17 ms.
- In background tab: FPS dropped to 1, then gradually returned to 30 and 62.
- Observation: setInterval is not synchronized with the monitor refresh rate and is throttled when the tab is in the background.

### Experiment 3 — Fixed Timestep Under Artificial Delay

**Objective:** Test whether the fixed timestep maintains a stable simulation rate under rendering delays.

**Setup:** Added an artificial 50 ms delay to each frame.

**Results:**

| Metric | Result |
|---|---:|
| FPS | 20 |
| Frame duration | 50 ms |
| Steps/s | 60 |

**Conclusion:** Even with rendering reduced to 20 FPS, the Fixed Timestep maintained 60 simulation steps per second, demonstrating the separation between simulation and rendering rates.

## Technologies

- JavaScript (ES Modules)
- HTML5 Canvas
- Vite
- ESLint
- Prettier

## Lab 02 — Objects, Prototypes & Classes

### M1 — Vector2 and Entity

#### Vector2

Implemented a `Vector2` class with pure methods returning new vectors without mutating the original instance:

- `add()`, `sub()` and `scale()`.
- `length()` and `normalize()`.
- `rotate()` and `dot()`.
- `static fromAngle()`.

#### Entity and Inheritance

- Created a base `Entity` class with `id`, `pos`, `vel`, `angle`, `radius`, `alive` and `kind`.
- Implemented a private static ID counter.
- Added `update(dt)` to update entity position using velocity.
- Refactored `Ship` to extend `Entity`, using a single inheritance level.

### M2 — The World

#### Entity Management

- Implemented a `World` class using a `Map` to manage entities.
- Added `spawn(e)`, `despawn(id)`, `get(id)`, `[Symbol.iterator]` and `ofKind(kind)`.
- Implemented `World.step(dt, inputs)` to update entities, resolve collisions and remove dead entities.
- Used deferred removal: entities are marked as dead and removed during the sweep phase.

#### Bullets and Asteroids

- Added `Bullet` with a time-to-live (TTL).
- Added `Asteroid` with drifting and bouncing movement.
- Implemented collision detection between bullets and asteroids.
- Implemented `Ship.fire()` to spawn bullets from the ship's nose with inherited velocity.

#### The `this` Binding Problem

JavaScript methods depend on how they are called. When passing an object method directly as an event handler, the method loses its original object context.

**Incorrect approach:**

```javascript
window.addEventListener('keydown', ship.fire);
```

In this case, `this` inside `fire()` does not refer to the `ship` instance. This can cause errors when the method tries to access properties such as `this.pos`, `this.vel` or `this.angle`.

**Correct approach using an arrow function:**

```javascript
window.addEventListener('keydown', () => ship.fire(world));
```

The arrow function calls `fire()` through the `ship` instance, preserving the correct `this` context.

In this project, the input system uses `justPressed()` and calls `ship.fire(world)` directly inside the simulation loop, avoiding the binding problem.

### M3 — Collisions, Damage & Respawn

#### Collision System

- Created a separate collision detection system in `sim/collision.js`.
- Implemented circle-circle collision detection.
- Used a naive O(n²) collision detection approach, keeping it separate from collision resolution for future optimization.

#### Damage and Health

- Added private HP fields with public getters to `Ship` and `Asteroid`.
- Implemented `takeDamage()` to handle damage and entity destruction.
- Added a 1-second damage cooldown to prevent continuous damage during collisions.
- Bullets deal damage to ships and asteroids.

#### Explosions and Respawn

- Created an `Explosion` entity with multiple short-lived particles.
- Added particle rendering with fading transparency.
- Implemented ship respawn after 2 seconds at a random safe position, away from asteroids.

#### Score

- Added a score system to `World`.
- Awarded 10 points for each destroyed asteroid.
- Displayed the score in the HUD.

### M4 — Composition vs. Inheritance

This milestone demonstrates how composition allows behavior to be reused without creating a complex inheritance hierarchy.

**Homing behavior**

Homing is implemented as a separate behavior in `sim/behaviors/homing.js`. Any entity can receive a `homing` configuration containing a target ID and turn rate. The `World` applies this behavior during each update.

This allows both bullets and asteroids to use homing without requiring specialized subclasses.

**Pickups**

Pickups are implemented as independent `Entity` objects. They have their own type and collision behavior, while the ship handles the effects through `applyPickup()`.

Two pickup types were implemented:
- **Shield:** prevents damage for 5 seconds.
- **Rapid Fire:** reduces the shooting cooldown for 5 seconds.

**Design comparison**

With inheritance, each behavior could require additional subclasses, such as `HomingAsteroid`, `HomingBullet`, or specialized pickup classes. This can lead to a rigid and increasingly complex class hierarchy.

Composition keeps behaviors independent and allows them to be attached to different entities. This makes the system more flexible, reusable, and easier to extend.