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

export function drawHud(ctx, stats, score) {
    ctx.save();

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText(`FPS: ${stats.fps}`, 10, 20);
    ctx.fillText(`Frame: ${(stats.frameDuration ?? 0).toFixed(1)} ms`, 10, 40);
    ctx.fillText(`Score: ${score}`, 10, 60);

    ctx.restore();
}

export function drawBullet(ctx, bullet) {
    ctx.save();

    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(bullet.pos.x, bullet.pos.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}


export function drawAsteroid(ctx, asteroid) {
    ctx.save();

    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(
        asteroid.pos.x,
        asteroid.pos.y,
        asteroid.radius,
        0,
        Math.PI * 2
    );
    ctx.stroke();

    ctx.restore();
}

export function drawExplosion(ctx, explosion) {
    for (const particle of explosion.particles) {
        const alpha = particle.ttl / particle.maxTtl;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff9933';

        ctx.beginPath();
        ctx.arc(
            particle.pos.x,
            particle.pos.y,
            2,
            0,
            Math.PI * 2
        );

        ctx.fill();
        ctx.restore();
    }
}

export function drawPickup(ctx, pickup) {
    ctx.save();

    ctx.fillStyle = pickup.type === 'shield' ? '#3498db' : '#f1c40f';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(
        pickup.pos.x,
        pickup.pos.y,
        pickup.radius,
        0,
        Math.PI * 2
    );

    ctx.fill();
    ctx.stroke();

    ctx.restore();
}