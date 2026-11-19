/** Parses replay NDJSON away from the browser main thread. */
self.onmessage = (event: MessageEvent<ArrayBuffer>): void => {
  const start = performance.now();
  try {
    const text = new TextDecoder().decode(event.data);
    const records = text.split('\n').filter(Boolean).map(line => JSON.parse(line) as unknown);
    self.postMessage({count: records.length, workerMs: performance.now()-start});
  } catch(error) { self.postMessage({error: String(error)}); }
};
