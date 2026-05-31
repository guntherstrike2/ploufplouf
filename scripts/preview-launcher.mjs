// Vérif hors-ligne du launcher : rejoue les transforms canvas (translate/rotate/
// fillRect) pour valider la rotation "fesses en avant" + l'écartement des pattes
// à la ponte, SANS lancer le jeu. Lit la grille de l'aigle depuis assets.ts.
// Usage: node scripts/preview-launcher.mjs  → /tmp/launcher.png

import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

// ─── Extrait la grille + palette de l'aigle depuis assets.ts ────────────────────
const src = readFileSync("src/apps/peagle/engine/assets.ts", "utf8");
const block = src.slice(src.indexOf('id: "aigle"'));
const grid = (block.match(/grid:\s*\[([\s\S]*?)\]/)[1].match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1));
const palText = block.match(/palette:\s*\{([\s\S]*?)\}/)[1];
const palette = {};
for (const m of palText.matchAll(/(\w+):\s*"(#[0-9a-fA-F]+)"/g)) palette[m[1]] = m[2];
const ROWS = grid.length, COLS = grid[0].length;

// ─── Mini moteur de transform (matrice 2×3) ─────────────────────────────────────
let M = [1, 0, 0, 1, 0, 0];
const stack = [];
const save = () => stack.push(M.slice());
const restore = () => { M = stack.pop(); };
function mul(n) { // M = M ∘ n  (n appliqué en local d'abord)
  const [a, b, c, d, e, f] = M, [na, nb, nc, nd, ne, nf] = n;
  M = [a * na + c * nb, b * na + d * nb, a * nc + c * nd, b * nc + d * nd, a * ne + c * nf + e, b * ne + d * nf + f];
}
const translate = (x, y) => mul([1, 0, 0, 1, x, y]);
const rotate = (t) => mul([Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0]);
const scale = (s) => mul([s, 0, 0, s, 0, 0]);
const tp = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];

// ─── Buffer + raster de quad ────────────────────────────────────────────────────
const IMG = 170;
let buf, panelOX;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function fillQuad(pts, [r, g, b]) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs = [];
    for (let i = 0; i < 4; i++) {
      const A = pts[i], B = pts[(i + 1) % 4];
      if ((A[1] <= y && B[1] > y) || (B[1] <= y && A[1] > y)) xs.push(A[0] + ((y - A[1]) / (B[1] - A[1])) * (B[0] - A[0]));
    }
    xs.sort((u, v) => u - v);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
        const px = panelOX + x, py = y;
        if (px < 0 || py < 0 || px >= W || py >= IMG) continue;
        const idx = (py * W + px) * 4; buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
      }
  }
}
function fillRect(x, y, w, h, color) {
  fillQuad([tp(x, y), tp(x + w, y), tp(x + w, y + h), tp(x, y + h)], hex(color));
}

// ─── Réplique de ui.ts : pattes + launcher ──────────────────────────────────────
function drawTalonLeg(dir, hipX, hipY, ang, len) {
  const ORANGE = "#f0a81e", DARK = "#b97812", OUT = "#1a120a";
  save(); translate(dir * hipX, hipY); rotate(-dir * ang);
  fillRect(-2, -1, 4, len + 2, OUT); fillRect(-1.5, 0, 3, len, ORANGE); fillRect(0.3, 1, 1, len - 1, DARK);
  for (const toe of [-0.5, 0, 0.5]) { save(); translate(0, len); rotate(toe); fillRect(-1.5, 0, 3, 7, OUT); fillRect(-1, 0, 2, 6, ORANGE); restore(); }
  restore();
}
function drawLauncher(aimAngle, ponte) {
  save();
  rotate(aimAngle - Math.PI / 2);
  const ang = 0.12 + ponte * 0.8;
  drawTalonLeg(-1, 3.5, 12, ang, 13);
  drawTalonLeg(+1, 3.5, 12, ang, 13);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = grid[r][c]; if (ch === "." || !palette[ch]) continue;
    fillRect(c - COLS / 2, r - ROWS / 2, 1, 1, palette[ch]);
  }
  restore();
}

// ─── 3 scénarios ─────────────────────────────────────────────────────────────────
const scenes = [
  { aim: Math.PI / 2, ponte: 0, label: "repos (bas)" },
  { aim: Math.PI / 2, ponte: 1, label: "PONTE (bas)" },
  { aim: 0.7, ponte: 1, label: "PONTE inclinée" },
];
const W = IMG * scenes.length;
buf = Buffer.alloc(W * IMG * 4);
for (let i = 0; i < W * IMG; i++) buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = 235, buf[i * 4 + 3] = 255;
scenes.forEach((sc, i) => {
  panelOX = i * IMG;
  M = [1, 0, 0, 1, 0, 0]; translate(IMG / 2, IMG / 2 - 20); scale(2.6);
  drawLauncher(sc.aim, sc.ponte);
});

// ─── PNG ──────────────────────────────────────────────────────────────────────
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const ty = Buffer.from(t, "ascii"); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([ty, d])), 0); return Buffer.concat([l, ty, d, cr]); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(IMG, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * IMG);
for (let y = 0; y < IMG; y++) { raw[y * (W * 4 + 1)] = 0; buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
writeFileSync("/tmp/launcher.png", Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log("écrit /tmp/launcher.png —", scenes.map((s) => s.label).join(" | "));
