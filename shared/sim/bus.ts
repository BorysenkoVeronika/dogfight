/** Generic event bus: the event name selects the payload type at the API boundary. */
export class Bus<Events extends object> {
 private listeners = new Map<keyof Events, Set<(payload:never)=>void>>();
 on<K extends keyof Events>(name: K, handler: (payload: Events[K]) => void): () => void {
  const set = this.listeners.get(name) ?? new Set<(payload:never)=>void>();
  set.add(handler);
  this.listeners.set(name, set);
  return () => { set.delete(handler); };
 }
 emit<K extends keyof Events>(name: K, payload: Events[K]): void {
  for (const handler of this.listeners.get(name) ?? []) Reflect.apply(handler, undefined, [payload]);
 }
}
