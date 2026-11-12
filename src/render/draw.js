export function drawShip(ctx, ship) {
    ctx.save();

    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.stroke();

    if (ship.thrust) {
        ctx.strokeStyle = '#ff9900';

        ctx.beginPath();
        ctx.moveTo(-7, -4);
        ctx.lineTo(-17, 0);
        ctx.lineTo(-7, 4);
        ctx.stroke();
    }

    ctx.restore();
}

export function drawStars(ctx, width, height) {
    ctx.fillStyle = '#ffffff';

    for (let i = 0; i < 80; i++) {
        const x = (i * 137.5) % width;
        const y = (i * 97.3) % height;

        ctx.fillRect(x, y, 2, 2);
    }
}

export function drawHud(ctx, stats) {
    ctx.save();

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';

    ctx.fillText(`Steps/s: ${stats.stepsPerSecond.toFixed(0)}`, 10, 20);
    ctx.fillText(`Frames/s: ${stats.framesPerSecond.toFixed(0)}`, 10, 40);
    ctx.fillText(`Frame duration: ${stats.lastFrameDuration.toFixed(2)} ms`, 10, 60);

    ctx.restore();
}