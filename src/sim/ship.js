export function createShip(x = 400, y = 250) {
    return {
        x,
        y,
        vx: 0,
        vy: 0,
        angle: 0,
        thrust: false,
    };
}

export function integrate(ship, input, dt) {
    const rotationSpeed = 3;
    const acceleration = 200;
    const drag = 0.99;
    const maxSpeed = 300;

    let angle = ship.angle;

    if (input.isDown('ArrowLeft')) {
        angle -= rotationSpeed * dt;
    }

    if (input.isDown('ArrowRight')) {
        angle += rotationSpeed * dt;
    }

    const thrust = input.isDown('ArrowUp');

    let vx = ship.vx;
    let vy = ship.vy;

    if (thrust) {
        vx += Math.cos(angle) * acceleration * dt;
        vy += Math.sin(angle) * acceleration * dt;
    }

    vx *= Math.pow(drag, dt * 60);
    vy *= Math.pow(drag, dt * 60);

    const speed = Math.hypot(vx, vy);

    if (speed > maxSpeed) {
        vx = (vx / speed) * maxSpeed;
        vy = (vy / speed) * maxSpeed;
    }

    return {
        x: ship.x + vx * dt,
        y: ship.y + vy * dt,
        vx,
        vy,
        angle,
        thrust,
    };
}