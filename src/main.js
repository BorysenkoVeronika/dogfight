import './style.css'
import { createLoop } from './loop.js'
import { createInput } from './input.js'
import { createShip, integrate } from './sim/ship.js'
import { wrap } from './sim/arena.js'
import { createCanvas } from './render/canvas.js'
import { drawShip, drawStars, drawHud } from './render/draw.js'

document.querySelector('#app').innerHTML = `
  <main>
    <h1>Dogfight</h1>
    <canvas id="game"></canvas>
  </main>
`
const input = createInput(window)
let ship = createShip(400, 250)

const canvas = document.querySelector('#game')
const { ctx } = createCanvas(canvas)

let previousShip = { ...ship }


const loop = createLoop({
  simulate(dt) {
    previousShip = { ...ship }

    ship = integrate(ship, input, dt)
    ship = wrap(ship, canvas.clientWidth, canvas.clientHeight)

    input.endFrame()
  },

render(alpha, stats) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    ctx.clearRect(0, 0, width, height)
    drawStars(ctx, width, height)

    const interpolatedShip = {
        ...ship,
        x: previousShip.x + (ship.x - previousShip.x) * alpha,
        y: previousShip.y + (ship.y - previousShip.y) * alpha,
        angle:
            previousShip.angle +
           Math.atan2(
                Math.sin(ship.angle - previousShip.angle),
                Math.cos(ship.angle - previousShip.angle)
           ) * alpha,
    }

    drawShip(ctx, interpolatedShip)
    drawHud(ctx, stats)
},
})

loop.start()