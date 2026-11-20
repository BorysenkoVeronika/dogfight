import { z } from 'zod';
import type { Snapshot, GameInput, EntitySnapshot } from './types.ts';

const count = z.number().int().min(0).max(4294967295);
const version = z.literal(0);
const join = z.strictObject({v:version, type:z.literal('join'), roomId:z.string().min(1), playerName:z.string().trim().min(1).max(30)});
const chat = z.strictObject({v:version, type:z.literal('chat'), message:z.string().trim().min(1).max(500)});
const input = z.strictObject({v:version, type:z.literal('input'), seq:count, tick:count, thrust:z.boolean(), turn:z.union([z.literal(-1),z.literal(0),z.literal(1)]), fire:z.boolean()});
const ping = z.strictObject({v:version, type:z.literal('ping'), sentAt:z.number().finite().nonnegative()});
const networkConfig = z.strictObject({v:version, type:z.literal('networkConfig'), latency:z.number().finite().min(0).max(1000), jitter:z.number().finite().min(0).max(500), drop:z.number().finite().min(0).max(100)});
export const ClientMessageSchema = z.discriminatedUnion('type',[join,chat,input,ping,networkConfig]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export const CreateRoomRequestSchema = z.strictObject({name:z.string().trim().min(3).max(50)});
export const RoomInfoSchema = z.object({id:z.string(),name:z.string()});
export const RoomListSchema = z.array(RoomInfoSchema);
export type RoomInfo = z.infer<typeof RoomInfoSchema>;
const player = z.strictObject({id:z.string().min(1),name:z.string()});
const entityBase = {id:count,x:z.number().finite(),y:z.number().finite(),vx:z.number().finite(),vy:z.number().finite(),angle:z.number().finite(),radius:z.number().finite()};
export const EntitySchema = z.discriminatedUnion('kind',[
 z.object({...entityBase,kind:z.literal('ship'),ownerId:z.string().optional()}),
 z.object({...entityBase,kind:z.literal('bullet'),ownerId:z.string().optional(),shotSeq:z.number().int().optional()}),
 z.object({...entityBase,kind:z.literal('asteroid')}),
 z.object({...entityBase,kind:z.literal('pickup'),pickupType:z.enum(['shield','rapid-fire'])}),
 z.object({...entityBase,kind:z.literal('explosion')})
]);
const events = z.array(z.discriminatedUnion('type',[
 z.object({type:z.literal('fired'),detail:z.null()}),z.object({type:z.literal('hit'),detail:z.null()}),
 z.object({type:z.literal('exploded'),detail:z.null()}),z.object({type:z.literal('scoreChanged'),detail:z.number()})
]));
export const ServerMessageSchema = z.discriminatedUnion('type',[
 z.object({v:version,type:z.literal('roster'),players:z.array(player)}),
 z.object({v:version,type:z.literal('chat'),playerId:z.string(),playerName:z.string(),message:z.string()}),
 z.object({v:version,type:z.literal('pong'),sentAt:z.number().finite()}),
 z.object({v:version,type:z.literal('shutdown'),message:z.string()}),
 z.object({v:version,type:z.literal('snapshot'),tick:count,lastProcessedSeq:z.number().int(),playerId:z.string(),seed:count,entities:z.array(EntitySchema),events,score:z.number().optional()})
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ParseResult<T> = {ok:true; value:T} | {ok:false; error:string};
export function parseClientMessage(data: unknown): ParseResult<ClientMessage> {
 const result = ClientMessageSchema.safeParse(data);
 return result.success ? {ok:true,value:result.data} : {ok:false,error:result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')};
}
export function parseServerMessage(data: unknown): ParseResult<ServerMessage> {
 const result = ServerMessageSchema.safeParse(data);
 return result.success ? {ok:true,value:result.data} : {ok:false,error:result.error.message};
}
/** Standalone guard used at the binary boundary as well. */
export function isEntitySnapshot(data: unknown): data is EntitySnapshot { return EntitySchema.safeParse(data).success; }
export function isSnapshot(data: unknown): data is Snapshot {
 return ServerMessageSchema.safeParse({v:0,...(typeof data === 'object' && data !== null ? data : {})}).success &&
 typeof data === 'object' && data !== null && 'type' in data && data.type === 'snapshot';
}
export function isGameInput(data: unknown): data is GameInput {
 return input.safeParse({v:0,type:'input',...(typeof data === 'object' && data !== null ? data : {})}).success;
}
