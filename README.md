# Dogfight — JavaScript Practice Labs
## Overview
A small JavaScript game built with Vite and HTML Canvas.

The project explores JavaScript fundamentals, the event loop, fixed-timestep simulation, object-oriented programming, composition, asynchronous operations, and game architecture.

## Features
- Fixed-timestep game loop (60 updates per second).

- Keyboard controls for ship rotation and thrust.

- Ship movement with acceleration, drag and speed limit.

- Arena wrap-around.

- Interpolated rendering.

- DPR-aware and responsive Canvas.

- HUD displaying FPS, frame duration and score.

- Entity management and collision detection.

- Asteroids, bullets, explosions and pickups.

- Asynchronous asset loading with progress reporting.

- Loading screen with cancellation and retry support.

## Controls
- **Arrow Up:** Thrust.

- **Arrow Left:** Rotate left.

- **Arrow Right:** Rotate right.

- **Space:** Fire.


## Project Structure

```text
dogfight/
└── src/
    ├── assets/
    │   ├── arena.json
    │   ├── explosion.wav
    │   ├── hit.wav
    │   ├── loader.js
    │   ├── manifest.json
    │   ├── shoot.wav
    │   └── sprites.svg
    ├── render/
    │   ├── canvas.js
    │   └── draw.js
    ├── sim/
    │   ├── behaviors/
    │   │   └── homing.js
    │   ├── arena.js
    │   ├── asteroid.js
    │   ├── bullet.js
    │   ├── collision.js
    │   ├── entity.js
    │   ├── explosion.js
    │   ├── pickup.js
    │   ├── ship.js
    │   ├── vector.js
    │   └── world.js
    ├── audio.js
    ├── counter.js
    ├── events.js
    ├── hud.js
    ├── input.js
    ├── lobby-ui.js
    ├── lobby.js
    ├── loop.js
    ├── main.js
    └── style.css
```


## Lab 01 — JavaScript Fundamentals
### Overview
Explored the JavaScript event loop, `requestAnimationFrame`, fixed-timestep simulation, keyboard input and interpolated rendering.

### M2 — Ship Movement Tuning

The ship uses acceleration of `200`, rotation speed of `3` radians per second, drag of `0.99` per 60 Hz step (adjusted for `dt`), and a maximum speed of `300`. Acceleration increases velocity in the ship’s facing direction, drag gradually slows it down, and the speed cap prevents unlimited acceleration. These settings balance responsiveness and controllability. The exact sequence of tuning changes was not recorded.

### M4 — Experiments
#### Experiment 1 — Blocking the Main Thread
**Setup:** Added a synchronous busy-wait of 100 ms every 60 frames inside the render function.

**Observations:**

- The game visibly freezes during the blocking operation.

- Rendering is interrupted while JavaScript is busy.

- Frame duration increases significantly after the block.

- FPS temporarily decreases.

**Conclusion:**

JavaScript executes synchronously on the main thread. While a function is running, other JavaScript tasks and rendering callbacks cannot execute on that thread. Therefore, a 100 ms synchronous operation cannot be worked around by another JavaScript callback running on the same thread.

#### Experiment 2 — requestAnimationFrame vs setInterval
**Using setInterval (16 ms):**

- FPS: approximately 62–63.

- Frame duration: 15–17 ms.

- In background tab: FPS dropped to 1, then gradually returned to 30 and 62.

- Observation: setInterval is not synchronized with the monitor refresh rate and is throttled when the tab is in the background.

#### Experiment 3 — Fixed vs. Variable Timestep Under CPU Throttling

**Setup:** Compared the original fixed 60 Hz accumulator loop against a temporary variable-timestep loop calling `simulate(dt)` once per frame. The ship's thrust input was automated, and its X position was logged after approximately 5 real seconds using `performance.now()`. Each run started with the ship at `(400, 250)`. Chrome DevTools Performance CPU throttling was set to either `No throttling` or `6× slowdown`.

**Measured results:**

| Simulation | Normal CPU: X | CPU 6×: X | Absolute difference |
|---|---:|---:|---:|
| Fixed timestep | 731.29 | 736.29 | 5.00 px |
| Variable timestep | 727.47 | 735.58 | 8.11 px |

**Conclusion:** The fixed-timestep run showed a smaller difference between CPU settings in this measurement. Both methods produced similar final positions, so these results do not establish a large degradation of variable timestep under 6× throttling. The original fixed-timestep loop was restored after the experiment.

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

#### Homing behavior
Homing is implemented as a separate behavior in `sim/behaviors/homing.js`. Any entity can receive a `homing` configuration containing a target ID and turn rate. The `World` applies this behavior during each update.

This allows both bullets and asteroids to use homing without requiring specialized subclasses.

#### Pickups
Pickups are implemented as independent `Entity` objects. They have their own type and collision behavior, while the ship handles the effects through `applyPickup()`.

Two pickup types were implemented:

- **Shield:** prevents damage for 5 seconds.

- **Rapid Fire:** reduces the shooting cooldown for 5 seconds.

#### Design comparison
With inheritance, each behavior could require additional subclasses, such as `HomingAsteroid`, `HomingBullet`, or specialized pickup classes. This can lead to a rigid and increasingly complex class hierarchy.

Composition keeps behaviors independent and allows them to be attached to different entities. This makes the system more flexible, reusable, and easier to extend.

## Lab 03 — Asynchronous JavaScript
### M1 — Asset Pipeline and Loading Screen
#### Asset Manifest
Created `src/assets/manifest.json` to define the game's sprites, sounds and arena configuration.

#### Asset Loader
Implemented `src/assets/loader.js` with the following functions:

- `fetchJson()` checks the HTTP response status and throws an error when the request fails.

- `loadJson()` loads JSON resources.

- `loadImage()` loads images with `new Image()` and handles load, error and abort events.

- `loadAudio()` fetches audio files and decodes them using Web Audio.

- `withRetry()` retries transient failures using exponential backoff and jitter, without retrying HTTP 4xx errors.

- `loadAll()` loads all manifest resources concurrently using `Promise.all()`.

All loading functions support `AbortSignal` where applicable.

#### Loading Screen
- Added a loading screen rendered directly on the Canvas.

- Implemented a progress bar based on completed assets.

- The game starts only after `loadAll()` completes successfully.

- Added a cancellation button using `AbortController`.

- Added a retry button for failed or cancelled loading attempts.

- Aborted pending requests when loading fails or is cancelled.

#### Tests and Results
**Concurrent loading**

Tested `loadAll()` with three simulated resources, each taking approximately 200 ms.

- Maximum simultaneous requests: 3.

- All three resources completed successfully.

- Progress callbacks reported 0%, 33%, 67% and 100%.

**Retry and error handling**

- Simulated temporary HTTP 500 failures.

- Confirmed that the loader retries and succeeds on the third attempt.

- Confirmed that HTTP 404 errors are not retried.

- Verified that failed loading displays the retry button.

**Cancellation**

- Tested cancellation using `AbortController`.

- Confirmed that the request rejects with `AbortError`.

- Tested cancellation through the loading screen.

- Confirmed that the game does not start after cancellation and that the retry option appears.

**Sequential vs. concurrent execution**

Compared three simulated asynchronous operations, each taking approximately 200 ms.

| Execution method | Measured time |
|---|---:|
| Sequential (`fetchJson`) | 623 ms |
| Concurrent (`Promise.all`) | 212 ms |

The test used three independent JSON requests with an artificial 200 ms delay per request. Concurrent execution completed approximately 2.9 times faster than sequential execution.

**Conclusion**

`Promise.all()` allows independent asynchronous operations to run concurrently instead of waiting for each operation to finish before starting the next one. The asset loader uses this approach to reduce total loading time while reporting progress and handling failures.

### M2 — Sprites, Sound, and Events

Ships, bullets, and asteroids render using the loaded sprite sheet. The `audio.js` module manages `AudioContext`, plays decoded buffers for shooting, hits, and explosions, and unlocks audio after a click or key press during gameplay. The simulation emits `fired`, `hit`, and `exploded` events; the audio module subscribes without being imported by the simulation. `hud.js` listens for score updates.

### M3 — Lobby over HTTP

The lobby fetches the room list from `/api/rooms.json`, lets the player enter a name and select a room, then starts the local game using the selected room's arena. `Lobby extends EventTarget`, while `lobby-ui.js` handles the DOM. The lobby refreshes every 5 seconds, uses `AbortSignal.timeout(5000)` for each room request, and aborts pending requests on leaving. Joining a room was tested successfully.

### M4 — Failure Gallery

| Failure | Test and observed result | Recovery |
|---|---|---|
| Missing sprite (HTTP 404) | Changed a sprite path to a nonexistent file. The loading screen displayed `Falha ao carregar os recursos. Tente novamente.` and the retry button. HTTP 404 is not retried by `withRetry()`. | Restored the path; the game loaded normally. |
| Network timeout (simulated) | A simulated `TimeoutError: Network timeout` caused `withRetry()` to make 3 attempts before rejecting. A separate temporary `TimeoutError` thrown at the start of `loadAll()` displayed the loading error and retry button. | Removed the temporary throw; the game loaded normally. |
| Abort mid-load | Under Slow 3G, clicked `Cancelar carregamento`. The screen displayed `Carregamento cancelado.` and the retry button. | Restored No throttling and clicked `Tentar novamente`; the game loaded without refreshing the page. |
| Corrupt JSON | Temporarily added a trailing comma to `arena.json`. JSON parsing failed and the loading screen displayed the error message. A separate invalid-JSON test returned `SyntaxError`. | Restored valid JSON; the game loaded normally. |

The timeout tests used simulated exceptions, **not a real stalled network request**. The asset loader retries thrown timeout errors but does not impose its own request deadline; the 5-second timeout in `lobby.js` applies to room-list requests.

### M4 — Microtasks and Tasks
This milestone explores JavaScript's event loop and the execution order of synchronous code, microtasks and tasks.

#### Challenge 1 — Synchronous Code, Promises and queueMicrotask
**Code:**

```javascript

console.log('A')

setTimeout(() => {

    console.log('B')

}, 0)

Promise.resolve().then(() => {

    console.log('C')

})

queueMicrotask(() => {

    console.log('D')

})

console.log('E')

```

**Observed output:**

```text

A → E → C → D → B

```

**Explanation:**

- A and E execute synchronously.

- C and D are microtasks.

- B is a task scheduled by setTimeout.

- Microtasks execute before the next task.

#### Challenge 2 — Nested Promises and setTimeout
**Code:**

```javascript

console.log('A')

Promise.resolve().then(() => {

    console.log('B')

    setTimeout(() => {

        console.log('C')

    }, 0)

    Promise.resolve().then(() => {

        console.log('D')

    })

})

setTimeout(() => {

    console.log('E')

}, 0)

console.log('F')

```

**Observed output:**

```text

A → F → B → D → E → C

```

**Explanation:**

- A and F execute synchronously.

- B executes as a Promise microtask.

- During B, two callbacks are scheduled: C as a task and D as a microtask.

- D executes before the next task.

- E executes before C because its timer was scheduled first.

#### Challenge 3 — async/await
**Code:**

```javascript

async function teste() {

    console.log('B')

    await Promise.resolve()

    console.log('D')

}

console.log('A')

teste()

console.log('C')

setTimeout(() => {

    console.log('E')

}, 0)

```

**Observed output:**

```text

A → B → C → D → E

```

**Explanation:**

- A executes synchronously.

- B executes immediately when the async function is called.

- C executes before the async function resumes.

- D executes as a microtask after the await.

- E executes as a task scheduled by setTimeout.

#### Challenge 4 — requestAnimationFrame and Promises
**Code:**

```javascript

console.log('A')

requestAnimationFrame(() => {

    console.log('B')

    Promise.resolve().then(() => {

        console.log('C')

    })

})

setTimeout(() => {

    console.log('D')

}, 0)

Promise.resolve().then(() => {

    console.log('E')

})

console.log('F')

```

**Observed output:**

```text

A → F → E → D → B → C

```

**Explanation:**

- A and F execute synchronously.

- E executes as a microtask.

- D executes through setTimeout.

- B executes during a requestAnimationFrame callback before a browser repaint.

- C executes as a microtask created inside the animation frame callback.

The relative order of requestAnimationFrame and setTimeout callbacks can vary depending on browser scheduling. The sequence above is the one observed during this experiment.

#### Challenge 5 — Combined Async Execution
**Code:**

```javascript

console.log('A')

setTimeout(() => {

    console.log('B')

    Promise.resolve().then(() => {

        console.log('C')

    })

}, 0)

Promise.resolve().then(async () => {

    console.log('D')

    await null

    console.log('E')

})

queueMicrotask(() => {

    console.log('F')

})

console.log('G')

```

**Observed output:**

```text

A → G → D → F → E → B → C

```

**Explanation:**

- A and G execute synchronously.

- D executes as the first microtask.

- F executes as the next microtask.

- E executes when the async function resumes after await.

- B executes as a task scheduled by setTimeout.

- C executes as a microtask created inside the setTimeout callback.

#### Conclusion
These experiments demonstrate the difference between synchronous execution, microtasks and tasks.

Promises, async/await and queueMicrotask use the microtask queue, while setTimeout schedules tasks. requestAnimationFrame schedules callbacks associated with the browser's rendering cycle.

Understanding this execution order is important when working with asynchronous operations, animations and game loops.

### M3 — Streams and Backpressure

A synthetic 200 MiB NDJSON file was streamed through the replay endpoint using a download rate limit of 5 MiB/s.

The server's resident set size (RSS) was sampled approximately once per second during the transfer.

**Results:**

| Metric | Result |
|---|---:|
| File size | 200 MiB |
| Download rate limit | 5 MiB/s |
| Duration | ~40 seconds |
| RSS samples | 40 |
| Minimum RSS | 58.38 MB |
| Average RSS | 67.85 MB |
| Maximum RSS | 82.49 MB |

**Memory Usage Graph**

![Server RSS during throttled replay](docs/lab04-m3-rss.png)

**Conclusion**

Memory usage fluctuated between 58.38 MB and 82.49 MB without sustained growth during the transfer.

The streaming implementation transferred the large file without loading it entirely into memory, demonstrating memory-efficient processing with Node.js streams and backpressure.

### M4 — Abuse Handling and the Event Loop

#### Abuse Handling

Implemented the following server protections:

- **Rate limiting:** Per-connection token bucket allowing 10 messages per second, with a burst capacity of 10. Connections exceeding the limit are closed.
- **Payload limit:** WebSocket messages are limited to 4 KiB using `maxPayload`.
- **Room limits:** Maximum of 8 players per room and 10 rooms per server.
- **Slow clients:** When `socket.bufferedAmount` exceeds 64 KiB, non-critical chat messages are dropped and critical updates trigger connection closure.

#### Node.js Event Loop

The Node.js event loop processes asynchronous operations through several phases:

1. **Timers:** Executes callbacks scheduled by `setTimeout()` and `setInterval()`.
2. **Pending callbacks:** Executes certain deferred I/O callbacks.
3. **Idle/prepare:** Internal Node.js operations.
4. **Poll:** Processes I/O events, including network activity.
5. **Check:** Executes `setImmediate()` callbacks.
6. **Close callbacks:** Handles events such as socket closure.

Microtasks, including Promise callbacks, are processed at appropriate checkpoints between JavaScript callbacks.

**Blocking experiment**

Implemented `/api/slow` with a deliberate synchronous busy-loop lasting 300 ms.

The endpoint returned:

```json
{"message":"Blocking operation completed","durationMs":300}
```

During a synchronous block, Node.js cannot process other JavaScript callbacks, including incoming WebSocket chat messages.

A temporary 30-second block made the delay clearly observable. The endpoint was then restored to the required 300 ms.

#### Backpressure

Backpressure occurs when data is produced faster than it can be consumed.

In M3, streams used `pipeline()` to manage data flow between the source, transformation, and destination.

A synthetic 200 MiB NDJSON file was downloaded with a rate limit of 5 MiB/s.

The server's RSS remained between 58.38 MB and 82.49 MB, without sustained growth during the approximately 40-second transfer.

This demonstrated memory-efficient streaming without buffering the entire file.

#### Unhandled Errors and Rejections

**Unhandled EventEmitter error**

Emitting an `"error"` event without a listener caused Node.js to throw an exception:

```text
node:events:505
    throw er; // Unhandled 'error' event

Error: boom
Emitted 'error' event at:
```

Adding an error listener prevented the crash:

```javascript
emitter.on('error', (error) => {
    console.error('Handled:', error.message);
});
```

Output:

```text
Handled: boom
```

**Unhandled Promise rejection**

An unhandled rejection, executed with `--unhandled-rejections=strict`, terminated the process:

```text
Error: Unhandled rejection demo
    at [eval]:1:16

Node.js v26.13.1
```

Handling the rejection with `.catch()` prevented the crash:

```javascript
Promise.reject(new Error('Rejection demo'))
    .catch((error) => {
        console.error('Handled:', error.message);
    });
```

Output:

```text
Handled: Rejection demo
```

These experiments demonstrate why EventEmitter error listeners and Promise rejection handlers are necessary for reliable Node.js servers.

## Technologies
- JavaScript (ES Modules)

- HTML5 Canvas

- Vite

- ESLint

- Prettier