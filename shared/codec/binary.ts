import type {GameInput, Snapshot, EntitySnapshot, GameEvent} from '../types.ts';
import {assertNever} from '../types.ts';
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
const EVENTS: readonly string[] = ['unknown', 'fired', 'hit', 'exploded', 'scoreChanged'];
const PICKUPS: readonly string[] = ['none', 'shield', 'rapid-fire'];
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const little = true;
const asBuffer = (data: ArrayBuffer | ArrayBufferView): ArrayBuffer => {
    if (data instanceof ArrayBuffer) return data;
    return Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).buffer;
};

export function encodeInput(input: GameInput): ArrayBuffer {
    const buffer = new ArrayBuffer(16);
    const v = new DataView(buffer);
    v.setUint8(0, VERSION); v.setUint8(1, 1);
    v.setUint32(2, input.seq, little);
    v.setUint32(6, input.tick, little);
    v.setUint8(10, Number(input.thrust) | (Number(input.fire) << 1));
    v.setInt8(11, input.turn);
    return buffer;
}
export function decodeInput(data: ArrayBuffer | ArrayBufferView): GameInput & {type:'input'} {
    const v = new DataView(asBuffer(data));
    if (v.byteLength !== 16 || v.getUint8(0) !== VERSION || v.getUint8(1) !== 1) throw new Error('Invalid binary input');
    const flags = v.getUint8(10), turn = v.getInt8(11);
    if ((flags & ~3) !== 0 || turn < -1 || turn > 1 || v.getUint32(12,little) !== 0) throw new RangeError('Invalid input fields');
    const inputTurn = turn === -1 ? -1 : turn === 0 ? 0 : 1;
    return {type:'input',seq:v.getUint32(2,little),tick:v.getUint32(6,little),thrust:!!(flags&1),turn:inputTurn,fire:!!(flags&2)};
}
export function encodeSnapshot(snapshot: Snapshot): ArrayBuffer {
    const player = encoder.encode(snapshot.playerId ?? '');
    if (player.length > 255 || snapshot.entities.length > 65535 || (snapshot.events?.length ?? 0) > 255) throw new RangeError('Snapshot exceeds format limits');
    const entities = snapshot.entities.map(e => ({ e, owner: encoder.encode('ownerId' in e ? e.ownerId ?? '' : '') }));
    for (const {owner} of entities) if (owner.length > 255) throw new RangeError('Owner ID too long');
    const total = 18 + player.length + entities.reduce((n, {owner}) => n + 28 + owner.length, 0) + (snapshot.events?.length ?? 0) * 5;
    const buffer = new ArrayBuffer(total);
    const v = new DataView(buffer);
    let i = 0;
    const u8 = (x: number) => { v.setUint8(i++, x); };
    const u16 = (x: number) => { v.setUint16(i, x, little); i += 2; };
    const u32 = (x: number) => { v.setUint32(i, x, little); i += 4; };
    const i32 = (x: number) => { v.setInt32(i, x, little); i += 4; };
    const f32 = (x: number) => { v.setFloat32(i, x, little); i += 4; };
    const bytes = (b: Uint8Array) => { new Uint8Array(buffer, i, b.length).set(b); i += b.length; };
    u8(VERSION); u8(2); u32(snapshot.tick); i32(snapshot.lastProcessedSeq);
    u16(entities.length); u8(snapshot.events?.length ?? 0); u8(player.length); u32(snapshot.seed ?? 12345); bytes(player);
    for (const {e, owner} of entities) {
        if (!Number.isInteger(e.id) || e.id < 0 || e.id > 65535) throw new RangeError('Entity ID out of wire range');
        u16(e.id); u8(kindCode(e.kind));
        f32(e.x); f32(e.y); f32(e.vx ?? 0); f32(e.vy ?? 0);
        v.setInt16(i, Math.max(-32768, Math.min(32767, Math.round((e.angle ?? 0) * 1000))), little); i += 2;
        u8(e.radius ?? 0); u8(PICKUPS.indexOf(e.kind === 'pickup' ? e.pickupType : 'none'));
        u8(owner.length); bytes(owner); i32(e.kind === 'bullet' ? e.shotSeq ?? -1 : -1);
    }
    for (const event of snapshot.events ?? []) {
        switch(event.type){
            case 'fired':u8(1);f32(0);break;
            case 'hit':u8(2);f32(0);break;
            case 'exploded':u8(3);f32(0);break;
            case 'scoreChanged':u8(4);f32(event.detail);break;
            default:assertNever(event);
        }
    }
    if (i !== total) throw new Error(`Binary snapshot length mismatch: ${i} != ${total}`);
    return buffer;
}
export function decodeSnapshot(data: ArrayBuffer | ArrayBufferView): Snapshot {
    const v = new DataView(asBuffer(data));
    let i = 0;
    const need = (n: number) => { if (i + n > v.byteLength) throw new RangeError('Truncated snapshot'); };
    const u8 = () => { need(1); return v.getUint8(i++); };
    const u16 = () => { need(2); const x = v.getUint16(i, little); i += 2; return x; };
    const u32 = () => { need(4); const x = v.getUint32(i, little); i += 4; return x; };
    const i32 = () => { need(4); const x = v.getInt32(i, little); i += 4; return x; };
    const f32 = () => { need(4); const x = v.getFloat32(i, little); i += 4; return x; };
    const str = (n: number) => { need(n); const s = decoder.decode(new Uint8Array(v.buffer, v.byteOffset + i, n)); i += n; return s; };
    if (u8() !== VERSION || u8() !== 2) throw new Error('Invalid snapshot format/version');
    const tick = u32(), lastProcessedSeq = i32(), count = u16(), eventCount = u8(), playerIdSize = u8(), seed = u32(), playerId = str(playerIdSize);
    const entities: EntitySnapshot[] = [];
    for (let n = 0; n < count; n++) {
        const id = u16(), kind = u8();
        const x = f32(), y = f32(), vx = f32(), vy = f32();
        need(2); const angle = v.getInt16(i, little) / 1000; i += 2;
        const radius = u8(), pickupKind = u8();
        const ownerId = str(u8()), shotSeq = i32();
        if (![x,y,vx,vy,angle].every(Number.isFinite) || pickupKind > 2 || (kind!==4 && pickupKind!==0)) throw new RangeError('Invalid entity fields');
        const base = {id,x,y,vx,vy,angle,radius};
        switch(kind) {
          case 1: entities.push({...base,kind:'ship',...(ownerId && {ownerId})});break;
          case 2: entities.push({...base,kind:'bullet',...(ownerId && {ownerId}),...(shotSeq!==-1 && {shotSeq})});break;
          case 3: entities.push({...base,kind:'asteroid'});break;
          case 4: entities.push({...base,kind:'pickup',pickupType:pickupKind===1?'shield':pickupKind===2?'rapid-fire':fail('Missing pickup type')});break;
          case 5: entities.push({...base,kind:'explosion'});break;
          default: throw new RangeError('Invalid entity kind');
        }
    }
    const events: GameEvent[] = [];
    for (let n = 0; n < eventCount; n++) {
      const code=u8(), detail=f32();
      if(!Number.isFinite(detail))throw new RangeError('Non-finite event detail');
      switch(code){case 1:events.push({type:'fired',detail:null});break;case 2:events.push({type:'hit',detail:null});break;case 3:events.push({type:'exploded',detail:null});break;case 4:events.push({type:'scoreChanged',detail});break;default:throw new RangeError('Invalid event kind');}
    }
    if (i !== v.byteLength) throw new Error('Trailing snapshot bytes');
    return {type:'snapshot',tick,lastProcessedSeq,playerId,seed,entities,events};
}
function fail(message:string):never{throw new RangeError(message);}
function kindCode(kind:EntitySnapshot['kind']): number {
 switch(kind){case 'ship':return 1;case 'bullet':return 2;case 'asteroid':return 3;case 'pickup':return 4;case 'explosion':return 5;default:return assertNever(kind);}
}
export const BINARY_VERSION = VERSION;
