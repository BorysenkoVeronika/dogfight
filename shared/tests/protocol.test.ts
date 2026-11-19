import test from 'node:test';
import assert from 'node:assert/strict';
import {parseClientMessage,parseServerMessage} from '../protocol.ts';
import {decodeInput,decodeSnapshot,encodeInput,encodeSnapshot} from '../codec/binary.ts';
import type {Snapshot} from '../types.ts';

test('runtime schema accepts valid input and rejects malformed packets',()=>{
 const valid={v:0,type:'input',seq:7,tick:8,thrust:true,turn:0,fire:false};
 const parsed=parseClientMessage(valid);
 assert.equal(parsed.ok,true);
 assert.equal(parseClientMessage({...valid,turn:1e9}).ok,false);
 assert.equal(parseClientMessage({...valid,extra:true}).ok,false);
 assert.equal(parseClientMessage({...valid,v:5}).ok,false);
 assert.equal(parseClientMessage({v:0,type:'chat',message:12}).ok,false);
 assert.equal(parseClientMessage(null).ok,false);
});

test('server message schema validates discriminated kinds',()=>{
 const valid={v:0,type:'roster',players:[{id:'a',name:'Alice'}]};
 assert.equal(parseServerMessage(valid).ok,true);
 assert.equal(parseServerMessage({v:0,type:'roster',players:[{name:'Missing ID'}]}).ok,false);
});

test('binary decoder rejects truncated, wrong-version, and out-of-range packets',()=>{
 assert.throws(()=>decodeInput(new ArrayBuffer(4)));
 const input=encodeInput({seq:1,tick:1,thrust:true,turn:1,fire:false});
 new DataView(input).setInt8(11,99);
 assert.throws(()=>decodeInput(input));
 const snapshot:Snapshot={type:'snapshot',tick:1,lastProcessedSeq:0,playerId:'abc',seed:42,entities:[],events:[]};
 const message=encodeSnapshot(snapshot);
 new DataView(message).setUint8(0,255);
 assert.throws(()=>decodeSnapshot(message));
});
