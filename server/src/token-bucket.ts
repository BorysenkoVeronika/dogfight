/** Per-connection refillable token bucket, using an injectable monotonic clock. */
export class TokenBucket {
  readonly rate: number;
  readonly burst: number;
  private readonly clock: () => number;
  private tokens: number;
  private last: number;
  constructor(rate: number, burst: number, clock: () => number = () => performance.now()) {
    this.rate = rate; this.burst = burst; this.clock = clock;
    if (!(rate > 0 && burst > 0)) throw new RangeError('Invalid rate limits');
    this.tokens = burst;
    this.last = clock();
  }
  consume(): boolean {
    const now = this.clock();
    this.tokens = Math.min(this.burst, this.tokens + Math.max(0, now - this.last) * this.rate / 1000);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
  get available(): number { return this.tokens; }
}
