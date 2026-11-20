/** Minimal structural declarations for the exact ws API used by Dogfight. */
declare module 'ws' {
 import type {IncomingMessage, Server as HttpServer} from 'node:http';
 export type RawData = Buffer;
 export class WebSocket {
  static readonly OPEN: number;
  constructor(address:string,options?:{origin?:string});
  once(event:'open'|'error'|'close',listener:()=>void):this;
  readonly bufferedAmount: number;
  readonly readyState: number;
  on(event: 'message', listener:(data:RawData,isBinary:boolean)=>void):this;
  on(event: 'pong', listener:()=>void):this;
  on(event: 'error', listener:(error:Error)=>void):this;
  on(event: 'close', listener:()=>void):this;
  send(data:string|ArrayBuffer):void;
  close(code?:number, reason?:string):void;
  terminate():void;
  ping():void;
 }
 export class WebSocketServer {
  constructor(options:{server:HttpServer;path:string;maxPayload:number;verifyClient?:(info:{origin:string|undefined;req:IncomingMessage},done:(accepted:boolean,code?:number,reason?:string)=>void)=>void});
  readonly clients:Set<WebSocket>;
  on(event:'connection',listener:(socket:WebSocket, request:IncomingMessage)=>void):this;
  on(event:'close',listener:()=>void):this;
  close(callback?:(error?:Error)=>void):void;
 }
}
