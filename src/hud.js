
import { gameEvents } from './events.js'

export function createHud() {
    let score = 0

    gameEvents.addEventListener('scoreChanged', event => {
        score = event.detail
    })

    return {
        get score() {
            return score
        }
    }
}
