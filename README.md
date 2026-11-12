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
