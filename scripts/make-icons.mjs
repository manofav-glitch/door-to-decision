// Draws the app icon (ink square, paper panel, red heartbeat line) with no dependencies.
// Run: node scripts/make-icons.mjs   → writes public/icon.svg and public/icon-*.png
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const INK = [26, 25, 21];
const PAPER = [246, 243, 234];
const RED = [198, 40, 40];
const PANEL = [0.2, 0.8];
const LINE = [[0.26, 0.52], [0.4, 0.52], [0.46, 0.38], [0.54, 0.66], [0.6, 0.52], [0.74, 0.52]];
const STROKE = 0.045;

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function colourAt(x, y) {
  const d = Math.min(...LINE.slice(1).map((p, i) => distToSegment(x, y, LINE[i], p)));
  if (d < STROKE / 2) return RED;
  if (x > PANEL[0] && x < PANEL[1] && y > PANEL[0] && y < PANEL[1]) return PAPER;
  return INK;
}

function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const ss = 3; // supersampling for smooth edges
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = colourAt((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
        sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
      }
      for (let i = 0; i < 3; i++) raw[y * (size * 3 + 1) + 1 + x * 3 + i] = Math.round(sum[i] / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const pts = LINE.map(([x, y]) => `${x * 512},${y * 512}`).join(' ');
writeFileSync('public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${hex(INK)}"/>
  <rect x="${PANEL[0] * 512}" y="${PANEL[0] * 512}" width="${(PANEL[1] - PANEL[0]) * 512}" height="${(PANEL[1] - PANEL[0]) * 512}" fill="${hex(PAPER)}"/>
  <polyline points="${pts}" fill="none" stroke="${hex(RED)}" stroke-width="${STROKE * 512}" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
`);
writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
writeFileSync('public/icon-512-maskable.png', png(512));
console.log('icons written');
