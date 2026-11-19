import {describe,it,expect} from 'vitest';
import {Vector2} from '../sim/vector.ts';
import {mulberry32} from '../sim/random.ts';
describe('Vector2 pure operators',()=>{
  for(const x of [-100,-7,-1,0,1,7,100]) for(const y of [-11,0,11]){
    it(`addition and subtraction roundtrip x=${x} y=${y}`,()=>{
      const a=new Vector2(x,y),b=new Vector2(13,-5);
      expect(a.add(b).sub(b)).toEqual(a);
      expect(a).toEqual(new Vector2(x,y));
    });
  }
  for(const degrees of [0,30,45,60,90,120,180,270,360]){
    it(`rotation preserves length at ${degrees} degrees`,()=>{
      const a=new Vector2(3,4);
      expect(a.rotate(degrees*Math.PI/180).length()).toBeCloseTo(5,9);
    });
  }
  for(const n of [0,1,2,3,5,10,20,50]){
    it(`scaling preserves magnitude factor ${n}`,()=>{
      expect(new Vector2(3,4).scale(n).length()).toBeCloseTo(5*n,8);
    });
  }
  it('zero normalize is safe',()=>expect(new Vector2().normalize()).toEqual(new Vector2()));
  it('normalization is length one',()=>expect(new Vector2(4,3).normalize().length()).toBeCloseTo(1));
  it('dot product is orthogonal',()=>expect(new Vector2(2,0).dot(new Vector2(0,5))).toBe(0));
  it('fromAngle points right',()=>expect(Vector2.fromAngle(0).x).toBe(1));
  it('PRNG same seed has same sequence',()=>{
    const a=mulberry32(123),b=mulberry32(123);
    for(let i=0;i<200;i++)expect(a()).toBe(b());
  });
});
