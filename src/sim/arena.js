export function wrap(ship, width, height) {
    return {
        ...ship,
        x: ((ship.x % width) + width) % width,
        y: ((ship.y % height) + height) % height,
    };
}