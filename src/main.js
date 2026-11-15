import './style.css'
import { createLoop } from './loop.js'
import { createInput } from './input.js'
import { Ship } from './sim/ship.js'
import { wrap } from './sim/arena.js'
import { createCanvas } from './render/canvas.js'
import { World } from './sim/world.js'
import { Asteroid } from './sim/asteroid.js'
import { Vector2 } from './sim/vector.js'
import { Pickup } from './sim/pickup.js'
import {
  drawShip,
  drawStars,
  drawHud,
  drawBullet,
  drawAsteroid,
  drawExplosion,
  drawPickup
} from './render/draw.js'

document.querySelector('#app').innerHTML = `
  <main>
    <h1>Dogfight</h1>
    <canvas id="game"></canvas>
  </main>
`
const input = createInput(window)
const world = new World()

let ship = world.spawn(new Ship(400, 250))
let respawnTimer = null

const canvas = document.querySelector('#game')
const { ctx } = createCanvas(canvas)

const asteroid = world.spawn(
  new Asteroid(
    new Vector2(200, 150),
    new Vector2(60, 40),
    25,
    canvas.clientWidth,
    canvas.clientHeight
  )
);

asteroid.homing = {
  targetId: ship.id,
  turnRate: 1.5
};

world.spawn(new Pickup(300, 200, 'shield'));
world.spawn(new Pickup(500, 350, 'rapid-fire'));

let previousShip = { ...ship }


const loop = createLoop({

  simulate(dt) {
    previousShip = { ...ship }

    if (input.isDown('Space')) {
      ship.fire(world);
    }

    world.step(dt, input)

    if (!ship.alive && respawnTimer === null) {
      respawnTimer = 2;
    }

    if (respawnTimer !== null) {
      respawnTimer -= dt;

      if (respawnTimer <= 0) {
        for (let attempt = 0; attempt < 100; attempt++) {
          const x = ship.radius + Math.random() * (canvas.clientWidth - ship.radius * 2);
          const y = ship.radius + Math.random() * (canvas.clientHeight - ship.radius * 2);

          const safe = [...world.ofKind('asteroid')].every(asteroid => {
            const dx = x - asteroid.pos.x;
            const dy = y - asteroid.pos.y;
            const minDistance = ship.radius + asteroid.radius + 30;

            return dx * dx + dy * dy > minDistance * minDistance;
          });

          if (safe) {
            ship = world.spawn(new Ship(x, y));
            respawnTimer = null;
            break;
          }
        }
      }
    }

    wrap(ship, canvas.clientWidth, canvas.clientHeight)

    input.endFrame()
  },

  render(alpha, stats) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    ctx.clearRect(0, 0, width, height)
    drawStars(ctx, width, height)

    const interpolatedShip = {
      ...ship,
      x: previousShip.pos.x + (ship.pos.x - previousShip.pos.x) * alpha,
      y: previousShip.pos.y + (ship.pos.y - previousShip.pos.y) * alpha,
      angle:
        previousShip.angle +
        Math.atan2(
          Math.sin(ship.angle - previousShip.angle),
          Math.cos(ship.angle - previousShip.angle)
        ) * alpha,
    }

    drawShip(ctx, interpolatedShip)

    for (const bullet of world.ofKind('bullet')) {
      drawBullet(ctx, bullet)
    }

    for (const asteroid of world.ofKind('asteroid')) {
      drawAsteroid(ctx, asteroid)
    }

    for (const pickup of world.ofKind('pickup')) {
      drawPickup(ctx, pickup);
    }

    for (const explosion of world.ofKind('explosion')) {
      drawExplosion(ctx, explosion)
    }

    drawHud(ctx, stats, world.score)
  },
})

loop.start()