/** Generate an SVG chart from measured load-results.csv (no fabricated samples). */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const rows=(await readFile('load-results.csv','utf8')).trim().split(/\r?\n/);
const columns=rows.shift()?.split(',')??[];
const x=columns.indexOf('requested'),y=columns.indexOf('tickP99Ms');
if(x<0||y<0)throw new Error('Missing columns in load-results.csv');
const values=rows.map(r=>r.split(',')).map(parts=>({clients:Number(parts[x]),p99:Number(parts[y])})).filter(p=>Number.isFinite(p.clients)&&Number.isFinite(p.p99));
if(!values.length)throw new Error('No measured results');
const max=Math.max(33,...values.map(p=>p.p99))*1.2;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 420"><rect width="780" height="420" fill="white"/><text x="40" y="36" font-family="sans-serif" font-size="19">Load ramp — measured server tick p99</text><line x1="65" y1="355" x2="745" y2="355" stroke="black"/><line x1="65" y1="70" x2="65" y2="355" stroke="black"/><line x1="65" y1="${355-33/max*275}" x2="745" y2="${355-33/max*275}" stroke="crimson" stroke-dasharray="6 4"/><text x="590" y="${345-33/max*275}" font-family="sans-serif" fill="crimson">33 ms tick budget</text>${values.map((p,i)=>{const xp=100+i*195;const yp=355-p.p99/max*275;return `<circle cx="${xp}" cy="${yp}" r="6" fill="#2b6cb0"/><text x="${xp-18}" y="${Math.max(70,yp-14)}" font-family="sans-serif" font-size="13">${p.p99.toFixed(2)} ms</text><text x="${xp-15}" y="377" font-family="sans-serif" font-size="14">${p.clients}</text>`;}).join('')}<text x="350" y="405" font-family="sans-serif">Requested clients</text><text x="10" y="65" font-family="sans-serif" font-size="13">p99 ms</text></svg>`;
await mkdir('docs',{recursive:true});
await writeFile('docs/lab07-load-capacity.svg',svg);
console.log('Created docs/lab07-load-capacity.svg');
