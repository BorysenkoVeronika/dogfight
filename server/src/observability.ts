import pino from 'pino';
import { performance } from 'node:perf_hooks';
import type { RoomManager } from './room-manager.ts';

export const logger = pino({level:process.env.LOG_LEVEL ?? 'info',base:{service:'dogfight-server'},
  redact:{paths:['req.headers.authorization','password','token','secret'],remove:true}});
const rejected = new Map<string,number>();
let messagesIn=0,messagesOut=0,bytesIn=0,bytesOut=0;
const started=performance.now();
export function rejectConnection(reason:string):void {rejected.set(reason,(rejected.get(reason)??0)+1);logger.warn({event:'ws.rejected',reason});}
export function recordIncoming(bytes:number):void {messagesIn++;bytesIn+=bytes;}
export function recordOutgoing(bytes:number):void {messagesOut++;bytesOut+=bytes;}
export function metrics(manager:RoomManager):Record<string,unknown> {
 const matches=manager.getStats();
 const seconds=Math.max((performance.now()-started)/1000,0.001);
 const players=manager.playerCount();
 return {uptimeSeconds:Math.round(seconds),connectedPlayers:players,rooms:manager.roomCount(),
 messagesPerSecondIn:messagesIn/seconds,messagesPerSecondOut:messagesOut/seconds,
 bytesPerSecondIn:bytesIn/seconds,bytesPerSecondOut:bytesOut/seconds,
 tickP99Ms:matches.reduce((max,m)=>Math.max(max,m.tickP99Ms ?? 0),0),
 eventLoopUtilization:performance.eventLoopUtilization().utilization,
 rssBytes:process.memoryUsage().rss,rejectedConnections:Object.fromEntries(rejected)};
}
