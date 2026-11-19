import { Ship } from '@dogfight/shared/sim/ship';
import { inputAdapter } from '@dogfight/shared/sim/input';
import { wrap } from '@dogfight/shared/sim/arena';
import { Vector2 } from '@dogfight/shared/sim/vector';

const STEP = 1 / 30;
const ARENA = {width: 800, height: 500};
const angleBlend = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const lerp = (a, b, t) => a + (b - a) * t;

// Independent client render state; server snapshots remain the only authority.
export function createNetcode() {
    let playerId = null;
    let ownId = null;
    let predicted = null;
    let visual = null;
    let seq = 0;
    let clientTick = 0;
    let acknowledged = -1;
    let correction = 0;
    let inputQueue = [];
    let history = [];
    let lastArrival = 0;
    let previousTick = -1;
    let serverTick = 0;
    let interpolationDelay = 100;
    let predictionEnabled = true;
    let determinismBroken = false;
    let predictedBullets = [];
    let localFireCooldown = 0;
    let score = 0;
    let seed = 12345;
    const correctionHistory = [];

    function makeShip(e) { return Ship.fromSnapshot(e); }
    function apply(ship, input) {
        ship.update(STEP, inputAdapter(input));
        wrap(ship, ARENA.width, ARENA.height);
        // Deliberate divergence, only for the required M2 experiment.
        if (determinismBroken) ship.pos.x += Math.random() * 0.5;
    }
    function onSnapshot(snapshot, arrival = performance.now()) {
        if (snapshot.tick <= previousTick) return false;
        previousTick = snapshot.tick;
        serverTick = snapshot.tick;
        lastArrival = arrival;
        playerId = snapshot.playerId;
        seed = snapshot.seed ?? seed;
        score = snapshot.score ?? score;
        for (const event of snapshot.events ?? []) if (event.type === 'scoreChanged') score = event.detail;
        history.push({...snapshot, receivedAt: arrival});
        if (history.length > 90) history.shift();
        const own = snapshot.entities.find(e => e.kind === 'ship' && e.ownerId === playerId);
        if (!own) { predicted = null; visual = null; ownId = null; inputQueue.length = 0; return true; }
        if (ownId !== own.id) {
            ownId = own.id;
            inputQueue.length = 0;
            predictedBullets.length = 0;
            predicted = makeShip(own);
            visual = {x: own.x, y: own.y, angle: own.angle};
        }
        const before = predicted ? {x: predicted.pos.x, y: predicted.pos.y} : {x: own.x, y: own.y};
        acknowledged = Math.max(acknowledged, snapshot.lastProcessedSeq);
        inputQueue = inputQueue.filter(entry => entry.seq > acknowledged);
        predicted = makeShip(own);
        if (predictionEnabled) for (const entry of inputQueue) apply(predicted, entry);
        const distance = Math.hypot(predicted.pos.x - before.x, predicted.pos.y - before.y);
        correction = distance;
        correctionHistory.push({tick: snapshot.tick, pixels: distance});
        if (correctionHistory.length > 1000) correctionHistory.shift();
        // The visual object deliberately remains at its previous position and eases toward the result.
        return true;
    }
    function step(input, now) {
        seq++;
        clientTick++;
        const item = {...input, seq, tick: clientTick};
        inputQueue.push(item);
        if (inputQueue.length > 240) inputQueue.shift();
        if (predictionEnabled && predicted) apply(predicted, item);
        localFireCooldown = Math.max(0, localFireCooldown - STEP);
        if (predictionEnabled && input.fire && predicted && localFireCooldown <= 0) {
            const dir = Vector2.fromAngle(predicted.angle);
            const pos = predicted.pos.add(dir.scale(predicted.radius + 3));
            const vel = predicted.vel.add(dir.scale(500));
            predictedBullets.push({id: -seq, ownerId: playerId, shotSeq: seq, kind: 'bullet',
                x: pos.x, y: pos.y, vx: vel.x, vy: vel.y, angle: predicted.angle,
                radius: 3, bornAt: now});
            localFireCooldown = 0.3;
        }
        for (const bullet of predictedBullets) {
            bullet.x += bullet.vx * STEP;
            bullet.y += bullet.vy * STEP;
        }
        predictedBullets = predictedBullets.filter(b => now - b.bornAt < 450);
        return item;
    }
    function render(now, dt) {
        const latest = history.at(-1);
        if (!latest) return [];
        const estimatedTick = latest.tick + Math.max(0, (now - latest.receivedAt) / (1000 / 30));
        const targetTick = estimatedTick - interpolationDelay / (1000 / 30);
        let left = history[0], right = history.at(-1);
        for (let i = 0; i < history.length - 1; i++) {
            if (history[i].tick <= targetTick && history[i + 1].tick >= targetTick) {
                left = history[i]; right = history[i + 1]; break;
            }
            if (history[i].tick <= targetTick) left = history[i];
        }
        if (targetTick >= right.tick) left = right;
        if (targetTick <= history[0].tick) right = left = history[0];
        const t = left.tick === right.tick ? 0 : Math.min(1, Math.max(0, (targetTick - left.tick) / (right.tick - left.tick)));
        const old = new Map(left.entities.map(e => [e.id, e]));
        const entities = [];
        for (const fresh of right.entities) {
            // Entities absent from one bracket appear/disappear at snapshot boundaries.
            const previous = old.get(fresh.id);
            const entity = previous ? {
                ...fresh,
                x: lerp(previous.x, fresh.x, t), y: lerp(previous.y, fresh.y, t),
                angle: angleBlend(previous.angle, fresh.angle, t),
            } : {...fresh};
            if (fresh.kind !== 'ship' || fresh.ownerId !== playerId) entities.push(entity);
        }
        const authoritativeOwn = latest.entities.find(e => e.id === ownId);
        const desired = predictionEnabled && predicted ? {
            x: predicted.pos.x, y: predicted.pos.y, angle: predicted.angle,
        } : authoritativeOwn;
        if (desired && authoritativeOwn) {
            if (!visual) visual = {...desired};
            const blend = Math.min(1, dt / 0.1);
            visual.x = lerp(visual.x, desired.x, blend);
            visual.y = lerp(visual.y, desired.y, blend);
            visual.angle = angleBlend(visual.angle, desired.angle, blend);
            entities.push({...authoritativeOwn, ...visual});
        }
        const authoritativeBullets = latest.entities.filter(e => e.kind === 'bullet' && e.ownerId === playerId);
        for (const bullet of predictedBullets) {
            const matching = authoritativeBullets.some(e => e.shotSeq === bullet.shotSeq ||
                Math.hypot(e.x - bullet.x, e.y - bullet.y) < 35);
            if (!matching) entities.push(bullet);
        }
        return entities;
    }
    function metrics(now) {
        return {pending: inputQueue.length, correction, snapshotAge: lastArrival ? now - lastArrival : 0,
            serverTick, interpolationDelay, score};
    }
    return {
        step, onSnapshot, render, metrics, correctionHistory,
        get playerId() {return playerId;},
        setInterpolationDelay(value) {interpolationDelay = Math.max(0, Math.min(300, value));},
        setPrediction(enabled) {predictionEnabled = enabled;},
        setDeterminismBroken(enabled) {determinismBroken = enabled;},
    };
}
