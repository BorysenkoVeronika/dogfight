import {describe, expect, it} from 'vitest';
import {Ship} from '../sim/ship.ts';
import {Asteroid} from '../sim/asteroid.ts';
import {Bullet} from '../sim/bullet.ts';
import {Explosion} from '../sim/explosion.ts';
import {Pickup} from '../sim/pickup.ts';
import {Vector2} from '../sim/vector.ts';
import {World} from '../sim/world.ts';
import {inputAdapter} from '../sim/input.ts';
import {updateHoming} from '../sim/behaviors/homing.ts';
import {createSimulationEvents} from '../sim/events.ts';
import type {EntitySnapshot} from '../types.ts';

const idle = inputAdapter({thrust:false,turn:0});
const snap = (kind: EntitySnapshot['kind']) => ({id:42,x:30,y:40,vx:2,vy:3,angle:0.5,radius:8,kind});

describe('ship combat, controls and snapshots', () => {
  it('turns in both directions and normalizes the angle', () => {
    const ship = new Ship();
    ship.update(0.5,inputAdapter({thrust:false,turn:-1}));
    expect(ship.angle).toBeCloseTo(-1.5);
    ship.update(1,inputAdapter({thrust:false,turn:1}));
    expect(ship.angle).toBeCloseTo(1.5);
    ship.angle=10;ship.update(0,idle);
    expect(Math.abs(ship.angle)).toBeLessThanOrEqual(Math.PI);
  });
  it('applies drag and maximum speed', () => {
    const ship = new Ship();
    ship.vel = new Vector2(1000,0);ship.update(1,idle);
    expect(ship.vel.length()).toBeCloseTo(300);
    ship.update(1,idle);
    expect(ship.vel.length()).toBeLessThan(300);
  });
  it('counts down timers and stops them affecting damage', () => {
    const ship = new Ship();ship.shieldTime=0.25;ship.rapidFireTime=0.25;ship.fireCooldown=0.25;
    ship.update(0.5,idle);
    expect(ship.shieldTime).toBeLessThanOrEqual(0);
    expect(ship.rapidFireTime).toBeLessThanOrEqual(0);
    expect(ship.fireCooldown).toBeLessThanOrEqual(0);
    ship.takeDamage(1);expect(ship.hp).toBe(2);
    ship.takeDamage(1);expect(ship.hp).toBe(2);
    ship.update(1.1,idle);ship.takeDamage(1);expect(ship.hp).toBe(1);
    ship.update(1.1,idle);ship.takeDamage(100);expect(ship.hp).toBe(0);expect(ship.alive).toBe(false);
  });
  it('shield blocks damage, and pickups change their timers', () => {
    const ship = new Ship();ship.applyPickup('shield');
    expect(ship.shieldTime).toBe(5);ship.takeDamage(1);expect(ship.hp).toBe(3);
    ship.applyPickup('rapid-fire');expect(ship.rapidFireTime).toBe(5);
  });
  it('fires once per cooldown and includes owner and shot sequence', () => {
    const world = new World(), ship = world.spawn(new Ship(100,100));
    const events: string[]=[];world.events.subscribe(event=>events.push(event.type));
    ship.fire(world,7,'player-1');ship.fire(world,8,'player-1');
    const bullet=[...world.ofKind('bullet')][0];
    expect([...world.ofKind('bullet')]).toHaveLength(1);
    expect(bullet?.ownerId).toBe('player-1');expect(bullet?.shotSeq).toBe(7);
    expect(bullet?.pos.x).toBeCloseTo(115);expect(bullet?.vel.x).toBeCloseTo(500);
    expect(events).toEqual(['fired']);expect(ship.fireCooldown).toBeCloseTo(0.3);
    ship.update(0.31,idle);ship.applyPickup('rapid-fire');ship.fire(world);
    expect([...world.ofKind('bullet')]).toHaveLength(2);
    expect(ship.fireCooldown).toBeCloseTo(0.12);
  });
  it('restores ship fields from snapshot', () => {
    const ship=Ship.fromSnapshot({...snap('ship'),kind:'ship'});
    expect(ship.id).toBe(42);expect(ship.pos).toEqual(new Vector2(30,40));
    expect(ship.vel).toEqual(new Vector2(2,3));expect(ship.angle).toBe(0.5);expect(ship.radius).toBe(8);
  });
});

describe('entity lifecycle and snapshots',()=>{
  it.each([
    {x:5,y:100,vx:-50,vy:0,outX:10,outVx:50},
    {x:95,y:100,vx:50,vy:0,outX:90,outVx:-50},
    {x:50,y:5,vx:0,vy:-50,outY:10,outVy:50},
    {x:50,y:95,vx:0,vy:50,outY:90,outVy:-50},
  ])('asteroid bounces against boundary %#',({x,y,vx,vy,outX,outVx,outY,outVy})=>{
    const rock=new Asteroid(new Vector2(x,y),new Vector2(vx,vy),10,100,100);
    rock.update(0);
    if(outX!==undefined){expect(rock.pos.x).toBe(outX);expect(rock.vel.x).toBe(outVx);}
    if(outY!==undefined){expect(rock.pos.y).toBe(outY);expect(rock.vel.y).toBe(outVy);}
  });
  it('asteroid takes nonlethal then lethal damage and clamps HP',()=>{
    const rock=new Asteroid(new Vector2(50,50),new Vector2(),10,100,100);
    rock.takeDamage(1);expect(rock.hp).toBe(1);expect(rock.alive).toBe(true);
    rock.takeDamage(5);expect(rock.hp).toBe(0);expect(rock.alive).toBe(false);
  });
  it('asteroid restores snapshot properties',()=>{
    const rock=Asteroid.fromSnapshot({...snap('asteroid'),kind:'asteroid'});
    expect(rock.id).toBe(42);expect(rock.angle).toBe(0.5);
    expect(rock.pos).toEqual(new Vector2(30,40));
  });
  it('bullet moves until TTL expires',()=>{
    const bullet=new Bullet(new Vector2(0,0),new Vector2(10,0),0.5);
    bullet.update(0.2);expect(bullet.pos.x).toBeCloseTo(2);expect(bullet.alive).toBe(true);
    bullet.update(0.3);expect(bullet.alive).toBe(false);
  });
  it('bullet restores owner and shot sequence',()=>{
    const bullet=Bullet.fromSnapshot({...snap('bullet'),kind:'bullet',ownerId:'p',shotSeq:9});
    expect(bullet.id).toBe(42);expect(bullet.ownerId).toBe('p');expect(bullet.shotSeq).toBe(9);
  });
  it('pickup defaults to shield and restores type from snapshot',()=>{
    expect(new Pickup(1,2).type).toBe('shield');
    const pickup=Pickup.fromSnapshot({...snap('pickup'),kind:'pickup',pickupType:'rapid-fire'});
    expect(pickup.id).toBe(42);expect(pickup.type).toBe('rapid-fire');
  });
  it('explosion particles move and expire without mutating the origin',()=>{
    const center=new Vector2(50,60);
    const explosion=new Explosion(center,3,()=>0.5);
    expect(explosion.particles).toHaveLength(3);
    expect(explosion.particles[0]?.maxTtl).toBeCloseTo(0.65);
    explosion.update(0.1);expect(explosion.alive).toBe(true);
    expect(explosion.particles[0]?.pos.x).toBeLessThan(50);
    expect(center).toEqual(new Vector2(50,60));
    explosion.update(1);expect(explosion.particles).toHaveLength(0);expect(explosion.alive).toBe(false);
  });
  it('empty explosion dies immediately and snapshots restore the identity',()=>{
    const explosion=Explosion.fromSnapshot({...snap('explosion'),kind:'explosion'});
    expect(explosion.id).toBe(42);expect(explosion.particles).toHaveLength(0);
    explosion.update(0);expect(explosion.alive).toBe(false);
  });
});

describe('homing behaviour',()=>{
  const setup=()=>{
    const bullet=new Bullet(new Vector2(0,0),new Vector2(100,0));
    const target=new Ship(0,100);
    bullet.homing={targetId:target.id,turnRate:1};
    return {bullet,target};
  };
  it('does nothing without a live target',()=>{
    const {bullet,target}=setup();
    updateHoming(bullet,undefined,1);expect(bullet.vel.y).toBe(0);
    target.alive=false;updateHoming(bullet,target,1);expect(bullet.vel.y).toBe(0);
  });
  it('does nothing at zero distance or velocity',()=>{
    const {bullet,target}=setup();target.pos=new Vector2(0,0);
    updateHoming(bullet,target,1);expect(bullet.vel.y).toBe(0);
    target.pos=new Vector2(0,100);bullet.vel=new Vector2();
    updateHoming(bullet,target,1);expect(bullet.vel.length()).toBe(0);
  });
  it('limits positive turning and preserves speed',()=>{
    const {bullet,target}=setup();updateHoming(bullet,target,0.25);
    expect(Math.atan2(bullet.vel.y,bullet.vel.x)).toBeCloseTo(0.25);
    expect(bullet.vel.length()).toBeCloseTo(100);
  });
  it('limits negative turning and can finish the turn',()=>{
    const {bullet,target}=setup();target.pos=new Vector2(0,-100);
    updateHoming(bullet,target,0.25);
    expect(Math.atan2(bullet.vel.y,bullet.vel.x)).toBeCloseTo(-0.25);
    updateHoming(bullet,target,10);expect(bullet.vel.y).toBeLessThan(0);
  });
  it('world applies homing before moving the entity',()=>{
    const {bullet,target}=setup();const world=new World();world.spawn(bullet);world.spawn(target);
    world.step(0.25,new Map());expect(bullet.pos.y).toBeGreaterThan(0);
  });
});

describe('event bus',()=>{
  it('notifies active subscribers for all event kinds',()=>{
    const bus=createSimulationEvents(),seen:string[]=[];
    const unsubscribe=bus.subscribe(event=>seen.push(event.type));
    bus.emit('fired',null);bus.emit('hit',null);bus.emit('exploded',null);
    bus.emit('scoreChanged',10);
    unsubscribe();bus.emit('fired',null);
    expect(seen).toEqual(['fired','hit','exploded','scoreChanged']);
  });
  it('rejects nonnumeric scores at runtime',()=>{
    const bus=createSimulationEvents();
    expect(()=>bus.emit('scoreChanged','bad' as unknown as number)).toThrow(TypeError);
  });
});
