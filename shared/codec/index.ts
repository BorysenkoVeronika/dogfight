import type {Snapshot} from '../types.ts';
import {encodeSnapshot,decodeSnapshot} from './binary.ts';
import {encode as encodeJson,decode as decodeJson} from './json.ts';

/** The wire representation differs, but the application sees the same Snapshot. */
export interface Codec<T> {
 readonly name:'json'|'binary';
 encode(message:T):string|ArrayBuffer;
 decode(payload:string|ArrayBuffer):T;
}
export const jsonCodec:Codec<Snapshot>={
 name:'json',
 encode(message){return encodeJson(message);},
 decode(payload){if(typeof payload!=='string')throw new TypeError('Expected JSON text');return decodeJson(payload);},
};
export const binaryCodec:Codec<Snapshot>={
 name:'binary',
 encode(message){return encodeSnapshot(message);},
 decode(payload){if(!(payload instanceof ArrayBuffer))throw new TypeError('Expected binary snapshot');return decodeSnapshot(payload);},
};
