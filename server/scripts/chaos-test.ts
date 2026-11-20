/** Lab 08 staging-only chaos checks; starts an isolated local production server. */
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';
import { once } from 'node:events';

const port = 31000 + Math.floor(Math.random() * 10000);
const origin = `http://127.0.0.1:${port}`;
const base = `http://127.0.0.1:${port}`;
const results: Record<string, unknown> = {};
const child = spawn(process.execPath, ['server/dist/index.js'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'test', PORT: String(port), HOST: '127.0.0.1',
    ALLOWED_ORIGINS: origin, MAX_CONNECTIONS_PER_IP: '3', MAX_ROOMS: '10', MAX_PLAYERS_PER_ROOM: '8',
    LOG_DIR: '/tmp/dogfight-chaos-' + port },
});
const sockets: WebSocket[] = [];
let stderr = '';
child.stderr?.on('data', (chunk:Buffer) => { stderr += chunk.toString('utf8'); });
async function ready(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited early: ${stderr}`);
    try { if ((await fetch(base + '/ready')).ok) return; } catch { /* startup */ }
    await sleep(100);
  }
  throw new Error(`Server was not ready: ${stderr}`);
}
async function connect(roomId:string, acceptedOrigin = origin):Promise<WebSocket> {
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws?codec=binary', { origin: acceptedOrigin });
  sockets.push(ws);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve); ws.once('error', reject);
  });
  ws.send(JSON.stringify({ v:0, type:'join', playerName:'Chaos player', roomId }));
  return ws;
}
async function rejected(originToTry:string):Promise<boolean> {
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws', {origin:originToTry});
  return new Promise(resolve => {
    ws.once('open', () => { ws.terminate();resolve(false); });
    ws.once('error', () => resolve(true));
  });
}
try {
  await ready();
  results.invalidOriginRejected = await rejected('https://untrusted.example');
  const roomA = await connect('room-1');
  const roomB = await connect('room-2');
  results.thirdSocketOpened = (await connect('room-2')).readyState === WebSocket.OPEN;
  results.perIpLimitRejected = await rejected(origin);
  const before = await fetch(base + '/metrics').then(r => r.json()) as { tickP99Ms:number };
  // Garbage flood: the invalid frame must close only its source connection.
  for (let i = 0; i < 1000 && roomA.readyState === WebSocket.OPEN; i++) roomA.send('{invalid-json');
  await sleep(1800);
  const after = await fetch(base + '/metrics').then(r => r.json()) as { tickP99Ms:number; rejectedConnections:Record<string,number> };
  results.garbageFrameClosed = roomA.readyState !== WebSocket.OPEN;
  results.otherRoomStillConnected = roomB.readyState === WebSocket.OPEN;
  results.tickP99BeforeMs = before.tickP99Ms;
  results.tickP99AfterMs = after.tickP99Ms;
  results.rejectedConnections = after.rejectedConnections;
  const closed = new Promise<void>(resolve => {roomB.once('close', resolve);});
  const started = performance.now();
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await Promise.race([closed, sleep(5000).then(() => {throw new Error('No WS close after SIGTERM');})]);
  await Promise.race([exited, sleep(8000).then(() => {throw new Error('Server did not exit');})]);
  results.shutdownMs = Math.round(performance.now() - started);
  results.serverExitCode = child.exitCode;
  results.gracefulExit = child.exitCode === 0 && (results.shutdownMs as number) < 10000;
  results.pass = results.invalidOriginRejected && results.perIpLimitRejected && results.garbageFrameClosed && results.otherRoomStillConnected && results.gracefulExit;
} finally {
  for (const socket of sockets) if (socket.readyState !== 3) socket.terminate();
  if (child.exitCode === null) child.kill('SIGKILL');
  await writeFile('chaos-results.json', JSON.stringify(results, null, 2) + '\n');
}
console.log(results);
if (!results.pass) process.exitCode = 1;
