import type {Snapshot,GameInput} from '../../shared/types.ts';
// Measures JSON and binary for a 4-player snapshot at 30 Hz.
// Run: node --import tsx server/scripts/benchmark-codecs.ts from repository root.
import { encodeSnapshot, decodeSnapshot, encodeInput } from '../../shared/codec/binary.ts';
import { performance } from 'node:perf_hooks';
const text = new TextEncoder();
const playerIds = Array.from({length: 4}, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const snapshot:Snapshot = {type:'snapshot',seed:12345,tick:1000,lastProcessedSeq:995,playerId:playerIds[0] ?? "",events:[],entities:
    playerIds.map((ownerId, i) => ({id:i+1,kind:'ship',x:100+i*50,y:250+i*10,vx:20.5,vy:13.2,angle:0.75,radius:12,ownerId}))};
const input:GameInput = {seq:995,tick:1000,turn:1,thrust:true,fire:false};
const jsonSnapshot = JSON.stringify({v:0,...snapshot});
const jsonInput = JSON.stringify({v:0,type:'input',...input});
const binSnapshot = encodeSnapshot(snapshot);
const binInput = encodeInput(input);
const iterations = 20000;
function bench<T>(name: string, encode: () => T, decode: (data:T) => unknown): number {
    const start = performance.now();
    for (let i=0;i<iterations;i++) decode(encode());
    return (performance.now()-start)*1000/iterations;
}
const jsonUs=bench('json',()=>JSON.stringify(snapshot),(str:string)=>JSON.parse(str));
const binUs=bench('binary',()=>encodeSnapshot(snapshot),(bytes:ArrayBuffer)=>decodeSnapshot(bytes));
const records=[
    {codec:'JSON',snapshotBytes:text.encode(jsonSnapshot).byteLength,downKBps:(text.encode(jsonSnapshot).byteLength*30/1024).toFixed(2),upKBps:(text.encode(jsonInput).byteLength*30/1024).toFixed(2),encodeDecodeUs:jsonUs.toFixed(2)},
    {codec:'Binary (DataView)',snapshotBytes:binSnapshot.byteLength,downKBps:(binSnapshot.byteLength*30/1024).toFixed(2),upKBps:(binInput.byteLength*30/1024).toFixed(2),encodeDecodeUs:binUs.toFixed(2)},
];
console.table(records);
console.log('Synthetic 4-ship messages, 30 messages/s each direction; rerun locally for machine-specific results.');
