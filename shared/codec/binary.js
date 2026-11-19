/* Dogfight binary wire format v1 (little-endian throughout).
 * Input (16 bytes): [0] version u8=1, [1] type u8=1,
 * [2..5] seq u32, [6..9] client tick u32, [10] flags u8
 * (bit 0 thrust, bit 1 fire), [11] turn i8 (-1/0/1), [12..15] reserved.
 * Snapshot: [0] version u8, [1] type u8=2, [2..5] tick u32,
 * [6..9] last processed seq i32, [10..11] entity count u16,
 * [12] event count u8, [13] UTF-8 playerId byte length u8,
 * [14..17] PRNG seed u32,
 * followed by playerId bytes, then entity records and event codes.
 * Entity: id u16, kind u8, x/y/vx/vy float32 (16 bytes),
 * angle i16 (radians*1000), radius u8, subtype u8,
 * owner byte length u8 + UTF-8 ownerId, shotSeq i32 (total 28+ownerBytes).
 * Event: event type u8, detail f32. No platform-native endian assumptions.
 * Numeric fields are float32/quantized-angle on the wire; other fields are exact.
 */
const VERSION = 1;
const KINDS = ['unknown', 'ship', 'bullet', 'asteroid', 'pickup', 'explosion'];
const EVENTS = ['unknown', 'fired', 'hit', 'exploded', 'scoreChanged'];
const PICKUPS = ['none', 'shield', 'rapid-fire'];
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const little = true;
const asBuffer = data => data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

export function encodeInput(input) {
    const buffer = new ArrayBuffer(16);
    const v = new DataView(buffer);
    v.setUint8(0, VERSION); v.setUint8(1, 1);
    v.setUint32(2, input.seq, little);
    v.setUint32(6, input.tick, little);
    v.setUint8(10, Number(input.thrust) | (Number(input.fire) << 1));
    v.setInt8(11, input.turn);
    return buffer;
}
export function decodeInput(data) {
    const v = new DataView(asBuffer(data));
    if (v.byteLength !== 16 || v.getUint8(0) !== VERSION || v.getUint8(1) !== 1) throw new Error('Invalid binary input');
    return { type: 'input', seq: v.getUint32(2, little), tick: v.getUint32(6, little), thrust: !!(v.getUint8(10) & 1), turn: v.getInt8(11), fire: !!(v.getUint8(10) & 2) };
}
export function encodeSnapshot(snapshot) {
    const player = encoder.encode(snapshot.playerId ?? '');
    if (player.length > 255 || snapshot.entities.length > 65535 || (snapshot.events?.length ?? 0) > 255) throw new RangeError('Snapshot exceeds format limits');
    const entities = snapshot.entities.map(e => ({ e, owner: encoder.encode(e.ownerId ?? '') }));
    for (const {owner} of entities) if (owner.length > 255) throw new RangeError('Owner ID too long');
    const total = 18 + player.length + entities.reduce((n, {owner}) => n + 28 + owner.length, 0) + (snapshot.events?.length ?? 0) * 5;
    const buffer = new ArrayBuffer(total);
    const v = new DataView(buffer);
    let i = 0;
    const u8 = x => { v.setUint8(i++, x); };
    const u16 = x => { v.setUint16(i, x, little); i += 2; };
    const u32 = x => { v.setUint32(i, x, little); i += 4; };
    const i32 = x => { v.setInt32(i, x, little); i += 4; };
    const f32 = x => { v.setFloat32(i, x, little); i += 4; };
    const bytes = b => { new Uint8Array(buffer, i, b.length).set(b); i += b.length; };
    u8(VERSION); u8(2); u32(snapshot.tick); i32(snapshot.lastProcessedSeq);
    u16(entities.length); u8(snapshot.events?.length ?? 0); u8(player.length); u32(snapshot.seed ?? 12345); bytes(player);
    for (const {e, owner} of entities) {
        u16(e.id); u8(KINDS.indexOf(e.kind));
        f32(e.x); f32(e.y); f32(e.vx ?? 0); f32(e.vy ?? 0);
        v.setInt16(i, Math.max(-32768, Math.min(32767, Math.round((e.angle ?? 0) * 1000))), little); i += 2;
        u8(e.radius ?? 0); u8(PICKUPS.indexOf(e.pickupType ?? 'none'));
        u8(owner.length); bytes(owner); i32(e.shotSeq ?? -1);
    }
    for (const event of snapshot.events ?? []) { u8(EVENTS.indexOf(event.type)); f32(Number(event.detail) || 0); }
    if (i !== total) throw new Error(`Binary snapshot length mismatch: ${i} != ${total}`);
    return buffer;
}
export function decodeSnapshot(data) {
    const v = new DataView(asBuffer(data));
    let i = 0;
    const need = n => { if (i + n > v.byteLength) throw new RangeError('Truncated snapshot'); };
    const u8 = () => { need(1); return v.getUint8(i++); };
    const u16 = () => { need(2); const x = v.getUint16(i, little); i += 2; return x; };
    const u32 = () => { need(4); const x = v.getUint32(i, little); i += 4; return x; };
    const i32 = () => { need(4); const x = v.getInt32(i, little); i += 4; return x; };
    const f32 = () => { need(4); const x = v.getFloat32(i, little); i += 4; return x; };
    const str = n => { need(n); const s = decoder.decode(new Uint8Array(v.buffer, v.byteOffset + i, n)); i += n; return s; };
    if (u8() !== VERSION || u8() !== 2) throw new Error('Invalid snapshot format/version');
    const tick = u32(), lastProcessedSeq = i32(), count = u16(), eventCount = u8(), playerIdSize = u8(), seed = u32(), playerId = str(playerIdSize);
    const entities = [];
    for (let n = 0; n < count; n++) {
        const id = u16(), kind = KINDS[u8()];
        const x = f32(), y = f32(), vx = f32(), vy = f32();
        need(2); const angle = v.getInt16(i, little) / 1000; i += 2;
        const radius = u8(), pickupType = PICKUPS[u8()];
        const ownerId = str(u8()), shotSeq = i32();
        entities.push({ id, kind, x, y, vx, vy, angle, radius,
            ...(pickupType !== 'none' && {pickupType}), ...(ownerId && {ownerId}), ...(shotSeq !== -1 && {shotSeq}) });
    }
    const events = [];
    for (let n = 0; n < eventCount; n++) { const type = EVENTS[u8()]; const detail = f32(); events.push({type, detail: type === 'scoreChanged' ? detail : null}); }
    if (i !== v.byteLength) throw new Error('Trailing snapshot bytes');
    return {type: 'snapshot', tick, lastProcessedSeq, playerId, seed, entities, events};
}
export const BINARY_VERSION = VERSION;
