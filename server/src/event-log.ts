import type {Room} from './room.ts';
import type {TransformCallback} from 'node:stream';

import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PassThrough, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const currentDir = dirname(fileURLToPath(import.meta.url));

const logsDirectory = resolve(
    process.env.LOG_DIR ?? join(currentDir, 'logs')
);

mkdirSync(logsDirectory, { recursive: true });

const activeLogs = new Set<{source:PassThrough;task:Promise<void>;closed:boolean}>();
const pendingLogs = new Set<Promise<void>>();

class NDJSONTransform extends Transform {
    constructor() {
        super({
            writableObjectMode: true,
        });
    }

    _transform(event: unknown, encoding: BufferEncoding, callback: TransformCallback): void {
        try {
            callback(null, `${JSON.stringify(event)}\n`);
        } catch (error) {
            callback(error instanceof Error ? error : new Error(String(error)));
        }
    }
}

export function logRoomEvents(room: Room): void {
    const source = new PassThrough({
        objectMode: true,
    });

    const timestamp = new Date()
        .toISOString()
        .replaceAll(':', '-')
        .replaceAll('.', '-');

    const safeRoomId = room.id.replace(/[^a-zA-Z0-9_-]/g, '_');

    const filePath = join(
        logsDirectory,
        `${safeRoomId}-${timestamp}.ndjson`
    );

    const destination = createWriteStream(filePath);

    const logTask = pipeline(
        source,
        new NDJSONTransform(),
        destination
    );

    // Attach a rejection handler immediately.
    logTask.catch((error) => {
        console.error(`Log pipeline failed for ${room.id}:`, error);
    });

    const log = {
        source,
        task: logTask,
        closed: false,
    };

    activeLogs.add(log);
    pendingLogs.add(logTask);

    void logTask.finally(() => {
        activeLogs.delete(log);
        pendingLogs.delete(logTask);
    }).catch(() => { });

    function record(type: string, data: Record<string,unknown>): void {
        if (log.closed || source.destroyed) return;

        source.write({
            t: new Date().toISOString(),
            roomId: room.id,
            type,
            ...data,
        });
    }

    room.on('join', (player) => {
        record('join', {
            playerId: player.id,
            playerName: player.name,
        });
    });

    room.on('leave', (player) => {
        record('leave', {
            playerId: player.id,
            playerName: player.name,
        });
    });

    room.on('chat', ({ player, message }) => {
        record('chat', {
            playerId: player.id,
            playerName: player.name,
            message,
        });
    });

    room.on('empty', () => {
        log.closed = true;
        source.end();
    });
}

export async function closeEventLog() {
    for (const log of activeLogs) {
        if (!log.closed) {
            log.closed = true;
            log.source.end();
        }
    }

    const results = await Promise.allSettled([...pendingLogs]);

    const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);

    if (errors.length > 0) {
        throw new AggregateError(errors, 'Failed to close event logs');
    }
}
