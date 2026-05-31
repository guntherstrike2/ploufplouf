// Générateur d'aigle 48×48 par formes → PNG de preview + grille ASCII pour assets.ts.
// On sculpte avec des ellipses/polygones (moitié gauche, miroir auto sur x=23.5),
// le contour sombre est ajouté par détection de bord. Itère en éditant SHAPES.
//
// Usage: node scripts/gen-eagle.mjs   → /tmp/eagle.png  + grille imprimée

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const N = 48;             // grille N×N
const CX = (N - 1) / 2;   // axe de symétrie (23.5)

// ─── Palette ──────────────────────────────────────────────────────────────────
const PAL = {
  ".": null,
  k: "#1a120a", // contour
  // tête / queue blanches
  H: "#ffffff", W: "#e9eef2", w: "#bcc7d2", g: "#8a9bad",
  // bec
  Y: "#ffd24a", y: "#f5a623", o: "#b86c14",
  // oeil
  a: "#ffcc33",
  // corps / ailes brun
  B: "#a06a34", m: "#7a4a22", d: "#4f2f16", D: "#301c0d",
  // pattes
  L: "#f0a81e", l: "#b97812",
};

const grid = Array.from({ length: N }, () => Array(N).fill("."));

const set = (x, y, c) => {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi >= 0 && yi >= 0 && xi < N && yi < N) grid[yi][xi] = c;
};

// ellipse pleine
function ellipse(cx, cy, rx, ry, c) {
  for (let y = Math.ceil(cy - ry); y <= cy + ry; y++)
    for (let x = Math.ceil(cx - rx); x <= cx + rx; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(x, y, c);
    }
}

// polygone plein (scanline)
function poly(pts, c) {
  const ys = pts.map((p) => p[1]);
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) set(x, y, c);
  }
}

const mPts = (pts) => pts.map(([x, y]) => [2 * CX - x, y]);

// ─── SCULPTE ICI (de l'arrière vers l'avant) ────────────────────────────────────

// Doigts de rémiges primaires (sous l'aile) — séparés par des fentes de fond.
const prim = (pts, c) => { poly(pts, c); poly(mPts(pts), c); };
prim([[0, 24], [0, 34], [2, 37], [3, 27]], "D");   // primaire externe (la plus basse)
prim([[4, 26], [4, 37], [6, 37], [6, 28]], "d");
prim([[8, 28], [8, 37], [10, 36], [10, 29]], "D");
prim([[12, 29], [12, 35], [14, 34], [13, 30]], "d");

// Aile solide (haut + couvertures), levée et large.
const wingL = [
  [22, 16], [13, 12], [5, 13], [1, 18], [0, 23],
  [2, 28], [9, 29], [16, 28], [20, 25], [22, 20],
];
poly(wingL, "m"); poly(mPts(wingL), "m");

// Bord d'attaque clair (rangée de couvertures supérieures)
const covL = [[21, 16], [11, 13], [4, 15], [2, 19], [10, 19], [19, 19]];
poly(covL, "B"); poly(mPts(covL), "B");
// Rangée de couvertures médianes (bords clairs feuilletés)
for (const x of [4, 8, 12, 16]) { ellipse(x, 23, 2.2, 1.4, "B"); ellipse(2 * CX - x, 23, 2.2, 1.4, "B"); }
// Ombre basse de l'aile (jonction avec les primaires)
const shdL = [[18, 25], [6, 26], [1, 27], [3, 29], [11, 29], [17, 28]];
poly(shdL, "d"); poly(mPts(shdL), "d");

// Queue (derrière le corps, bas) — plumes blanches à pointe sombre
poly([[19, 31], [29, 31], [27, 45], [21, 45]], "W");
poly([[20, 41], [28, 41], [27, 45], [21, 45]], "g");

// Corps (brun)
ellipse(CX, 27, 10, 14, "m");
// poitrail plus clair
ellipse(CX, 30, 7, 11, "B");
// écailles de plumes du poitrail : petits chevrons sombres, symétriques
for (let row = 0; row < 4; row++) {
  const y = 25 + row * 4;
  for (let i = 0; i < 3; i++) {
    const off = i * 5 - 5;
    set(CX + off - 1.5, y, "m"); set(CX + off, y + 1, "d"); set(CX + off + 1.5, y, "m");
  }
}

// Pattes + serres (jaune)
poly([[18, 38], [22, 38], [22, 46], [18, 46]], "L"); // tibia gauche
poly([[26, 38], [30, 38], [30, 46], [26, 46]], "L"); // tibia droit
// serres écartées
poly([[15, 45], [23, 45], [22, 47], [16, 47]], "L");
poly([[25, 45], [33, 45], [32, 47], [26, 47]], "L");

// Collerette blanche (jonction tête/corps)
ellipse(CX, 18, 12, 6, "W");

// Tête (blanche)
ellipse(CX, 10, 8, 9, "W");
// ombres de la tête (côtés bleutés)
ellipse(CX, 11, 8, 9, "w");
ellipse(CX, 10, 6, 7, "W");
ellipse(CX, 8, 5, 5, "H"); // reflet haut

// Bec crochu (jaune) au centre
poly([[20, 11], [28, 11], [26, 17], [24, 20], [22, 17]], "y");
poly([[24, 17], [22, 16], [24, 21]], "o"); // crochet ombre
poly([[20, 11], [28, 11], [27, 13], [21, 13]], "Y"); // haut clair du bec

// Yeux (ambre + pupille) + sourcils froncés
ellipse(18, 9, 2.2, 2.2, "a"); ellipse(30, 9, 2.2, 2.2, "a");
set(18, 9, "k"); set(30, 9, "k"); // pupille
poly([[15, 6], [21, 7], [21, 8], [15, 8]], "g"); // sourcil gauche
poly([[33, 6], [27, 7], [27, 8], [33, 8]], "g"); // sourcil droit

// ─── Contour automatique (bord de la silhouette) ────────────────────────────────
const out = grid.map((r) => r.slice());
for (let y = 0; y < N; y++)
  for (let x = 0; x < N; x++) {
    if (grid[y][x] !== ".") continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && grid[ny][nx] !== ".") { near = true; break; }
      }
    if (near) out[y][x] = "k";
  }

const rows = out.map((r) => r.join(""));

// ─── Rendu PNG (2 fonds) ────────────────────────────────────────────────────────
const SCALE = 7, PAD = 1;
const BGS = [[210, 210, 215], [58, 140, 40]];
const panelW = (N + PAD * 2) * SCALE, panelH = (N + PAD * 2) * SCALE;
const W = panelW * BGS.length, Himg = panelH;
const buf = Buffer.alloc(W * Himg * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function px(x, y, [r, g, b]) { if (x < 0 || y < 0 || x >= W || y >= Himg) return; const i = (y * W + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; }
for (let p = 0; p < BGS.length; p++) {
  const bg = BGS[p], bx = p * panelW;
  for (let y = 0; y < panelH; y++) for (let x = 0; x < panelW; x++) px(bx + x, y, bg);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const ch = rows[r][c]; if (ch === ".") continue;
    const col = PAL[ch]; if (!col) continue;
    const rgb = hex(col), ox = bx + (c + PAD) * SCALE, oy = (r + PAD) * SCALE;
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) px(ox + dx, oy + dy, rgb);
  }
}
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const ty = Buffer.from(t, "ascii"); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([ty, d])), 0); return Buffer.concat([l, ty, d, cr]); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(Himg, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * Himg);
for (let y = 0; y < Himg; y++) { raw[y * (W * 4 + 1)] = 0; buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
writeFileSync("/tmp/eagle.png", Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));

// ─── Sortie ASCII pour assets.ts ────────────────────────────────────────────────
console.log("écrit /tmp/eagle.png");
console.log("\ngrid: [");
for (const r of rows) console.log(`  "${r}",`);
console.log("],");
const used = new Set(rows.join("").split("").filter((c) => c !== "."));
console.log("\npalette utilisée:", [...used].sort().join(" "));
