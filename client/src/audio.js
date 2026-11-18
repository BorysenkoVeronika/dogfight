
import { gameEvents } from './events.js'

export function createAudio() {
    const ctx = new AudioContext()
    let sounds = {}

    function setSounds(loadedSounds) {
        sounds = loadedSounds
    }

    function unlock() {
        if (ctx.state === 'suspended') {
            ctx.resume()
        }
    }

    function play(name) {
        const buffer = sounds[name]

        if (!buffer || ctx.state !== 'running') return

        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)
        source.start()
    }

    gameEvents.addEventListener('fired', () => play('shoot'))
    gameEvents.addEventListener('hit', () => play('hit'))
    gameEvents.addEventListener('exploded', () => play('explosion'))

    return {
        ctx,
        setSounds,
        unlock,
        play
    }
}
