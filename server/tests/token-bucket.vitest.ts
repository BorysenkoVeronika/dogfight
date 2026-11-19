import {describe,it,expect} from 'vitest';
import {TokenBucket} from '../src/token-bucket.ts';
describe('token-bucket rate limiter with clock injection',()=>{
  it('rejects invalid setup',()=>expect(()=>new TokenBucket(0,1)).toThrow(RangeError));
  it('consumes exactly initial burst',()=>{
    const bucket=new TokenBucket(10,5,()=>0);
    for(let i=0;i<5;i++)expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });
  it('refills exactly ten tokens per second',()=>{
    let now=0;const bucket=new TokenBucket(10,10,()=>now);
    for(let i=0;i<10;i++)bucket.consume();
    now=500;for(let i=0;i<5;i++)expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });
  it('does not refill on backwards clock jump',()=>{
    let t=100;const bucket=new TokenBucket(1,1,()=>t);bucket.consume();t=0;expect(bucket.consume()).toBe(false);
  });
});
