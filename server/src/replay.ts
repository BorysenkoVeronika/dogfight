
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

const logsDirectory = resolve(
    process.env.LOG_DIR ?? join(currentDir, 'logs')
);

export function getReplayPath(id: string): string {
    if (!/^[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_.-]+)*$/.test(id)) {
        throw new Error('Invalid replay ID');
    }

    return join(logsDirectory, `${id}.ndjson`);
}

export async function getReplaySize(id: string): Promise<number> {
    const file = await stat(getReplayPath(id));

    if (!file.isFile()) {
        throw new Error('Replay is not a file');
    }

    return file.size;
}

export async function* replayEvents(id: string): AsyncGenerator<unknown> {
    const stream = createReadStream(getReplayPath(id), {
        encoding: 'utf8',
    });

    const lines = createInterface({
        input: stream,
        crlfDelay: Infinity,
    });

    try {
        for await (const line of lines) {
            if (line.trim()) {
                yield JSON.parse(line);
            }
        }
    } finally {
        lines.close();
        stream.destroy();
    }
}
