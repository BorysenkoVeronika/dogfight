/** Minimal structural declarations for the exact ws API used by Dogfight. */
declare module 'ws' {
 import type {IncomingMessage, Server as HttpServer} from 'node:http';
 export type RawData = Buffer;
 export class WebSocket {
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
  constructor(options:{server:HttpServer;path:string;maxPayload:number});
  readonly clients:Set<WebSocket>;
  on(event:'connection',listener:(socket:WebSocket, request:IncomingMessage)=>void):this;
  on(event:'close',listener:()=>void):this;
  close(callback?:(error?:Error)=>void):void;
 }
}
