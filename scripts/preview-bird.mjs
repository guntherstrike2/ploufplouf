// Preview d'un sprite oiseau → PNG agrandi, pour itérer en voyant le résultat.
// Usage: node scripts/preview-bird.mjs  → écrit /tmp/bird-preview.png
// Dépendance-free (PNG encodé à la main via zlib).

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// ─── ÉDITE ICI le sprite à prévisualiser ─────────────────────────────────────
const grid = [
  "...........yy...........",
  "..........kyyk..........",
  ".........kyWWyk.........",
  "........kWWWWWWk........",
  ".......kWddWWddWk.......",
  ".......kaeWWWWeak.......",
  "......kWWWWWWWWWWk......",
  ".....kbBBWWWWWWBBbk.....",
  "kBBBBBBBBBBBBBBBBBBBBBBk",
  "...kBBBBBBBBBBBBBBBBk...",
  ".kBBBBBBBBBBBBBBBBBBBBk.",
  "....kBBBBBBBBBBBBBBk....",
  "..kdBBBBBBBBBBBBBBBBdk..",
  "....kdBBBBBBBBBBBBdk....",
  ".....kBBBBBBBBBBBBk.....",
  ".....kBBBBBBBBBBBBk.....",
  "......kBBBBBBBBBBk......",
  "......kBBBBBBBBBBk......",
  ".......kBBBBBBBBk.......",
  ".......kBBWWWWBBk.......",
  ".......kWWWWWWWWk.......",
  "......kWWWWWWWWWWk......",
  ".......kWWWWWWWWk.......",
  "........kkkkkkkk........",
];
const palette = {
  k: "#1a1410", // contour
  W: "#f5f3ec", // plumes blanches (tête + queue)
  B: "#7a4a22", // corps brun
  b: "#a06a34", // brun clair (bord d'attaque)
  d: "#4a2c14", // brun foncé (bord de fuite)
  y: "#ffc233", // bec
  e: "#1a1410", // pupille
  a: "#ffd84a", // iris ambre
};
// ─────────────────────────────────────────────────────────────────────────────

const SCALE = 13;
const PAD = 1; // cellules de marge

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rows = grid.length;
const cols = Math.max(...grid.map((r) => r.length));

// Deux panneaux côte à côte : fond clair gris + fond forêt, pour juger la lisibilité.
const BGS = [
  [200, 200, 205],
  [58, 140, 40],
];
const panelW = (cols + PAD * 2) * SCALE;
const panelH = (rows + PAD * 2) * SCALE;
const W = panelW * BGS.length;
const H = panelH;

const buf = Buffer.alloc(W * H * 4);

function px(x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
}

for (let panel = 0; panel < BGS.length; panel++) {
  const bg = BGS[panel];
  const baseX = panel * panelW;
  // fond
  for (let y = 0; y < panelH; y++)
    for (let x = 0; x < panelW; x++) px(baseX + x, y, bg);
  // sprite
  for (let r = 0; r < rows; r++) {
    const line = grid[r];
    for (let c = 0; c < cols; c++) {
      const ch = line[c];
      if (!ch || ch === ".") continue;
      const col = palette[ch];
      if (!col) continue;
      const rgb = hexToRgb(col);
      const ox = baseX + (c + PAD) * SCALE;
      const oy = (r + PAD) * SCALE;
      for (let dy = 0; dy < SCALE; dy++)
        for (let dx = 0; dx < SCALE; dx++) px(ox + dx, oy + dy, rgb);
    }
  }
}

// ─── Encode PNG (RGBA, filtre 0) ──────────────────────────────────────────────
function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync("/tmp/bird-preview.png", png);
console.log(`écrit /tmp/bird-preview.png  (${cols}x${rows} → ${W}x${H})`);
