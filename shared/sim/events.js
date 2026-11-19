export function createSimulationEvents() {
    const listeners = new Set();

    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        emit(type, detail = null) {
            for (const listener of listeners) {
                listener({ type, detail });
            }
        },
    };
}