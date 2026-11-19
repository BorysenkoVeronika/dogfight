import {describe,it,expect} from 'vitest';
import {Ship} from '../sim/ship.ts';
import {World} from '../sim/world.ts';
import {Vector2} from '../sim/vector.ts';
import {Asteroid} from '../sim/asteroid.ts';
import {Bullet} from '../sim/bullet.ts';
import {Pickup} from '../sim/pickup.ts';
import {circleCircle} from '../sim/collision.ts';
import {inputAdapter} from '../sim/input.ts';
import {wrap} from '../sim/arena.ts';
import {determinismHash} from '../sim/determinism.ts';
const neutral=inputAdapter({thrust:false,turn:0});
describe('simulation unit and collision boundary cases',()=>{
  for(const dt of [1/120,1/60,1/30,1/15]){
    it(`neutral ship stays still dt=${dt}`,()=>{const ship=new Ship(50,50);ship.update(dt,neutral);expect(ship.pos.x).toBe(50);expect(ship.pos.y).toBe(50);});
    it(`thrust accelerates dt=${dt}`,()=>{const ship=new Ship(50,50);ship.update(dt,inputAdapter({thrust:true,turn:0}));expect(ship.pos.x).toBeGreaterThan(50);});
  }
  for(const distance of [0,3,9,19,23,24]){
    it(`touching/overlapping at distance=${distance}`,()=>{
      const a=new Ship(100,100),b=new Ship(100+distance,100);
      expect(circleCircle(a,b)).toBe(true);
    });
  }
  for(const distance of [25,30,100,500]){
    it(`noncolliding at distance=${distance}`,()=>{
      expect(circleCircle(new Ship(100,100),new Ship(100+distance,100))).toBe(false);
    });
  }
  it('edge wrap on both axes',()=>{
    const ship=new Ship(-1,501);wrap(ship,800,500);expect(ship.pos.x).toBe(799);expect(ship.pos.y).toBe(1);
  });
  it('asteroid bounce remains bounded',()=>{
    const rock=new Asteroid(new Vector2(10,20),new Vector2(-100,-100),10,800,500);
    rock.update(1/30);expect(rock.pos.x).toBeGreaterThanOrEqual(10);expect(rock.pos.y).toBeGreaterThanOrEqual(10);
  });
  it('fast bullet sweeping across an asteroid registers a hit rather than tunneling',()=>{
    const world=new World();const rock=world.spawn(new Asteroid(new Vector2(50,50),new Vector2(0,0),10,800,500));
    world.spawn(new Bullet(new Vector2(0,50),new Vector2(3000,0)));
    world.step(1/30,new Map());
    expect(rock.hp).toBe(1);
    expect([...world.ofKind('bullet')]).toHaveLength(0);
  });
  it('bullet expiration removes it after step',()=>{
    const world=new World();world.spawn(new Bullet(new Vector2(70,70),new Vector2(0,0),0.01));
    world.step(1/30,new Map());expect([...world.ofKind('bullet')]).toHaveLength(0);
  });
  it('ship collects shield pickup',()=>{
    const world=new World();const ship=world.spawn(new Ship(200,200));world.spawn(new Pickup(200,200,'shield'));
    world.step(0,new Map([[ship.id,neutral]]));expect(ship.shieldTime).toBe(5);
  });
  it('same seed and commands produce same world state',()=>{
    const one=new World(42),two=new World(42);const a=one.spawn(new Ship(400,250)),b=two.spawn(new Ship(400,250));
    for(let i=0;i<100;i++){
      const inp=inputAdapter({thrust:i%3===0,turn:i%2===0?-1:1});
      one.step(1/30,new Map([[a.id,inp]]));two.step(1/30,new Map([[b.id,inp]]));
    }
    expect([a.pos,a.vel,a.angle]).toEqual([b.pos,b.vel,b.angle]);
  });
  it('reference deterministic hash is stable',()=>expect(determinismHash()).toBe('04d96aea'));
});
