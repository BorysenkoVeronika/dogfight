import test from 'node:test';
import assert from 'node:assert/strict';
import { determinismHash } from '../sim/determinism.js';
import { World } from '../sim/world.js';

test('shared simulation imports without DOM and yields the same hash on repeated runs', () => {
    assert.equal(typeof new World(42).step, 'function');
    assert.equal(determinismHash(), determinismHash());
    console.log('Node deterministic hash (compare with Chrome):', determinismHash());
});
