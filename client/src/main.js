import './style.css'
import manifest from './assets/manifest.json'
import { loadAll } from './assets/loader.js'
import { createLoop } from './loop.js'
import { createInput } from './input.js'
import { Ship } from './sim/ship.js'
import { wrap } from './sim/arena.js'
import { createCanvas } from './render/canvas.js'
import { World } from './sim/world.js'
import { Asteroid } from './sim/asteroid.js'
import { Vector2 } from './sim/vector.js'
import { Pickup } from './sim/pickup.js'
import { createAudio } from './audio.js'
import { createHud } from './hud.js'
import { Lobby } from './lobby.js'
import { createLobbyUI, createMatchUI } from './lobby-ui.js'
import { createConnection } from './connection.js'
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

    <section id="lobby"></section>
    <section id="match-ui" hidden></section>

    <div id="loading-controls" hidden>
      <p id="loading-status">Preparing assets...</p>
      <button id="cancel-button">Cancel Loading</button>
      <button id="retry-button" hidden>Retry</button>
    </div>

    <canvas id="game" hidden></canvas>
  </main>
`


const canvas = document.querySelector('#game')
const { ctx, resize } = createCanvas(canvas)
const audio = createAudio()


const lobbyElement = document.querySelector('#lobby')
const matchElement = document.querySelector('#match-ui')
const lobby = new Lobby()

let selectedRoom = null
let connection = null

createLobbyUI(lobby, lobbyElement, ({ playerName, room }) => {
  lobby.stop()
  lobbyElement.hidden = true
  matchElement.hidden = false
  canvas.hidden = false

  // Preserve the local arena from Lab 03.
  selectedRoom = {
    ...room,
    arena: { width: 800, height: 500 }
  }

  canvas.style.aspectRatio = '800 / 500'
  resize()

  connection = createConnection()
  createMatchUI(matchElement, connection)

  connection.on('open', () => {
    connection.send({
      type: 'join',
      roomId: room.id,
      playerName
    })
  })

  connection.on('failed', () => {
    const status = matchElement.querySelector('#connection-status')
    status.textContent = 'Unable to join room. Please reload and try again.'
  })

  connection.connect()

  loadingControls.hidden = false
  loadGame(selectedRoom)
})

window.addEventListener('beforeunload', () => {
  connection?.disconnect()
})

lobby.start()


const loadingControls = document.querySelector('#loading-controls')
const loadingStatus = document.querySelector('#loading-status')
const retryButton = document.querySelector('#retry-button')
const cancelButton = document.querySelector('#cancel-button')

let loadingController = null

function drawLoadingScreen(progress) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#252525'
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '20px Arial'
  ctx.fillText('Loading Dogfight...', width / 2, height / 2 - 35)

  const barWidth = Math.min(320, width - 48)
  const barHeight = 14
  const x = (width - barWidth) / 2
  const y = height / 2

  ctx.fillStyle = '#555555'
  ctx.fillRect(x, y, barWidth, barHeight)

  ctx.fillStyle = '#3498db'
  ctx.fillRect(x, y, barWidth * progress, barHeight)

  ctx.font = '14px Arial'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`${Math.round(progress * 100)}%`, width / 2, y + 35)
}

function startGame(assets) {
  loadingControls.hidden = true

  const input = createInput(window)
  window.addEventListener('keydown', audio.unlock)
  window.addEventListener('click', audio.unlock)

  const world = new World()
  const hud = createHud()

  let ship = world.spawn(new Ship(400, 250))
  let respawnTimer = null

  const asteroid = world.spawn(
    new Asteroid(
      new Vector2(200, 150),
      new Vector2(60, 40),
      25,
      canvas.clientWidth,
      canvas.clientHeight
    )
  )

  asteroid.homing = {
    targetId: ship.id,
    turnRate: 1.5
  }

  world.spawn(new Pickup(300, 200, 'shield'))
  world.spawn(new Pickup(500, 350, 'rapid-fire'))

  let previousShip = { ...ship }

  const loop = createLoop({
    simulate(dt) {
      previousShip = { ...ship }

      if (input.isDown('Space')) {
        ship.fire(world)
      }

      world.step(dt, input)

      if (!ship.alive && respawnTimer === null) {
        respawnTimer = 2
      }

      if (respawnTimer !== null) {
        respawnTimer -= dt

        if (respawnTimer <= 0) {
          for (let attempt = 0; attempt < 100; attempt++) {
            const x = ship.radius + Math.random() * (canvas.clientWidth - ship.radius * 2)
            const y = ship.radius + Math.random() * (canvas.clientHeight - ship.radius * 2)

            const safe = [...world.ofKind('asteroid')].every(asteroid => {
              const dx = x - asteroid.pos.x
              const dy = y - asteroid.pos.y
              const minDistance = ship.radius + asteroid.radius + 30

              return dx * dx + dy * dy > minDistance * minDistance
            })

            if (safe) {
              ship = world.spawn(new Ship(x, y))
              respawnTimer = null
              break
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

      drawShip(ctx, interpolatedShip, assets.sprites.game);

      for (const bullet of world.ofKind('bullet')) {
        drawBullet(ctx, bullet, assets.sprites.game);
      }

      for (const asteroid of world.ofKind('asteroid')) {
        drawAsteroid(ctx, asteroid, assets.sprites.game);
      }

      for (const pickup of world.ofKind('pickup')) {
        drawPickup(ctx, pickup)
      }

      for (const explosion of world.ofKind('explosion')) {
        drawExplosion(ctx, explosion)
      }

      drawHud(ctx, stats, hud.score)
    },
  })

  loop.start()
}

async function loadGame(room) {
  retryButton.hidden = true
  cancelButton.hidden = false
  loadingStatus.textContent = 'Loading resources...'

  const controller = new AbortController()
  loadingController = controller

  drawLoadingScreen(0)

  try {
    const assetManifest = {
      ...manifest,
      arena: new URL('./assets/arena.json', import.meta.url).href
    }

    const assets = await loadAll(assetManifest, {
      ctx: audio.ctx,
      signal: controller.signal,
      onProgress(progress, completed, total) {
        drawLoadingScreen(progress)
        loadingStatus.textContent =
          `Loading resources: ${completed}/${total}`
      }
    })

    assets.arena = room.arena

    audio.setSounds(assets.sounds)

    cancelButton.hidden = true
    loadingController = null

    startGame(assets)
  } catch (error) {
    controller.abort()

    if (loadingController === controller) {
      loadingController = null
    }

    console.error('Error loading resources:', error)

    cancelButton.hidden = true

    if (error.name === 'AbortError') {
      loadingStatus.textContent = 'Loading canceled.'
    } else {
      loadingStatus.textContent =
        'Failed to load assets. Please try again.'
    }

    retryButton.hidden = false
  }
}

cancelButton.addEventListener('click', () => {
  loadingStatus.textContent = 'Canceling loading...'
  loadingController?.abort()
})

retryButton.addEventListener('click', () => loadGame(selectedRoom))