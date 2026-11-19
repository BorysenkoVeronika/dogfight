/** Browser User Timing spans: visible in Chrome Performance traces. */
export type Span = 'simulate' | 'render' | 'decode' | 'reconcile';
export function measure<T>(name: Span, work: () => T): T {
  const start = `${name}:start`;
  const end = `${name}:end`;
  performance.mark(start);
  try { return work(); }
  finally { performance.mark(end); performance.measure(name, start, end); }
}
