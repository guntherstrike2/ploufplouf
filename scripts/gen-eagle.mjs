// Générateur d'aigle 48×48 par formes. Sort 3 grilles :
//   • FULL  : composite complet (pour la galerie / fallback statique)
//   • BODY  : corps sans les ailes (le launcher anime les ailes à part)
//   • WING  : aile gauche seule, recadrée, + point de pivot (épaule)
// Les pattes sont dessinées en procédural dans le jeu (pas dans la grille).
//
// Usage: node scripts/gen-eagle.mjs   → /tmp/eagle.png + grilles imprimées

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const N = 48;
const CX = (N - 1) / 2;
const BODY_ROWS = 38;            // hauteur du corps (lignes 0..37)
const PIVOT = [22, 16];          // épaule de l'aile gauche (coords pleines)

const PAL = {
  ".": null, k: "#1a120a",
  H: "#ffffff", W: "#e9eef2", w: "#bcc7d2", g: "#8a9bad",
  Y: "#ffd24a", y: "#f5a623", o: "#b86c14", a: "#ffcc33",
  B: "#a06a34", m: "#7a4a22", d: "#4f2f16", D: "#301c0d",
};

const mk = () => Array.from({ length: N }, () => Array(N).fill("."));
let CUR = mk();
const set = (x, y, c) => { const xi = Math.round(x), yi = Math.round(y); if (xi >= 0 && yi >= 0 && xi < N && yi < N) CUR[yi][xi] = c; };
function ellipse(cx, cy, rx, ry, c) {
  for (let y = Math.ceil(cy - ry); y <= cy + ry; y++) for (let x = Math.ceil(cx - rx); x <= cx + rx; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1) set(x, y, c);
  }
}
function poly(pts, c) {
  const ys = pts.map((p) => p[1]); const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) set(x, y, c);
  }
}
const mPts = (pts) => pts.map(([x, y]) => [2 * CX - x, y]);

// ─── Aile gauche (forme réutilisée pour WING et FULL) ───────────────────────────
function paintWingLeft() {
  const prim = (pts, c) => poly(pts, c);
  prim([[0, 24], [0, 34], [2, 37], [3, 27]], "D");
  prim([[4, 26], [4, 37], [6, 37], [6, 28]], "d");
  prim([[8, 28], [8, 37], [10, 36], [10, 29]], "D");
  prim([[12, 29], [12, 35], [14, 34], [13, 30]], "d");
  poly([[22, 16], [13, 12], [5, 13], [1, 18], [0, 23], [2, 28], [9, 29], [16, 28], [20, 25], [22, 20]], "m");
  poly([[21, 16], [11, 13], [4, 15], [2, 19], [10, 19], [19, 19]], "B");
  for (const x of [4, 8, 12, 16]) ellipse(x, 23, 2.2, 1.4, "B");
  poly([[18, 25], [6, 26], [1, 27], [3, 29], [11, 29], [17, 28]], "d");
}
function paintWingRight() {
  const M = (pts) => mPts(pts);
  poly(M([[0, 24], [0, 34], [2, 37], [3, 27]]), "D");
  poly(M([[4, 26], [4, 37], [6, 37], [6, 28]]), "d");
  poly(M([[8, 28], [8, 37], [10, 36], [10, 29]]), "D");
  poly(M([[12, 29], [12, 35], [14, 34], [13, 30]]), "d");
  poly(M([[22, 16], [13, 12], [5, 13], [1, 18], [0, 23], [2, 28], [9, 29], [16, 28], [20, 25], [22, 20]]), "m");
  poly(M([[21, 16], [11, 13], [4, 15], [2, 19], [10, 19], [19, 19]]), "B");
  for (const x of [4, 8, 12, 16]) ellipse(2 * CX - x, 23, 2.2, 1.4, "B");
  poly(M([[18, 25], [6, 26], [1, 27], [3, 29], [11, 29], [17, 28]]), "d");
}

// ─── Corps (sans ailes ni pattes) ───────────────────────────────────────────────
function paintBody() {
  // Queue
  poly([[19, 31], [29, 31], [27, 45], [21, 45]], "W");
  poly([[20, 41], [28, 41], [27, 45], [21, 45]], "g");
  // Corps + poitrail
  ellipse(CX, 27, 10, 14, "m");
  ellipse(CX, 30, 7, 11, "B");
  for (let row = 0; row < 4; row++) { const y = 25 + row * 4;
    for (let i = 0; i < 3; i++) { const off = i * 5 - 5; set(CX + off - 1.5, y, "m"); set(CX + off, y + 1, "d"); set(CX + off + 1.5, y, "m"); } }
  // Collerette + tête
  ellipse(CX, 18, 12, 6, "W");
  ellipse(CX, 10, 8, 9, "W");
  ellipse(CX, 11, 8, 9, "w");
  ellipse(CX, 10, 6, 7, "W");
  ellipse(CX, 8, 5, 5, "H");
  // Bec
  poly([[20, 11], [28, 11], [26, 17], [24, 20], [22, 17]], "y");
  poly([[24, 17], [22, 16], [24, 21]], "o");
  poly([[20, 11], [28, 11], [27, 13], [21, 13]], "Y");
  // Yeux + sourcils
  ellipse(18, 9, 2.2, 2.2, "a"); ellipse(30, 9, 2.2, 2.2, "a");
  set(18, 9, "k"); set(30, 9, "k");
  poly([[15, 6], [21, 7], [21, 8], [15, 8]], "g");
  poly([[33, 6], [27, 7], [27, 8], [33, 8]], "g");
}

// ─── Contour auto (bord de silhouette) ──────────────────────────────────────────
function outline(g) {
  const o = g.map((r) => r.slice());
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] !== ".") continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N && g[ny][nx] !== ".") { near = true; break; }
    }
    if (near) o[y][x] = "k";
  }
  return o;
}

// Construit les 3 cibles
CUR = mk(); paintBody(); const BODY = outline(CUR);
CUR = mk(); paintWingLeft(); const WING_FULL = outline(CUR);
CUR = mk(); paintBody(); paintWingLeft(); paintWingRight(); const FULL = outline(CUR);

// Recadre WING sur sa bbox + pivot
function crop(g) {
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] !== ".") { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const rows = [];
  for (let y = y0; y <= y1; y++) rows.push(g[y].slice(x0, x1 + 1).join(""));
  return { rows, x0, y0 };
}
const wc = crop(WING_FULL);
const pivotWing = [PIVOT[0] - wc.x0, PIVOT[1] - wc.y0];        // pivot dans la grille d'aile
const anchor = [PIVOT[0] - CX, PIVOT[1] - (BODY_ROWS - 1) / 2]; // pivot relatif au centre du corps

const bodyRows = BODY.slice(0, BODY_ROWS).map((r) => r.join(""));
const fullRows = FULL.slice(0, BODY_ROWS).map((r) => r.join(""));

// ─── Rendu PNG du composite (2 fonds) ────────────────────────────────────────────
const SCALE = 7, PAD = 1;
const BGS = [[210, 210, 215], [58, 140, 40]];
const panelW = (N + PAD * 2) * SCALE, panelH = (BODY_ROWS + PAD * 2) * SCALE;
const Wp = panelW * BGS.length, Himg = panelH;
const buf = Buffer.alloc(Wp * Himg * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const px = (x, y, [r, g, b]) => { if (x < 0 || y < 0 || x >= Wp || y >= Himg) return; const i = (y * Wp + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; };
for (let p = 0; p < BGS.length; p++) { const bg = BGS[p], bx = p * panelW;
  for (let y = 0; y < panelH; y++) for (let x = 0; x < panelW; x++) px(bx + x, y, bg);
  for (let r = 0; r < fullRows.length; r++) for (let c = 0; c < N; c++) { const ch = fullRows[r][c]; if (ch === "." || !PAL[ch]) continue;
    const rgb = hex(PAL[ch]), ox = bx + (c + PAD) * SCALE, oy = (r + PAD) * SCALE;
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) px(ox + dx, oy + dy, rgb); } }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const ty = Buffer.from(t, "ascii"); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([ty, d])), 0); return Buffer.concat([l, ty, d, cr]); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(Wp, 0); ihdr.writeUInt32BE(Himg, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((Wp * 4 + 1) * Himg);
for (let y = 0; y < Himg; y++) { raw[y * (Wp * 4 + 1)] = 0; buf.copy(raw, y * (Wp * 4 + 1) + 1, y * Wp * 4, (y + 1) * Wp * 4); }
writeFileSync("/tmp/eagle.png", Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));

// ─── Sortie ──────────────────────────────────────────────────────────────────────
const emit = (label, rows) => { console.log(`\n=== ${label} (${rows[0].length}×${rows.length}) ===`); console.log("[" + rows.map((r) => `\n      "${r}",`).join("") + "\n    ]"); };
console.log("écrit /tmp/eagle.png");
emit("FULL (eagle.grid)", fullRows);
emit("BODY (EAGLE_BODY)", bodyRows);
emit("WING (EAGLE_WING)", wc.rows);
console.log("\npivot dans l'aile:", pivotWing, " | ancre (relatif centre corps):", anchor);
