
function createAbortError() {
    return new DOMException('The operation was aborted', 'AbortError');
}

function checkAbort(signal) {
    if (signal?.aborted) throw signal.reason ?? createAbortError();
}

function delay(ms, signal) {
    return new Promise((resolve, reject) => {
        checkAbort(signal);

        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);

        function onAbort() {
            clearTimeout(timer);
            reject(signal.reason ?? createAbortError());
        }

        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

export async function withRetry(
    fn,
    { attempts = 3, baseMs = 300, signal } = {}
) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        checkAbort(signal);

        try {
            return await fn(signal);
        } catch (error) {
            if (signal?.aborted || error.name === 'AbortError') {
                throw error;
            }

            if (error.status >= 400 && error.status < 500) {
                throw error;
            }

            if (attempt === attempts - 1) {
                throw error;
            }

            const backoff = baseMs * 2 ** attempt;
            const jitter = Math.random() * backoff * 0.25;

            await delay(backoff + jitter, signal);
        }
    }
}

export async function fetchJson(url, signal) {
    const response = await fetch(url, { signal });

    if (!response.ok) {
        const error = new Error(
            `Failed to load ${url}: ${response.status}`
        );
        error.status = response.status;
        throw error;
    }

    return response.json();
}

export async function loadJson(url, signal) {
    return fetchJson(url, signal);
}


export async function loadImage(url, signal) {
    checkAbort(signal);

    const image = new Image();

    return new Promise((resolve, reject) => {
        function cleanup() {
            image.onload = null;
            image.onerror = null;
            signal?.removeEventListener('abort', onAbort);
        }

        function onAbort() {
            cleanup();
            image.src = '';
            reject(signal.reason ?? createAbortError());
        }

        image.onload = () => {
            cleanup();
            resolve(image);
        };

        image.onerror = () => {
            cleanup();
            reject(new Error(`Failed to load image ${url}`));
        };

        signal?.addEventListener('abort', onAbort, { once: true });

        if (signal?.aborted) {
            onAbort();
            return;
        }

        image.src = url;
    });
}


export async function loadAudio(ctx, url, signal) {
    if (!ctx) {
        throw new Error('An AudioContext is required to load audio');
    }

    const response = await fetch(url, { signal });

    if (!response.ok) {
        const error = new Error(
            `Failed to load audio ${url}: ${response.status}`
        );
        error.status = response.status;
        throw error;
    }

    const buffer = await response.arrayBuffer();
    checkAbort(signal);

    return ctx.decodeAudioData(buffer);
}

export async function loadAll(
    manifest,
    {
        ctx,
        onProgress = () => { },
        signal,
        concurrent = true
    } = {}
) {
    const tasks = [];

    for (const [name, url] of Object.entries(manifest.sprites ?? {})) {
        tasks.push({
            category: 'sprites',
            name,
            load: () => loadImage(url, signal)
        });
    }

    for (const [name, url] of Object.entries(manifest.sounds ?? {})) {
        tasks.push({
            category: 'sounds',
            name,
            load: () => loadAudio(ctx, url, signal)
        });
    }

    if (manifest.arena) {
        tasks.push({
            category: 'arena',
            name: 'arena',
            load: () => loadJson(manifest.arena, signal)
        });
    }

    const total = tasks.length;
    let completed = 0;

    onProgress(0, 0, total);

    async function loadTask(task) {
        const value = await withRetry(task.load, { signal });

        completed++;
        onProgress(completed / total, completed, total);

        return {
            category: task.category,
            name: task.name,
            value
        };
    }

    let results;

    if (concurrent) {
        results = await Promise.all(tasks.map(loadTask));
    } else {
        results = [];

        for (const task of tasks) {
            results.push(await loadTask(task));
        }
    }

    const assets = {
        sprites: {},
        sounds: {},
        arena: null
    };

    for (const result of results) {
        if (result.category === 'arena') {
            assets.arena = result.value;
        } else {
            assets[result.category][result.name] = result.value;
        }
    }

    return assets;
}
