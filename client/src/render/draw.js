export function drawShip(ctx, ship, sprite) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle + Math.PI / 2);

    if (sprite) {
        ctx.drawImage(sprite, 0, 0, 64, 64, -ship.radius, -ship.radius, ship.radius * 2, ship.radius * 2);
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
    ctx.fillText(`FPS: ${stats.framesPerSecond.toFixed(0)}`, 10, 20);
    ctx.fillText(`Frame: ${stats.lastFrameDuration.toFixed(1)} ms`, 10, 40);
    ctx.fillText(`Score: ${score}`, 10, 60);

    ctx.restore();
}


export function drawBullet(ctx, bullet, sprite) {
    ctx.save();
    ctx.translate(bullet.pos.x, bullet.pos.y);
    ctx.rotate((bullet.angle ?? 0) + Math.PI / 2);

    if (sprite) {
        const size = bullet.radius * 4;
        ctx.drawImage(sprite, 64, 0, 64, 64, -size / 2, -size / 2, size, size);
    }

    ctx.restore();
}


export function drawAsteroid(ctx, asteroid, sprite) {
    ctx.save();
    ctx.translate(asteroid.pos.x, asteroid.pos.y);

    if (sprite) {
        const size = asteroid.radius * 2;
        ctx.drawImage(sprite, 128, 0, 64, 64, -size / 2, -size / 2, size, size);
    }

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