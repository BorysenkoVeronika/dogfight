import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeInput, decodeInput, encodeSnapshot, decodeSnapshot} from '../codec/binary.js';

const near = (a, b, epsilon = 0.0002) => Math.abs(a - b) <= epsilon;
test('binary input round trip', () => {
    for (const seq of [0, 1, 65536, 999999]) for (const turn of [-1, 0, 1]) {
        const input = {seq, tick: seq + 1, thrust: !!(seq % 2), turn, fire: true};
        const {type, ...decoded} = decodeInput(encodeInput(input));
        assert.equal(type, 'input'); assert.deepEqual(decoded, input);
    }
});
test('binary snapshot round trip within quantization tolerance', () => {
    const message = {type: 'snapshot', tick: 200, lastProcessedSeq: 190,
        seed: 12345, playerId: 'ef7bfe93-9600-4dc8-9336-923c89cd14cb',
        entities: [
            {id: 3, kind: 'ship', x: 400.123, y: 250.456, vx: 10.5, vy: -20.125, angle: 1.3335, radius: 12, ownerId: 'ef7bfe93-9600-4dc8-9336-923c89cd14cb'},
            {id: 4, kind: 'bullet', x: 102.1, y: 98.1, vx: 100, vy: 50, angle: -0.54, radius: 3, ownerId: 'player2', shotSeq: 188},
            {id: 5, kind: 'pickup', x: 300, y: 200, vx: 0, vy: 0, angle: 0, radius: 12, pickupType: 'shield'},
        ], events: [{type:'fired', detail:null}, {type:'scoreChanged',detail:10}]};
    const decoded = decodeSnapshot(encodeSnapshot(message));
    assert.equal(decoded.tick, message.tick);
    assert.equal(decoded.playerId, message.playerId);
    assert.equal(decoded.seed, message.seed);
    assert.equal(decoded.lastProcessedSeq, message.lastProcessedSeq);
    assert.deepEqual(decoded.events, message.events);
    for (let i = 0; i < message.entities.length; i++) {
        const before = message.entities[i], after = decoded.entities[i];
        for (const key of ['id', 'kind', 'radius', 'ownerId', 'shotSeq', 'pickupType']) assert.equal(after[key], before[key]);
        for (const key of ['x', 'y', 'vx', 'vy']) assert.ok(near(after[key], before[key]), key);
        assert.ok(near(after.angle, before.angle, 0.00051), 'angle');
    }
});
