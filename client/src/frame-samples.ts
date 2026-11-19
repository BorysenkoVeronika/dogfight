/** In-browser collection for the before/after profiling report. */
const samples: number[] = [];
export function collectFrame(ms: number): void {
  if (Number.isFinite(ms) && ms >= 0) {
    samples.push(ms);
    if (samples.length > 18000) samples.shift();
  }
}
export function frameReport(): { count: number; p50: number; p95: number; p99: number } {
  const sorted = [...samples].sort((a,b) => a-b);
  const pct = (p: number) => sorted.length ? sorted[Math.min(sorted.length-1, Math.ceil(sorted.length*p)-1)] ?? 0 : 0;
  return { count: sorted.length, p50: pct(.5), p95: pct(.95), p99: pct(.99) };
}
export function downloadFrameSamples(): void {
  const rows = ['frame_ms', ...samples.map(x => x.toFixed(4))].join('\n');
  const href = URL.createObjectURL(new Blob([rows], {type: 'text/csv'}));
  const a = document.createElement('a');a.href = href;a.download = 'frame-samples.csv';a.click();
  URL.revokeObjectURL(href);
}
