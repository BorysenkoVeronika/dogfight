import type {Snapshot} from '../types.ts';
import {isSnapshot} from '../protocol.ts';
export function encode(message:Snapshot):string{return JSON.stringify({v:0,...message});}
export function decode(data:string):Snapshot{const value:unknown=JSON.parse(data);if(!isSnapshot(value))throw new Error('Invalid JSON snapshot');return value;}
