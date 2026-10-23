/**
 * Generate PWA icons (192/512 PNG) without any native image dependency.
 * Pure Node: zlib + a hand-rolled PNG encoder (CRC32, IHDR, IDAT, IEND).
 *   node tools/icons.mjs  →  public/icons/icon-192.png, public/icons/icon-512.png
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- palette ----------
const NAVY = [11, 36, 71, 255];        // #0b2447
const NAVY_LIGHT = [25, 55, 109, 255]; // #19376d
const WHITE = [255, 255, 255, 255];
const ICE = [165, 215, 232, 255];      // #a5d7e8
const AMBER = [245, 179, 1, 255];      // #f5b301
const TRANSPARENT = [0, 0, 0, 0];

// ---------- 5x7 block font for the icon glyph ----------
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
};

// ---------- pixel canvas ----------
function makeCanvas(size) {
  return { size, px: new Uint8Array(size * size * 4) };
}

function setPx(c, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  // simple alpha blend over existing pixel
  if (a === 255 || c.px[i + 3] === 0) {
    c.px[i] = r; c.px[i + 1] = g; c.px[i + 2] = b; c.px[i + 3] = a;
  } else {
    const oldA = c.px[i + 3] / 255;
    const newA = a / 255 + oldA * (1 - a / 255);
    const mix = (nc, oc) => Math.round((nc * (a / 255) + oc * oldA * (1 - a / 255)) / newA);
    c.px[i] = mix(r, c.px[i]); c.px[i + 1] = mix(g, c.px[i + 1]); c.px[i + 2] = mix(b, c.px[i + 2]);
    c.px[i + 3] = Math.round(newA * 255);
  }
}

function fillRect(c, x, y, w, h, color) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPx(c, i, j, color);
}

function roundedBg(c, color, border) {
  const s = c.size;
  const r = Math.round(s * 0.2);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // rounded-rect coverage test
      const dx = Math.max(r - x, x - (s - 1 - r), 0);
      const dy = Math.max(r - y, y - (s - 1 - r), 0);
      const inside = dx * dx + dy * dy <= r * r;
      const onBorder = inside && (dx * dx + dy * dy >= (r - border) * (r - border) || x < border || y < border || x > s - 1 - border || y > s - 1 - border);
      if (inside) setPx(c, x, y, onBorder ? NAVY_LIGHT : color);
    }
  }
}

function drawText(c, text, cell, startX, startY, color) {
  let x = startX;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (!glyph) { x += cell * 6; continue; }
    for (let gy = 0; gy < glyph.length; gy++) {
      for (let gx = 0; gx < glyph[gy].length; gx++) {
        if (glyph[gy][gx] === '#') fillRect(c, x + gx * cell, startY + gy * cell, cell, cell, color);
      }
    }
    x += cell * 6; // 5 wide + 1 space
  }
}

function drawIcon(size) {
  const c = makeCanvas(size);
  const u = size / 64; // design grid unit (design is 64x64 like the SVG)

  roundedBg(c, NAVY, Math.max(1, Math.round(u * 2)));

  // top amber bar (signal banner)
  fillRect(c, Math.round(18 * u), Math.round(10 * u), Math.round(28 * u), Math.round(4 * u), AMBER);

  // ALP letters
  const cell = Math.max(1, Math.round(3.6 * u)); // 5*3.6 = 18 wide per letter
  const textW = cell * 17;  // 3 letters * 5 + 2 gaps = 17 cells wide
  const textH = cell * 7;
  const tx = Math.round((size - textW) / 2);
  const ty = Math.round(18 * u);
  drawText(c, 'ALP', cell, tx, ty, WHITE);

  // signal dot
  const cx = Math.round(32 * u), cy = Math.round(40 * u), rr = Math.round(3.2 * u);
  for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= rr * rr) setPx(c, x, y, AMBER);
  }

  // railway track (two rails + two sleepers)
  const railW = Math.max(1, Math.round(3.5 * u));
  fillRect(c, Math.round(14 * u), Math.round(46 * u), railW, Math.round(12 * u), ICE);
  fillRect(c, Math.round(46.5 * u), Math.round(46 * u), railW, Math.round(12 * u), ICE);
  fillRect(c, Math.round(12 * u), Math.round(49 * u), Math.round(40 * u), Math.max(1, Math.round(3 * u)), ICE);
  fillRect(c, Math.round(12 * u), Math.round(55 * u), Math.round(40 * u), Math.max(1, Math.round(3 * u)), ICE);

  return c;
}

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let cc = n;
    for (let k = 0; k < 8; k++) cc = cc & 1 ? 0xedb88320 ^ (cc >>> 1) : cc >>> 1;
    t[n] = cc;
  }
  return t;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(c) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.size, 0);
  ihdr.writeUInt32BE(c.size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // scanlines with filter byte 0
  const raw = Buffer.alloc(c.size * (c.size * 4 + 1));
  for (let y = 0; y < c.size; y++) {
    raw[y * (c.size * 4 + 1)] = 0;
    Buffer.from(c.px.buffer, y * c.size * 4, c.size * 4).copy(raw, y * (c.size * 4 + 1) + 1);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- main ----------
const dir = join(root, 'public', 'icons');
mkdirSync(dir, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePNG(drawIcon(size));
  const out = join(dir, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`✓ wrote ${out} (${(png.length / 1024).toFixed(1)} kB)`);
}
