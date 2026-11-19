/** IDs are branded so ticks and entity identities cannot be interchanged. */
declare const entityBrand: unique symbol;
declare const tickBrand: unique symbol;
declare const seqBrand: unique symbol;
export type EntityId = number & { readonly [entityBrand]: true };
export type Tick = number & { readonly [tickBrand]: true };
export type Seq = number & { readonly [seqBrand]: true };
export function entityId(value: number): EntityId {
 if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid EntityId');
 // Validated number: this cast adds an identity brand at compile time only.
 return value as EntityId;
}
export function tickId(value: number): Tick {
 if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid Tick');
 // Validated counter: this cast adds a tick brand without changing runtime data.
 return value as Tick;
}
export function sequenceId(value: number): Seq {
 if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid Seq');
 // Validated sequence: this cast keeps it distinct from other numeric IDs.
 return value as Seq;
}
export type EntityKind = 'entity' | 'ship' | 'bullet' | 'asteroid' | 'pickup' | 'explosion';
export type PickupType = 'shield' | 'rapid-fire';
export type InputState = Readonly<{thrust:boolean; turn: -1|0|1; fire?:boolean}>;
export type GameInput = Readonly<{ seq:number; tick:number; thrust:boolean; turn:-1|0|1; fire:boolean }>;
export type KeyInput = {isDown(code: string): boolean};
export type BaseEntitySnapshot = Readonly<{id: number; x:number; y:number; vx:number; vy:number; angle:number; radius:number }>;
export type ShipSnapshot = BaseEntitySnapshot & Readonly<{kind:'ship'; ownerId?:string}>;
export type BulletSnapshot = BaseEntitySnapshot & Readonly<{kind:'bullet'; ownerId?:string; shotSeq?:number}>;
export type AsteroidSnapshot = BaseEntitySnapshot & Readonly<{kind:'asteroid'}>;
export type PickupSnapshot = BaseEntitySnapshot & Readonly<{kind:'pickup'; pickupType:'shield'|'rapid-fire'}>;
export type ExplosionSnapshot = BaseEntitySnapshot & Readonly<{kind:'explosion'}>;
export type EntitySnapshot = ShipSnapshot | BulletSnapshot | AsteroidSnapshot | PickupSnapshot | ExplosionSnapshot;
export type GameEvent = {type:'fired'|'hit'|'exploded'; detail:null} | {type:'scoreChanged';detail:number};
export type Snapshot = Readonly<{type:'snapshot'; tick:number; lastProcessedSeq:number; playerId:string; seed:number; entities:readonly EntitySnapshot[]; events:readonly GameEvent[]; score?:number}>;
export type GameEvents = { fired:null; hit:null; exploded:null; scoreChanged:number };
export function assertNever(value: never): never { throw new Error(`Unexpected case: ${JSON.stringify(value)}`); }
