import './style.css'
import { gameEvents } from './events.js';
import manifest from './assets/manifest.json'
import { loadAll } from './assets/loader.js'
import { createLoop } from './loop.js'
import { createInput } from './input.js'
import { createCanvas } from './render/canvas.js'
import { createAudio } from './audio.js'
import { Lobby } from './lobby.js'
import { createLobbyUI, createMatchUI } from './lobby-ui.js'
import { createConnection } from './connection.js'
import { createNetcode } from './netcode.js'
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
  const net = createNetcode()

  const panel = document.createElement('section')
  panel.className = 'network-panel'
  panel.innerHTML = `
    <fieldset><legend>Network simulation</legend>
      <label>Latency (ms) <input id="net-latency" type="number" min="0" max="1000" value="0"></label>
      <label>Jitter (ms) <input id="net-jitter" type="number" min="0" max="500" value="0"></label>
      <label>Drop (%) <input id="net-drop" type="number" min="0" max="100" value="0"></label>
      <label>Interpolation (ms) <input id="net-interpolation" type="number" min="0" max="300" value="100"></label>
      <label><input id="net-prediction" type="checkbox" checked> Client prediction</label>
      <label><input id="net-break" type="checkbox"> Break determinism (M2 demonstration)</label>
    </fieldset>
    <pre id="netgraph"></pre>
  `
  matchElement.append(panel)
  const control = id => panel.querySelector(`#${id}`)
  function configureNetwork() {
    connection.send({
      type: 'networkConfig',
      latency: Number(control('net-latency').value),
      jitter: Number(control('net-jitter').value),
      drop: Number(control('net-drop').value),
    })
  }
  for (const name of ['net-latency', 'net-jitter', 'net-drop']) control(name).addEventListener('change', configureNetwork)
  control('net-interpolation').addEventListener('input', e => net.setInterpolationDelay(Number(e.target.value)))
  control('net-prediction').addEventListener('change', e => net.setPrediction(e.target.checked))
  control('net-break').addEventListener('change', e => net.setDeterminismBroken(e.target.checked))
  connection.on('open', configureNetwork)
  // If the connection opened during asset loading, its configuration defaults to zero.

  let lastPingAt = 0
  let rtt = 0
  let lastTrafficAt = performance.now()
  let lastTraffic = connection.traffic()
  let downKib = 0, upKib = 0
  connection.on('pong', msg => { rtt = performance.now() - msg.sentAt })
  connection.on('snapshot', snapshot => {
    if (!net.onSnapshot(snapshot)) return
    for (const event of snapshot.events ?? []) {
      gameEvents.dispatchEvent(new CustomEvent(event.type, {detail: event.detail}))
    }
  })

  const loop = createLoop({
    step: 1 / 30,
    simulate() {
      const now = performance.now()
      if (now - lastPingAt >= 1000) {
        lastPingAt = now
        connection.send({type: 'ping', sentAt: now})
      }
      if (net.playerId) {
        const turn = Number(input.isDown('ArrowRight')) - Number(input.isDown('ArrowLeft'))
        connection.send({type: 'input', ...net.step({
          thrust: input.isDown('ArrowUp'), turn, fire: input.isDown('Space')
        }, now)})
      }
      input.endFrame()
    },
    render(alpha, stats) {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const now = performance.now()
      ctx.clearRect(0, 0, width, height)
      drawStars(ctx, width, height)
      for (const entity of net.render(now, Math.max(0.001, stats.lastFrameDuration / 1000))) {
        const object = {...entity, pos: {x: entity.x, y: entity.y}, type: entity.pickupType}
        if (entity.kind === 'ship') drawShip(ctx, object, assets.sprites.game)
        else if (entity.kind === 'bullet') drawBullet(ctx, object, assets.sprites.game)
        else if (entity.kind === 'asteroid') drawAsteroid(ctx, object, assets.sprites.game)
        else if (entity.kind === 'pickup') drawPickup(ctx, object)
      }
      const metrics = net.metrics(now)
      drawHud(ctx, stats, metrics.score)
      if (now - lastTrafficAt >= 1000) {
        const traffic = connection.traffic()
        const seconds = (now - lastTrafficAt) / 1000
        downKib = (traffic.receivedBytes - lastTraffic.receivedBytes) / 1024 / seconds
        upKib = (traffic.sentBytes - lastTraffic.sentBytes) / 1024 / seconds
        lastTraffic = traffic
        lastTrafficAt = now
      }
      control('netgraph').textContent = [
        `Codec: ${connection.traffic().codec}`,
        `RTT: ${rtt.toFixed(1)} ms`,
        `Snapshot age: ${metrics.snapshotAge.toFixed(1)} ms`,
        `Down: ${downKib.toFixed(2)} KiB/s | Up: ${upKib.toFixed(2)} KiB/s`,
        `Pending inputs: ${metrics.pending}`,
        `Reconciliation correction: ${metrics.correction.toFixed(2)} px`,
        `Interpolation delay: ${metrics.interpolationDelay} ms`,
        `Server tick: ${metrics.serverTick}`,
      ].join('\n')
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