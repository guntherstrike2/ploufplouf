import { W, H, MAX_SHAKE } from "../engine/constants";
import type { GameState } from "../engine/types";
import type { GameTheme, BgTheme } from "../engine/game-theme";

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// Canvas hors-écran pour les caches de décor. OffscreenCanvas n'est pas dispo
// partout (Safari < 16.4) → fallback sur un <canvas> détaché, que drawImage
// accepte aussi bien comme source. Évite un crash au boot sur ces navigateurs.
type OffCanvas = OffscreenCanvas | HTMLCanvasElement;

function makeOffscreen(w: number, h: number): OffCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

const BG_PAD  = MAX_SHAKE + 2;
const GROUND_Y = H - 80;

// ─── PRNG déterministe ───────────────────────────────────────────────────────
// Génère les positions des étoiles / lucioles / neige de façon reproductible.

function makePrng(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── FORÊT data ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const FIREFLY_POS = [
  { x: 60,  y: 155 }, { x: 140, y: 138 }, { x: 220, y: 162 }, { x: 300, y: 144 },
  { x: 380, y: 152 }, { x: 100, y: 133 }, { x: 250, y: 148 }, { x: 340, y: 158 },
  { x: 45,  y: 130 }, { x: 410, y: 145 }, { x: 190, y: 140 }, { x: 270, y: 160 },
] as const;

// Feuilles ambiantes qui dérivent dans le vent (forêt uniquement)
const AMBIENT_LEAVES = (() => {
  const rnd = makePrng(0x1eaf7a11);
  const COLS = ["#4ab832", "#7acc44", "#aadd22", "#c4cc22", "#88bb33", "#55cc44"] as const;
  return Array.from({ length: 24 }, () => ({
    x:      Math.round(rnd() * W),
    speedY: 0.16 + rnd() * 0.38,
    drift:  (rnd() - 0.5) * 2.8,
    phase:  rnd() * Math.PI * 2,
    sz:     rnd() < 0.38 ? 3 : 2,
    col:    COLS[Math.floor(rnd() * COLS.length)]!,
  }));
})();

const FEVER_STARS = [
  { x: 30,  y: 20,  s: 2 }, { x: 80,  y: 45,  s: 1 }, { x: 130, y: 15,  s: 2 },
  { x: 190, y: 55,  s: 1 }, { x: 240, y: 25,  s: 2 }, { x: 300, y: 50,  s: 1 },
  { x: 350, y: 18,  s: 2 }, { x: 410, y: 40,  s: 1 }, { x: 455, y: 22,  s: 2 },
  { x: 55,  y: 80,  s: 1 }, { x: 160, y: 90,  s: 2 }, { x: 220, y: 75,  s: 1 },
  { x: 320, y: 85,  s: 2 }, { x: 390, y: 70,  s: 1 }, { x: 440, y: 95,  s: 2 },
  { x: 110, y: 120, s: 1 }, { x: 270, y: 110, s: 2 }, { x: 360, y: 130, s: 1 },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// ─── ABÎME data ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const ABIME_NEBULAS = [
  { x: 30,  y: 58,  w: 165, h: 95,  r: 50,  g: 0,  b: 130, a: 0.07 },
  { x: 255, y: 42,  w: 135, h: 105, r: 0,   g: 30, b: 110, a: 0.06 },
  { x: 135, y: 108, w: 115, h: 68,  r: 90,  g: 0,  b: 185, a: 0.05 },
  { x: 338, y: 78,  w: 105, h: 84,  r: 0,   g: 85, b: 145, a: 0.05 },
] as const;

const ABIME_STARS = (() => {
  const rnd = makePrng(0xf1a9e5b3);
  const COLS = ["#c8c8ff", "#ffffff", "#ffe8c8", "#d8c8ff", "#c8eeff"] as const;
  return Array.from({ length: 58 }, () => ({
    x:     Math.round(rnd() * W),
    y:     Math.round(rnd() * (GROUND_Y - 60)),
    sz:    rnd() < 0.12 ? 2 : 1,
    phase: rnd() * Math.PI * 2,
    speed: 0.25 + rnd() * 0.5,
    col:   COLS[Math.floor(rnd() * COLS.length)]!,
  }));
})();

// ═══════════════════════════════════════════════════════════════════════════
// ─── ENFER data ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const ENFER_MOUNTAINS = [
  // Couche lointaine (plus claire, plus petite)
  { x: 55,  peakY: 205, bw: 68,  layer: 0 as const },
  { x: 165, peakY: 188, bw: 82,  layer: 0 as const },
  { x: 265, peakY: 198, bw: 76,  layer: 0 as const },
  { x: 375, peakY: 192, bw: 70,  layer: 0 as const },
  // Couche proche (plus sombre, plus grande)
  { x: 18,  peakY: 148, bw: 88,  layer: 1 as const },
  { x: 128, peakY: 128, bw: 102, layer: 1 as const },
  { x: 248, peakY: 138, bw: 96,  layer: 1 as const },
  { x: 378, peakY: 133, bw: 88,  layer: 1 as const },
  { x: 468, peakY: 152, bw: 80,  layer: 1 as const },
] as const;

const ENFER_STALACTITES = [
  { x: 28,  len: 44, bw: 11 },
  { x: 78,  len: 28, bw:  7 },
  { x: 140, len: 62, bw: 16 },
  { x: 198, len: 24, bw:  6 },
  { x: 262, len: 50, bw: 13 },
  { x: 328, len: 33, bw:  8 },
  { x: 398, len: 56, bw: 14 },
  { x: 448, len: 20, bw:  5 },
] as const;

const ENFER_LAVA_CRACKS = [
  { x: 28,  len: 55 }, { x: 108, len: 42 }, { x: 195, len: 66 },
  { x: 295, len: 50 }, { x: 385, len: 70 }, { x: 450, len: 36 },
] as const;

const ENFER_EMBERS = (() => {
  const rnd = makePrng(0xcc4400bb);
  return Array.from({ length: 22 }, () => ({
    x:     Math.round(rnd() * W),
    speed: 0.8 + rnd() * 2.2,
    phase: rnd() * Math.PI * 2,
    col:   rnd() < 0.6 ? "#ff6600" : "#ff3322",
  }));
})();

// ═══════════════════════════════════════════════════════════════════════════
// ─── GLACE data ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const GLACE_STALACTITES = [
  { x: 15,  len: 50, bw: 13 }, { x: 60,  len: 34, bw:  8 },
  { x: 112, len: 66, bw: 18 }, { x: 162, len: 27, bw:  6 },
  { x: 222, len: 56, bw: 14 }, { x: 272, len: 40, bw: 10 },
  { x: 342, len: 72, bw: 20 }, { x: 400, len: 30, bw:  7 },
  { x: 452, len: 48, bw: 12 },
] as const;

const GLACE_STALAGMITES = [
  { x: 44,  len: 38, bw: 10 }, { x: 132, len: 28, bw:  7 },
  { x: 202, len: 46, bw: 13 }, { x: 302, len: 32, bw:  8 },
  { x: 382, len: 50, bw: 13 }, { x: 462, len: 24, bw:  6 },
] as const;

const GLACE_TREES = [
  { x: 12,  h: 58, scale: 0.70 }, { x: 78,  h: 80, scale: 1.00 },
  { x: 198, h: 55, scale: 0.65 }, { x: 352, h: 75, scale: 0.90 },
  { x: 438, h: 62, scale: 0.75 },
] as const;

const GLACE_CRYSTALS = [
  { x: 72,  h: 44 }, { x: 158, h: 34 }, { x: 242, h: 52 },
  { x: 318, h: 38 }, { x: 408, h: 46 },
] as const;

const GLACE_SNOWDRIFTS = [
  { cx: 50,  rw: 82,  rh: 18 }, { cx: 158, rw: 102, rh: 24 },
  { cx: 278, rw: 92,  rh: 20 }, { cx: 398, rw: 112, rh: 22 },
] as const;

const GLACE_SNOW = (() => {
  const rnd = makePrng(0xa7c3d2f1);
  return Array.from({ length: 30 }, () => ({
    x:     Math.round(rnd() * W),
    speed: 0.5 + rnd() * 1.5,
    drift: (rnd() - 0.5) * 0.7,
    phase: rnd() * Math.PI * 2,
    sz:    rnd() < 0.25 ? 2 : 1,
  }));
})();

// ═══════════════════════════════════════════════════════════════════════════
// ─── Primitives pixel art partagées ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Blob circulaire rempli — brique de base des canopées feuillues
function fillCircle(ctx: Ctx2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (hw) ctx.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2, 1);
  }
}

// Chêne à canopée organique : blob principal + 4 satellites qui débordent.
// Donne une silhouette irrégulière naturelle, avec ombre portée + reflet.
function drawOakTree(
  ctx: Ctx2D, baseX: number, baseY: number,
  trunkH: number, crownR: number,
  leafBase: string, leafHi: string, leafShade: string, trunkColor: string,
): void {
  const tx = Math.round(baseX);
  const crownCY = Math.round(baseY - trunkH - crownR * 0.78);
  const trunkW  = Math.max(3, Math.round(crownR * 0.18));

  // Tronc légèrement évasé à la base
  for (let dy = 0; dy < trunkH; dy++) {
    const t = dy / trunkH;
    const tw = Math.max(2, Math.round(trunkW * (0.85 + t * 0.15)));
    ctx.fillStyle = trunkColor;
    ctx.fillRect(Math.round(tx - tw / 2), baseY - trunkH + dy, tw, 1);
  }
  ctx.fillStyle = "rgba(220,160,80,0.22)";
  ctx.fillRect(Math.round(tx - 1), baseY - trunkH, 2, trunkH);

  // Ombre portée (blob décalé)
  fillCircle(ctx, tx + 2, crownCY + 4, Math.round(crownR * 0.90), leafShade);
  // Blob principal
  fillCircle(ctx, tx, crownCY, crownR, leafBase);
  // Satellites : silhouette organique asymétrique
  fillCircle(ctx, tx - Math.round(crownR * 0.62), crownCY + Math.round(crownR * 0.20), Math.round(crownR * 0.54), leafBase);
  fillCircle(ctx, tx + Math.round(crownR * 0.60), crownCY + Math.round(crownR * 0.16), Math.round(crownR * 0.50), leafBase);
  fillCircle(ctx, tx - Math.round(crownR * 0.20), crownCY - Math.round(crownR * 0.54), Math.round(crownR * 0.44), leafBase);
  fillCircle(ctx, tx + Math.round(crownR * 0.28), crownCY - Math.round(crownR * 0.46), Math.round(crownR * 0.42), leafBase);
  // Reflet lumineux haut-gauche
  fillCircle(ctx, tx - Math.round(crownR * 0.30), crownCY - Math.round(crownR * 0.36), Math.round(crownR * 0.28), leafHi);
  ctx.fillStyle = "rgba(220,255,160,0.35)";
  ctx.fillRect(tx - 3, crownCY - crownR + 4, 6, 4);
}

// Sapin nordique en 4 tiers — chaque palier s'amincit vers le sommet.
// Ombre sous chaque palier pour la profondeur.
function drawPineTree(
  ctx: Ctx2D, baseX: number, baseY: number, h: number,
  leafBase: string, leafHi: string, trunkColor: string,
): void {
  const tx      = Math.round(baseX);
  const tiers   = 4;
  const trunkH  = Math.round(h * 0.20);

  ctx.fillStyle = trunkColor;
  ctx.fillRect(tx - 2, baseY - trunkH, 4, trunkH);

  for (let t = 0; t < tiers; t++) {
    const tf     = t / (tiers - 1);
    const tierW  = Math.round(22 - tf * 14);
    const tierH  = Math.round(h * 0.27 - tf * h * 0.06);
    const tierY  = Math.round(baseY - trunkH - t * (h * 0.21) - tierH * 0.50);

    for (let dy = 0; dy < tierH; dy++) {
      const dt = dy / tierH;
      const hw = Math.max(1, Math.round(tierW * (1 - dt)));
      ctx.fillStyle = dt < 0.20 ? leafHi : leafBase;
      ctx.fillRect(tx - hw, tierY + dy, hw * 2, 1);
    }
    ctx.fillStyle = "rgba(0,40,10,0.24)";
    ctx.fillRect(tx - tierW + 2, tierY + tierH - 4, (tierW - 2) * 2, 4);
  }
}

// Arbre svelte : bouleau / peuplier — tronc clair, canopée ovale légère.
function drawSlimTree(
  ctx: Ctx2D, baseX: number, baseY: number, h: number,
  leafBase: string, leafHi: string, trunkColor: string,
): void {
  const tx      = Math.round(baseX);
  const crownR  = Math.round(h * 0.26);
  const crownCY = Math.round(baseY - h + crownR * 0.55);

  ctx.fillStyle = trunkColor;
  ctx.fillRect(tx - 1, baseY - h, 3, h);
  ctx.fillStyle = "rgba(255,255,240,0.32)";
  ctx.fillRect(tx, baseY - h, 1, h);

  for (let dy = -crownR; dy <= crownR; dy++) {
    const t  = dy / crownR;
    const hw = Math.round(crownR * 0.62 * Math.sqrt(Math.max(0, 1 - t * t)));
    if (hw === 0) continue;
    const lit = (dy + crownR) / (crownR * 2);
    ctx.fillStyle = lit < 0.28 ? leafHi : leafBase;
    ctx.fillRect(tx - hw, crownCY + dy, hw * 2, 1);
  }
}

// Champignon pixel (chapeau rouge à pois blancs)
function drawMushroom(ctx: Ctx2D, cx: number, baseY: number, size: number): void {
  const stemH = Math.max(3, Math.round(size * 0.65));
  const capR  = size;
  ctx.fillStyle = "#e0c898";
  ctx.fillRect(Math.round(cx - 1), baseY - stemH, 2, stemH);
  for (let dy = 0; dy <= capR; dy++) {
    const t  = dy / capR;
    const hw = Math.round(capR * Math.sin(t * Math.PI * 0.5) * 1.5);
    if (hw === 0) continue;
    ctx.fillStyle = dy < Math.round(capR * 0.35) ? "#dd4433" : "#cc3322";
    ctx.fillRect(Math.round(cx - hw), baseY - stemH - capR + dy, hw * 2, 1);
  }
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillRect(Math.round(cx - 2), baseY - stemH - capR + 2, 2, 2);
  if (capR > 5) ctx.fillRect(Math.round(cx + 2), baseY - stemH - capR + 4, 1, 1);
}

// Fleur pixel — tige verte + 4 pétales + cœur jaune
function drawFlower(ctx: Ctx2D, cx: number, baseY: number, color: string): void {
  ctx.fillStyle = "#3a8030";
  ctx.fillRect(Math.round(cx), baseY - 5, 1, 5);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(cx - 1), baseY - 7, 3, 1);
  ctx.fillRect(Math.round(cx - 1), baseY - 5, 3, 1);
  ctx.fillRect(Math.round(cx - 2), baseY - 6, 1, 1);
  ctx.fillRect(Math.round(cx + 2), baseY - 6, 1, 1);
  ctx.fillStyle = "#ffee88";
  ctx.fillRect(Math.round(cx), baseY - 6, 1, 1);
}

// Triangle de montagne (utilisé pour Enfer)
function drawMountain(ctx: Ctx2D, cx: number, peakY: number, baseY: number, bw: number, color: string): void {
  ctx.fillStyle = color;
  const h = baseY - peakY;
  for (let dy = 0; dy <= h; dy++) {
    const hw = Math.round(bw * (dy / h));
    ctx.fillRect(cx - hw, peakY + dy, hw * 2, 1);
  }
}

// Stalactite (pointe vers le bas, accrochée au plafond)
function drawStalactite(ctx: Ctx2D, cx: number, bw: number, len: number, color: string, hiColor: string): void {
  for (let dy = 0; dy < len; dy++) {
    const hw = Math.max(1, Math.round(bw / 2 * (1 - dy / len)));
    ctx.fillStyle = color;
    ctx.fillRect(cx - hw, dy, hw * 2, 1);
  }
  ctx.fillStyle = hiColor;
  for (let dy = 0; dy < len - 2; dy++) {
    const hw = Math.max(1, Math.round(bw / 2 * (1 - dy / len)));
    ctx.fillRect(cx - hw, dy, 1, 1);
  }
}

// Stalagmite (pointe vers le haut, ancrée au sol)
function drawStalagmite(ctx: Ctx2D, cx: number, groundY: number, bw: number, len: number, color: string, hiColor: string): void {
  for (let dy = 0; dy < len; dy++) {
    const hw = Math.max(1, Math.round(bw / 2 * (len - dy) / len));
    ctx.fillStyle = color;
    ctx.fillRect(cx - hw, groundY - len + dy, hw * 2, 1);
  }
  ctx.fillStyle = hiColor;
  for (let dy = 0; dy < len - 2; dy++) {
    const hw = Math.max(1, Math.round(bw / 2 * (len - dy) / len));
    ctx.fillRect(cx - hw, groundY - len + dy, 1, 1);
  }
}

// Arbre gelé (tronc + branches nues, sans feuilles)
function drawFrozenTree(ctx: Ctx2D, x: number, groundY: number, h: number, scale: number, color: string): void {
  const tw = Math.max(2, Math.round(3 * scale));
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - tw / 2), groundY - h, tw, h);

  const b1Y = groundY - Math.round(h * 0.58);
  const b1L = Math.round(h * 0.32 * scale);
  ctx.fillRect(x - b1L, b1Y - 1, b1L, 2);
  ctx.fillRect(x,        b1Y - 4, Math.round(b1L * 0.78), 2);

  const b2Y = groundY - Math.round(h * 0.78);
  const b2L = Math.round(h * 0.20 * scale);
  ctx.fillRect(x - b2L, b2Y, b2L, 1);
  ctx.fillRect(x,       b2Y - 3, Math.round(b2L * 0.68), 1);

  ctx.fillRect(x - Math.round(b2L * 0.45), groundY - Math.round(h * 0.92), Math.round(b2L * 0.45), 1);
}

// Cristal de glace (losange vertical)
function drawIceCrystal(ctx: Ctx2D, cx: number, baseY: number, h: number, color: string, hiColor: string): void {
  const maxHw = Math.max(2, Math.round(h * 0.28));
  for (let dy = 0; dy < h; dy++) {
    const t = dy / h;
    const hw = t < 0.28
      ? Math.round(maxHw * (t / 0.28))
      : Math.round(maxHw * (1 - (t - 0.28) / 0.72));
    ctx.fillStyle = color;
    ctx.fillRect(cx - Math.max(1, hw), baseY - h + dy, Math.max(1, hw) * 2, 1);
  }
  ctx.fillStyle = hiColor;
  ctx.fillRect(cx - 1, baseY - h + 2, 2, Math.round(h * 0.2));
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── ABÎME — éléments statiques ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function drawAbimeStaticLayers(ctx: Ctx2D, feverMode: boolean): void {
  // Nébuleuses
  for (const neb of ABIME_NEBULAS) {
    const mult = feverMode ? 1.8 : 1;
    ctx.fillStyle = `rgba(${neb.r},${neb.g},${neb.b},${(neb.a * mult).toFixed(3)})`;
    ctx.fillRect(neb.x, neb.y, neb.w, neb.h);
    ctx.fillStyle = `rgba(${neb.r},${neb.g},${neb.b},${(neb.a * 0.6 * mult).toFixed(3)})`;
    ctx.fillRect(
      Math.round(neb.x + neb.w * 0.2), Math.round(neb.y + neb.h * 0.2),
      Math.round(neb.w * 0.6),         Math.round(neb.h * 0.6),
    );
  }

  // Planète
  drawAbimePlanet(ctx, feverMode);

  // Champ d'étoiles de base (les scintillements sont animés par-dessus)
  ctx.globalAlpha = 0.72;
  for (const st of ABIME_STARS) {
    ctx.fillStyle = st.col;
    ctx.fillRect(st.x, st.y, st.sz, st.sz);
  }
  ctx.globalAlpha = 1;
}

function drawAbimePlanet(ctx: Ctx2D, feverMode: boolean): void {
  const cx = W - 74, cy = 68, r = 18;

  // Halo d'atmosphère
  for (let ar = r + 7; ar > r; ar--) {
    const alpha = (ar - r - 1) * 0.014;
    ctx.fillStyle = feverMode
      ? `rgba(0,80,200,${alpha})`
      : `rgba(80,30,160,${alpha})`;
    for (let dy = -ar; dy <= ar; dy++) {
      const hw = Math.round(Math.sqrt(Math.max(0, ar * ar - dy * dy)));
      if (hw === 0) continue;
      ctx.fillRect(cx - hw, cy + dy, hw * 2, 1);
    }
  }

  // Corps avec bandes de couleur
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (hw === 0) continue;
    const t = (dy + r) / (r * 2);
    ctx.fillStyle = feverMode
      ? (t < 0.35 ? "#00336a" : t < 0.65 ? "#002255" : "#001133")
      : (t < 0.35 ? "#7733bb" : t < 0.65 ? "#551199" : "#330066");
    ctx.fillRect(cx - hw, cy + dy, hw * 2, 1);
  }

  // Bande équatoriale
  for (let dy = 1; dy <= 4; dy++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (hw < 2) continue;
    ctx.fillStyle = feverMode ? "rgba(0,60,130,0.38)" : "rgba(160,80,255,0.30)";
    ctx.fillRect(cx - hw, cy + dy, hw * 2, 1);
  }

  // Highlight
  ctx.fillStyle = feverMode ? "rgba(100,180,255,0.58)" : "rgba(220,190,255,0.62)";
  ctx.fillRect(cx - r + 4, cy - r + 4, 6, 2);
  ctx.fillRect(cx - r + 4, cy - r + 5, 2, 3);

  // Anneau
  const rw = r + 12;
  for (let dx = -rw; dx <= rw; dx++) {
    if (Math.abs(dx) < r - 3) continue;
    const ovalDy = Math.round(4 * Math.sqrt(Math.max(0, 1 - (dx / rw) ** 2)));
    ctx.fillStyle = feverMode ? "rgba(0,80,180,0.44)" : "rgba(150,100,220,0.44)";
    ctx.fillRect(cx + dx, cy + ovalDy, 1, 1);
    if (ovalDy > 0) ctx.fillRect(cx + dx, cy - ovalDy, 1, 1);
  }
}

// ─── ABÎME — animation par frame ─────────────────────────────────────────────

function drawAbimeAnimated(ctx: CanvasRenderingContext2D, s: GameState, feverMode: boolean): void {
  // Scintillement des étoiles
  for (let i = 0; i < ABIME_STARS.length; i++) {
    const st = ABIME_STARS[i]!;
    const t = 0.45 + 0.55 * Math.abs(Math.sin(st.phase + s.animClock * st.speed));
    if (t > 0.72) {
      ctx.globalAlpha = (t - 0.72) * 2.6;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(st.x, st.y, st.sz, st.sz);
      if (st.sz > 1) {
        ctx.fillRect(st.x - 1, (st.y + st.sz / 2) | 0, st.sz + 2, 1);
        ctx.fillRect((st.x + st.sz / 2) | 0, st.y - 1, 1, st.sz + 2);
      }
    }
  }
  ctx.globalAlpha = 1;

  // Étoile filante (toutes les ~11 secondes)
  {
    const period = 11;
    const t = s.animClock % period;
    if (t < 0.88) {
      const progress = t / 0.88;
      const sx = 55, sy = 16, ex = 365, ey = 118;
      const cx = Math.round(sx + (ex - sx) * progress);
      const cy = Math.round(sy + (ey - sy) * progress);
      const dist = Math.hypot(ex - sx, ey - sy);
      const nx = (ex - sx) / dist, ny = (ey - sy) / dist;

      for (let i = 16; i >= 0; i--) {
        ctx.globalAlpha = (1 - i / 16) * (1 - progress * 0.8) * 0.9;
        ctx.fillStyle = i < 5 ? "#ffffff" : "#8888ff";
        ctx.fillRect(Math.round(cx - nx * i * 3.8), Math.round(cy - ny * i * 3.8), i < 4 ? 2 : 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // Pulsation douce de la planète
  const pulse = 0.85 + 0.15 * Math.sin(s.animClock * 0.7);
  ctx.globalAlpha = pulse * (feverMode ? 0.10 : 0.06);
  ctx.fillStyle = feverMode ? "#004488" : "#6622aa";
  ctx.fillRect(W - 96, 46, 50, 50);
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── ENFER — éléments statiques ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function drawEnferMountains(ctx: Ctx2D, feverMode: boolean): void {
  // Colonnnes de feu lointaines (halo dans le fond)
  const fireX = [50, 140, 240, 340, 440] as const;
  for (const fx of fireX) {
    for (let dy = 0; dy < 180; dy++) {
      const t = dy / 180;
      const fw = Math.round(20 * (1 - t * 0.7));
      const a  = (1 - t) * (feverMode ? 0.11 : 0.065);
      ctx.fillStyle = `rgba(255,${80 - Math.round(50 * t)},0,${a.toFixed(3)})`;
      ctx.fillRect(((fx - fw / 2) | 0), GROUND_Y - dy, fw, 2);
    }
  }

  // Montagnes volcaniques (couche lointaine, couche proche)
  for (const layer of [0, 1] as const) {
    for (const m of ENFER_MOUNTAINS) {
      if (m.layer !== layer) continue;
      const color = layer === 0
        ? (feverMode ? "#1a0800" : "#3a1008")
        : (feverMode ? "#0e0400" : "#220600");
      drawMountain(ctx, m.x, m.peakY, GROUND_Y, m.bw, color);
    }
  }
}

function drawEnferGroundDetails(ctx: Ctx2D, feverMode: boolean): void {
  // Stalactites de lave accrochées au plafond
  for (const st of ENFER_STALACTITES) {
    drawStalactite(ctx, st.x, st.bw, st.len,
      feverMode ? "#1a0600" : "#2a0c04",
      feverMode ? "#441008" : "#661408",
    );
    // Lueur au bout
    ctx.fillStyle = feverMode ? "rgba(255,80,0,0.5)" : "rgba(200,50,0,0.35)";
    ctx.fillRect(st.x - 1, st.len - 3, 3, 4);
  }

  // Fissures de lave dans le sol
  for (const c of ENFER_LAVA_CRACKS) {
    ctx.fillStyle = feverMode ? "rgba(255,180,0,0.72)" : "rgba(255,100,0,0.55)";
    ctx.fillRect(c.x, GROUND_Y - 1, c.len, 2);
    ctx.fillStyle = feverMode ? "rgba(255,220,50,0.38)" : "rgba(255,200,0,0.28)";
    ctx.fillRect(c.x, GROUND_Y - 2, c.len, 1);
    ctx.fillRect(c.x, GROUND_Y + 1, c.len, 1);
    ctx.fillStyle = feverMode ? "rgba(255,100,0,0.18)" : "rgba(200,50,0,0.12)";
    ctx.fillRect(c.x - 2, GROUND_Y - 3, c.len + 4, 6);
  }
}

// ─── ENFER — animation par frame ─────────────────────────────────────────────

function drawEnferAnimated(ctx: CanvasRenderingContext2D, s: GameState, feverMode: boolean): void {
  // Braises qui montent
  for (let i = 0; i < ENFER_EMBERS.length; i++) {
    const e = ENFER_EMBERS[i]!;
    const rawY = GROUND_Y - ((e.phase / (Math.PI * 2) * 380 + e.speed * s.animClock * 28) % 400);
    const y = Math.round(rawY);
    if (y < 0 || y > GROUND_Y) continue;

    const drift = Math.sin(s.animClock * 1.4 + e.phase) * 14;
    const x     = Math.round((e.x + drift + W * 3) % W);
    const twink = 0.4 + 0.6 * Math.abs(Math.sin(s.animClock * 2.2 + i * 0.8));

    ctx.globalAlpha = twink * (feverMode ? 0.85 : 0.55);
    ctx.fillStyle = e.col;
    ctx.fillRect(x, y, 2, 2);
    ctx.globalAlpha = twink * (feverMode ? 0.22 : 0.12);
    ctx.fillRect(x - 2, y - 2, 6, 6);
  }
  ctx.globalAlpha = 1;

  // Bulles de lave au sol
  const bubbleXs = [38, 108, 188, 268, 358, 432] as const;
  for (let i = 0; i < bubbleXs.length; i++) {
    const bx    = bubbleXs[i]!;
    const cycle = (s.animClock * (0.5 + i * 0.08) + i * 1.7) % (Math.PI * 2);
    if (cycle >= Math.PI) continue;

    const t = cycle / Math.PI;
    const r = Math.round(2 + t * 7);
    const alpha = t < 0.7 ? 0.65 : (1 - t) * 2.2;

    ctx.globalAlpha = alpha;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (hw === 0) continue;
      ctx.fillStyle = t > 0.75 ? "#ffaa22" : "#ee4400";
      ctx.fillRect(bx - hw, GROUND_Y - 6 + dy, hw * 2, 1);
    }
    if (t < 0.5) {
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillStyle = "#ffdd88";
      ctx.fillRect(bx - r + 2, GROUND_Y - 6 - r + 2, 3, 2);
    }
  }
  ctx.globalAlpha = 1;

  // Flammes au bout des stalactites
  for (const st of ENFER_STALACTITES) {
    const flicker = 0.5 + 0.5 * Math.sin(s.animClock * 4.5 + st.x * 0.055);
    ctx.globalAlpha = flicker * (feverMode ? 0.72 : 0.45);
    ctx.fillStyle = "#ff8800";
    ctx.fillRect(st.x - 2, st.len, 4, 3);
    ctx.globalAlpha = flicker * (feverMode ? 0.18 : 0.10);
    ctx.fillStyle = "#ff6600";
    ctx.fillRect(st.x - 5, st.len - 2, 10, 8);
  }
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── GLACE — éléments statiques ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function drawGlaceGroundDetails(ctx: Ctx2D, feverMode: boolean): void {
  // Congères de neige sur le sol
  for (const d of GLACE_SNOWDRIFTS) {
    for (let dy = 0; dy < d.rh; dy++) {
      const t  = dy / d.rh;
      const hw = Math.round(d.rw / 2 * Math.sqrt(1 - t * t));
      ctx.fillStyle = feverMode ? "#5577aa" : "#c8e8f0";
      ctx.fillRect(d.cx - hw, GROUND_Y - d.rh + dy, hw * 2, 1);
    }
    ctx.fillStyle = feverMode ? "rgba(100,150,200,0.38)" : "rgba(255,255,255,0.52)";
    ctx.fillRect(d.cx - Math.round(d.rw * 0.28), GROUND_Y - d.rh + 2, Math.round(d.rw * 0.38), 2);
  }

  // Arbres gelés en arrière-plan
  for (const t of GLACE_TREES) {
    drawFrozenTree(ctx, t.x, GROUND_Y, t.h, t.scale, feverMode ? "#335577" : "#88aabb");
  }

  // Stalactites de glace (plafond → bas)
  for (const st of GLACE_STALACTITES) {
    drawStalactite(ctx, st.x, st.bw, st.len,
      feverMode ? "#224466" : "#88ccee",
      feverMode ? "#336688" : "#cceeff",
    );
    ctx.fillStyle = feverMode ? "rgba(50,100,200,0.38)" : "rgba(100,220,255,0.48)";
    ctx.fillRect(st.x - 2, st.len - 3, 4, 5);
  }

  // Stalagmites de glace (sol → haut)
  for (const st of GLACE_STALAGMITES) {
    drawStalagmite(ctx, st.x, GROUND_Y, st.bw, st.len,
      feverMode ? "#1a3a55" : "#66aacc",
      feverMode ? "#2a5577" : "#aaddee",
    );
  }

  // Cristaux de glace
  for (const cr of GLACE_CRYSTALS) {
    drawIceCrystal(ctx, cr.x, GROUND_Y - 5, cr.h,
      feverMode ? "#1a4466" : "#44aadd",
      feverMode ? "rgba(50,100,180,0.65)" : "rgba(180,240,255,0.78)",
    );
  }
}

// ─── GLACE — animation par frame ─────────────────────────────────────────────

function drawGlaceAnimated(ctx: CanvasRenderingContext2D, s: GameState, feverMode: boolean): void {
  // Aurore boréale
  drawGlaceAurora(ctx, s.animClock, feverMode);

  // Chute de neige
  for (const sf of GLACE_SNOW) {
    const rawY = (sf.phase / (Math.PI * 2) * H + sf.speed * s.animClock * 28) % (H + 30);
    const y    = Math.round(rawY) - 10;
    if (y < 0 || y > GROUND_Y) continue;
    const drift = Math.sin(s.animClock * 0.9 + sf.phase) * 20 * Math.abs(sf.drift);
    const x     = Math.round((sf.x + drift + W * 4) % W);
    ctx.globalAlpha = feverMode ? 0.15 : 0.62;
    ctx.fillStyle = "#ddeeff";
    ctx.fillRect(x, y, sf.sz, sf.sz);
  }
  ctx.globalAlpha = 1;

  // Scintillement des cristaux
  for (let i = 0; i < GLACE_CRYSTALS.length; i++) {
    const cr = GLACE_CRYSTALS[i]!;
    const t  = Math.abs(Math.sin(s.animClock * 0.85 + i * 1.45));
    if (t > 0.82) {
      ctx.globalAlpha = (t - 0.82) * 4 * (feverMode ? 0.28 : 0.88);
      ctx.fillStyle = "#ffffff";
      const sparkY = (GROUND_Y - cr.h / 2) | 0;
      ctx.fillRect(cr.x - 1, sparkY, 3, 1);
      ctx.fillRect(cr.x,     sparkY - 1, 1, 3);
    }
  }
  ctx.globalAlpha = 1;
}

function drawGlaceAurora(ctx: CanvasRenderingContext2D, animClock: number, feverMode: boolean): void {
  const bands = [
    { baseY: 50, r: 0,   g: 255, b: 140, amp: 14, speed: 0.28, freq: 0.018, a: 0.20 },
    { baseY: 70, r: 0,   g: 180, b: 255, amp: 10, speed: 0.20, freq: 0.022, a: 0.15 },
    { baseY: 88, r: 80,  g: 80,  b: 255, amp:  8, speed: 0.24, freq: 0.016, a: 0.11 },
  ];
  for (const band of bands) {
    for (let x = 0; x < W; x += 4) {
      const wave = Math.sin(x * band.freq + animClock * band.speed);
      const py   = Math.round(band.baseY + band.amp * wave);
      const si   = band.a * (0.55 + 0.45 * Math.sin(x * 0.035 + animClock * 0.18));
      const fa   = feverMode ? si * 0.38 : si;
      ctx.fillStyle = `rgba(${band.r},${band.g},${band.b},${fa.toFixed(3)})`;
      ctx.fillRect(x, py, 4, 14);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Easter egg : oiseaux déclenchés par les impacts de pegs ──────────────
// ═══════════════════════════════════════════════════════════════════════════
//
// Clin d'œil « peagle » : chaque peg touché peut faire surgir un oiseau (cf.
// engine/state/birds.ts). Silhouette pixel scalable, ailes battantes, avec un
// liséré clair en bout d'aile pour rester lisible sur ciel clair comme sombre.

function drawFlyingBird(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, wingPhase: number, scale: number, tint: string,
): void {
  const span = Math.max(3, Math.round(7 * scale));
  const lift = Math.sin(wingPhase) * 3 * scale;   // battement : pointes haut/bas
  const px   = Math.round(x), py = Math.round(y);
  const th   = Math.max(1, Math.round(scale));     // épaisseur du trait d'aile

  // Corps
  ctx.fillStyle = tint;
  ctx.fillRect(px - 1, py - 1, 3, 2);

  // Ailes : escalier pixel des deux côtés, pointes d'autant plus mobiles
  for (let i = 1; i <= span; i++) {
    const off = Math.round(lift * (i / span));
    ctx.fillRect(px - i, py - off, 1, th);
    ctx.fillRect(px + i, py - off, 1, th);
  }

  // Liseré clair sur les pointes d'ailes → glint lisible quel que soit le fond
  ctx.fillStyle = "rgba(255,245,215,0.5)";
  const tip = Math.round(lift);
  ctx.fillRect(px - span, py - tip - 1, 1, 1);
  ctx.fillRect(px + span, py - tip - 1, 1, 1);
}

function drawBgBirds(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const b of s.birds) {
    drawFlyingBird(ctx, b.x, b.y, b.wingPhase, b.scale, b.tint);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Corps céleste (soleil / lune) ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function drawCelestialBody(
  ctx: CanvasRenderingContext2D, s: GameState, feverMode: boolean, themeId?: string,
): void {
  if (feverMode) {
    const pulse = 0.88 + 0.12 * Math.sin(s.animClock * 1.2);
    const cx = W - 42;
    const cy = 92 + Math.round(Math.sin(s.animClock * 0.85) * 2.5);
    ctx.fillStyle = `rgba(180,150,255,${0.12 * pulse})`;
    ctx.fillRect(cx - 22, cy - 22, 44, 44);
    ctx.fillStyle = `rgba(210,190,255,${0.22 * pulse})`;
    ctx.fillRect(cx - 16, cy - 16, 32, 32);
    ctx.fillStyle = `rgba(240,230,180,${0.95 * pulse})`;
    ctx.fillRect(cx - 10, cy - 10, 20, 20);
    ctx.fillStyle = "rgba(255,255,220,0.7)";
    ctx.fillRect(cx - 8, cy - 8, 6, 3);
    ctx.fillRect(cx - 8, cy - 8, 3, 6);
    ctx.fillStyle = "rgba(180,160,100,0.4)";
    ctx.fillRect(cx - 2, cy - 2, 3, 3);
    ctx.fillRect(cx + 4, cy + 2, 2, 2);
  } else if (themeId === "foret") {
    drawJuicySun(ctx, s);
  } else {
    // Soleil simple (autres thèmes en mode jour)
    const pulse = 0.9 + 0.1 * Math.sin(s.animClock * 0.5);
    ctx.fillStyle = `rgba(255,230,100,${0.9 * pulse})`;
    ctx.fillRect(W - 50, 20, 16, 16);
    ctx.fillStyle = `rgba(255,245,160,${0.6 * pulse})`;
    ctx.fillRect(W - 54, 16, 24, 24);
    ctx.fillStyle = `rgba(255,220,80,${0.5 * pulse})`;
    ctx.fillRect(W - 42, 10, 2, 6);
    ctx.fillRect(W - 42, 42, 2, 6);
    ctx.fillRect(W - 58, 27, 6, 2);
    ctx.fillRect(W - 28, 27, 6, 2);
  }
}

// Soleil "juicy" (forêt) : carré dégradé + halo carré additif + rayons
// triangulaires qui tournent doucement, avec un léger rebond vertical.
function drawJuicySun(ctx: CanvasRenderingContext2D, s: GameState): void {
  const cx     = SUN_X;
  const cy     = SUN_Y + Math.round(sunBob(s.animClock));
  const breath = 0.5 + 0.5 * Math.sin(s.animClock * 1.0);
  const pulse  = 0.85 + 0.15 * Math.sin(s.animClock * 0.9);
  const R      = 13;

  // Halo carré pulsant (derrière les rayons)
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 5; k++) {
    const r = Math.round(R + 4 + k * 5 + breath * 3);
    ctx.globalAlpha = (0.10 - k * 0.017) * pulse;
    ctx.fillStyle = "#ffd24a";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // Rayons cardinaux : partent des 4 bords du carré central
  const rayLen = Math.round(14 + breath * 5);
  for (let d = 1; d <= rayLen; d++) {
    const t  = d / rayLen;
    const hw = Math.max(1, Math.round((1 - t * 0.85) * 4));
    ctx.globalAlpha = (1 - t * 0.72) * 0.92 * pulse;
    ctx.fillStyle = t < 0.25 ? "#ffe98a" : "#ffcc44";
    ctx.fillRect(cx - hw, cy - R - d, hw * 2, 1);   // haut
    ctx.fillRect(cx - hw, cy + R + d, hw * 2, 1);   // bas
    ctx.fillRect(cx - R - d, cy - hw, 1, hw * 2);   // gauche
    ctx.fillRect(cx + R + d, cy - hw, 1, hw * 2);   // droite
  }

  // Rayons diagonaux : partent des 4 coins du carré
  const diagLen = Math.round(10 + breath * 4);
  for (let d = 1; d <= diagLen; d++) {
    const t = d / diagLen;
    ctx.globalAlpha = (1 - t * 0.85) * 0.65 * pulse;
    ctx.fillStyle = "#ffd84a";
    ctx.fillRect(cx - R - d,     cy - R - d,     2, 2);   // coin haut-gauche
    ctx.fillRect(cx + R + d - 1, cy - R - d,     2, 2);   // coin haut-droite
    ctx.fillRect(cx - R - d,     cy + R + d - 1, 2, 2);   // coin bas-gauche
    ctx.fillRect(cx + R + d - 1, cy + R + d - 1, 2, 2);   // coin bas-droite
  }
  ctx.globalAlpha = 1;

  // Cœur : carré avec dégradé vertical (clair en haut, chaud en bas)
  for (let dy = -R; dy <= R; dy++) {
    const t = (dy + R) / (R * 2);
    ctx.fillStyle = t < 0.4 ? "#ffe98a" : t < 0.75 ? "#ffd24a" : "#ffb22e";
    ctx.fillRect(Math.round(cx - R), Math.round(cy + dy), R * 2, 1);
  }

  // Reflet doux en haut à gauche
  ctx.fillStyle = "rgba(255,253,228,0.85)";
  ctx.fillRect(cx - 7, cy - 8, 6, 6);
  ctx.fillStyle = "rgba(255,255,245,0.9)";
  ctx.fillRect(cx - 5, cy - 6, 3, 2);
}

// ─── Étoiles de fièvre ───────────────────────────────────────────────────────

function drawFeverStars(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (let i = 0; i < FEVER_STARS.length; i++) {
    const st = FEVER_STARS[i]!;
    const twinkle = 0.5 + 0.5 * Math.abs(Math.sin(i * 1.3 + s.animClock * (0.6 + (i % 4) * 0.2)));
    ctx.globalAlpha = twinkle * 0.85;
    ctx.fillStyle = i % 3 === 0 ? "#ccaaff" : i % 3 === 1 ? "#ffffff" : "#aaccff";
    ctx.fillRect(st.x, st.y, st.s, st.s);
    if (st.s > 1) {
      ctx.fillRect(st.x - st.s, (st.y + st.s / 2) | 0, st.s * 3, 1);
      ctx.fillRect((st.x + st.s / 2) | 0, st.y - st.s, 1, st.s * 3);
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Lucioles (Forêt) ────────────────────────────────────────────────────────

function drawFireflies(ctx: CanvasRenderingContext2D, s: GameState, feverMode: boolean): void {
  for (let i = 0; i < FIREFLY_POS.length; i++) {
    const ff = FIREFLY_POS[i]!;
    if (ff.y > GROUND_Y - 20) continue;
    const phase   = i * 1.7 + s.animClock * (0.4 + (i % 3) * 0.15);
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(phase));

    if (feverMode) {
      const wobbleX = ff.x + Math.round(Math.sin(s.animClock * 2.5 + i * 0.8) * 18);
      const wobbleY = ff.y + Math.round(Math.cos(s.animClock * 1.8 + i * 1.1) * 12);
      ctx.globalAlpha = twinkle * 0.8;
      ctx.fillStyle = i % 2 === 0 ? "#cc66ff" : "#8844ff";
      ctx.fillRect(Math.round(wobbleX), Math.round(wobbleY), 3, 3);
      ctx.globalAlpha = twinkle * 0.25;
      ctx.fillStyle = "#aa44ff";
      ctx.fillRect(Math.round(wobbleX - 3), Math.round(wobbleY - 3), 9, 9);
    } else {
      // Mode jour : pollen doré qui flotte doucement dans la lumière
      const fx = ff.x + Math.round(Math.sin(s.animClock * 0.6 + i * 1.3) * 9);
      const fy = ff.y + Math.round(Math.cos(s.animClock * 0.45 + i * 0.9) * 7
                                   - (s.animClock * 5 + i * 40) % 60 * 0.18);
      ctx.globalAlpha = twinkle * 0.7;
      ctx.fillStyle = "#fff2b0";
      ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
      ctx.globalAlpha = twinkle * 0.18;
      ctx.fillStyle = "#ffe888";
      ctx.fillRect(Math.round(fx - 2), Math.round(fy - 2), 6, 6);
    }
  }
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Cache de fond statique (OffscreenCanvas) ────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

let _staticBgCache: OffCanvas | null = null;
let _staticBgKey: string | null = null;

function buildStaticBg(feverMode: boolean, bg: BgTheme, themeId: string): OffCanvas {
  const CW = W + BG_PAD * 2;
  const CH = H + BG_PAD * 2;
  const canvas = makeOffscreen(CW, CH);
  const ctx = canvas.getContext("2d") as Ctx2D;
  ctx.translate(BG_PAD, BG_PAD);

  const skyRows = 12;
  const topC = feverMode ? bg.skyTopFever : bg.skyTop;
  const botC = feverMode ? bg.skyBotFever : bg.skyBot;

  // ① Dégradé de ciel
  for (let row = 0; row < skyRows; row++) {
    const t = row / skyRows;
    const r = Math.round(topC[0] + (botC[0] - topC[0]) * t);
    const g = Math.round(topC[1] + (botC[1] - topC[1]) * t);
    const b = Math.round(topC[2] + (botC[2] - topC[2]) * t);
    const rowH = Math.ceil(GROUND_Y / skyRows);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(-BG_PAD, row * rowH, CW, rowH + 1);
  }

  // ② Éléments de fond d'Abîme (nébuleuses + planète + étoiles)
  if (themeId === "abime") drawAbimeStaticLayers(ctx, feverMode);

  // ③ Montagnes d'Enfer (dessinées avant le sol pour que la base soit cachée)
  if (themeId === "enfer") drawEnferMountains(ctx, feverMode);

  // ⑤ Sol principal (étendu au-delà des bords pour couvrir le shake)
  ctx.fillStyle = feverMode ? bg.groundColorFever : bg.groundColor;
  ctx.fillRect(-BG_PAD, GROUND_Y, CW, CH);

  // ⑥ Herbe (Forêt / Glace — pas pour Enfer)
  if (themeId !== "enfer") {
    ctx.fillStyle = feverMode ? bg.subGroundColorFever : bg.subGroundColor;
    for (let gx = -BG_PAD; gx < W + BG_PAD; gx += 4) {
      const h = 2 + (Math.round(gx * 7 + gx * 3) % 5);
      ctx.fillRect(gx, GROUND_Y - h, 2, h);
    }
    ctx.fillStyle = feverMode ? bg.subGroundColorFever : bg.subGroundColor;
    ctx.fillRect(-BG_PAD, GROUND_Y + 10, CW, CH);
  }

  // ⑦ Détails au sol : Enfer (fissures + stalactites) / Glace (glace + neige)
  if (themeId === "enfer") drawEnferGroundDetails(ctx, feverMode);
  if (themeId === "glace") drawGlaceGroundDetails(ctx, feverMode);

  // ⑧ Brume au sol
  ctx.fillStyle = feverMode ? bg.mistColorFever : bg.mistColor;
  ctx.fillRect(-BG_PAD, GROUND_Y - 8, CW, 16);
  ctx.fillStyle = feverMode ? bg.mistFarColorFever : bg.mistFarColor;
  ctx.fillRect(-BG_PAD, GROUND_Y - 16, CW, 12);

  // ⑨ Scanlines (baked une seule fois)
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  for (let sy = -BG_PAD; sy < H + BG_PAD; sy += 2) {
    ctx.fillRect(-BG_PAD, sy, CW, 1);
  }

  return canvas;
}

function getStaticBg(feverMode: boolean, theme: GameTheme): OffCanvas {
  const key = `${feverMode ? 1 : 0}:${theme.id}`;
  if (_staticBgCache === null || _staticBgKey !== key) {
    _staticBgCache = buildStaticBg(feverMode, theme.bg, theme.id);
    _staticBgKey   = key;
  }
  return _staticBgCache;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── FORÊT — décor multi-couches avec parallaxe ──────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
//
// Chaque couche est un OffscreenCanvas indépendant, blitté avec son propre
// décalage horizontal :
//   • parallaxe piloté par le lanceur (s.launcherX) → profondeur interactive,
//   • dérive ambiante continue via s.animClock        → nuages toujours vivants,
//   • shake atténué selon la profondeur               → les couches lointaines
//     tremblent moins (contre-translation, car la frame est déjà shakée).
//
// Les couches débordent de LAYER_MARGIN de chaque côté pour qu'aucun bord
// n'apparaisse lors du parallaxe ou du shake.

const VPAD            = BG_PAD;
const LAYER_MARGIN    = 130;
const CW_L            = W + LAYER_MARGIN * 2;   // largeur d'une couche
const CH_L            = H + VPAD * 2;           // hauteur d'une couche
const LX0             = -LAYER_MARGIN;          // x du bord gauche d'une couche
const RX1             = W + LAYER_MARGIN;       // x du bord droit visible
const PARALLAX_CLAMP  = 150;                    // amplitude max du décalage lanceur

interface ForetLayer {
  canvas:   OffCanvas;
  parallax: number;   // 0 = fixe, 1 = suit le lanceur à fond
  shakeF:   number;   // 0 = immobile au shake, 1 = shake plein
  drift:    number;   // px/s de dérive continue (couche tilée)
  tiled:    boolean;  // true → blit répété horizontalement (nuages)
}

interface ForetPalette {
  sky:         { top: readonly [number, number, number]; bot: readonly [number, number, number] };
  cloud:       string; cloudHi:     string;
  hillFar:     string; hillNear:    string;
  forestSil:   string; forestSilHi: string;
  ray:         string;
}

function foretPalette(feverMode: boolean, bg: BgTheme): ForetPalette {
  if (feverMode) {
    return {
      sky:       { top: bg.skyTopFever, bot: bg.skyBotFever },
      cloud:     "rgba(40,30,80,0.45)",   cloudHi:     "rgba(80,60,140,0.4)",
      hillFar:   "#14123a",               hillNear:    "#0d0b2a",
      forestSil: "#0a0820",               forestSilHi: "#181048",
      ray:       "rgba(150,110,255,0.05)",
    };
  }
  return {
    sky:       { top: bg.skyTop, bot: bg.skyBot },
    cloud:     "rgba(255,252,250,0.82)", cloudHi:     "rgba(255,255,255,1)",
    hillFar:   "#00ee55",                hillNear:    "#00dd00",
    forestSil: "#008830",                forestSilHi: "#00ff55",
    ray:       "rgba(255,220,80,0.16)",
  };
}

// Crée un canvas de couche dont (0,0) local = coin haut-gauche visible.
function makeLayerCanvas(): { canvas: OffCanvas; ctx: Ctx2D } {
  const canvas = makeOffscreen(CW_L, CH_L);
  const ctx = canvas.getContext("2d") as Ctx2D;
  ctx.translate(LAYER_MARGIN, VPAD);
  return { canvas, ctx };
}

// ─── Générateurs de couches (déterministes via PRNG) ─────────────────────────

function buildForetSky(pal: ForetPalette, feverMode: boolean): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  // Gradient smoothstep — transitions plus naturelles qu'une interpolation linéaire
  const rows = 28;
  const rowH = Math.ceil(H / rows);
  for (let r = 0; r < rows; r++) {
    const t  = r / rows;
    const te = t * t * (3 - 2 * t); // smoothstep
    const cr = Math.round(pal.sky.top[0] + (pal.sky.bot[0] - pal.sky.top[0]) * te);
    const cg = Math.round(pal.sky.top[1] + (pal.sky.bot[1] - pal.sky.top[1]) * te);
    const cb = Math.round(pal.sky.top[2] + (pal.sky.bot[2] - pal.sky.top[2]) * te);
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    const y = r === 0 ? -VPAD : r * rowH;
    const h = r === 0 ? rowH + VPAD + 1 : rowH + 1;
    ctx.fillRect(LX0, y, CW_L, h);
  }

  if (!feverMode) {
    // Halo chaud à l'horizon — lumière dorée qui monte vers le ciel
    for (let row = 0; row < 12; row++) {
      const t = 1 - row / 12;
      ctx.fillStyle = `rgba(255,220,140,${(t * t * 0.18).toFixed(3)})`;
      ctx.fillRect(LX0, GROUND_Y - 115 + row * 10, CW_L, 12);
    }

    // Rayons de soleil baked — cônes lumineux depuis SUN_X/SUN_Y vers la canopée
    const sx = SUN_X, sy = SUN_Y;
    const RAY_DEFS = [
      { a: Math.PI * 0.54, hw0: 15, len: 280, alpha: 0.068 },
      { a: Math.PI * 0.63, hw0: 26, len: 340, alpha: 0.082 },
      { a: Math.PI * 0.73, hw0: 20, len: 310, alpha: 0.062 },
      { a: Math.PI * 0.82, hw0: 30, len: 370, alpha: 0.076 },
      { a: Math.PI * 0.91, hw0: 16, len: 350, alpha: 0.058 },
      { a: Math.PI * 1.05, hw0: 24, len: 410, alpha: 0.070 },
    ] as const;
    for (const ray of RAY_DEFS) {
      const cosA = Math.cos(ray.a), sinA = Math.sin(ray.a);
      const perpX = -sinA, perpY = cosA;
      for (let d = 8; d < ray.len; d += 1) {
        const t = d / ray.len;
        const a = (1 - t) * (1 - t) * ray.alpha;
        if (a < 0.002) continue;
        const cx = sx + cosA * d;
        const cy = sy + sinA * d;
        if (cy > GROUND_Y || cy < -VPAD) continue;
        const hw = Math.max(1, Math.round(ray.hw0 * (1 - t * 0.88)));
        ctx.fillStyle = `rgba(255,235,155,${a.toFixed(3)})`;
        for (let i = -hw; i <= hw; i++) {
          ctx.fillRect(Math.round(cx + perpX * i), Math.round(cy + perpY * i), 1, 1);
        }
      }
    }
  }
  return canvas;
}

function buildForetClouds(pal: ForetPalette): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  const rnd = makePrng(0x5eed1234);
  const count = 8;
  for (let i = 0; i < count; i++) {
    const cx    = LX0 + 40 + (i / count) * (CW_L - 80) + (rnd() - 0.5) * 32;
    const cy    = 14 + rnd() * 118;
    const puffs = 4 + Math.floor(rnd() * 4);
    const baseW = 32 + rnd() * 42;

    // Ombre bleue décalée derrière
    for (let p = 0; p < puffs; p++) {
      const pw = Math.round(baseW * (0.5 + rnd() * 0.7));
      const ph = Math.max(5, Math.round(pw * 0.44));
      const ox = Math.round((p - puffs / 2) * baseW * 0.46 + (rnd() - 0.5) * 8);
      const oy = Math.round((rnd() - 0.5) * 6);
      ctx.fillStyle = "rgba(100,140,190,0.14)";
      ctx.fillRect(Math.round(cx + ox - pw / 2) + 2, Math.round(cy + oy - ph / 2) + 4, pw, ph);
    }
    // Corps du nuage
    for (let p = 0; p < puffs; p++) {
      const pw = Math.round(baseW * (0.5 + rnd() * 0.7));
      const ph = Math.max(5, Math.round(pw * 0.44));
      const ox = Math.round((p - puffs / 2) * baseW * 0.46 + (rnd() - 0.5) * 8);
      const oy = Math.round((rnd() - 0.5) * 6);
      ctx.fillStyle = pal.cloud;
      ctx.fillRect(Math.round(cx + ox - pw / 2), Math.round(cy + oy - ph / 2), pw, ph);
    }
    // Ligne blanche sur le dessus
    ctx.fillStyle = pal.cloudHi;
    ctx.fillRect(Math.round(cx - baseW * 0.72), Math.round(cy - 7), Math.round(baseW * 1.46), 2);
    // Reflet bleuté sur le bas
    ctx.fillStyle = "rgba(160,200,235,0.18)";
    ctx.fillRect(Math.round(cx - baseW * 0.58), Math.round(cy + 6), Math.round(baseW * 1.18), 3);
  }
  return canvas;
}

function fillHills(
  ctx: Ctx2D, baseY: number, amp: number, freq: number, phase: number, color: string,
): void {
  ctx.fillStyle = color;
  for (let x = LX0; x < RX1; x++) {
    const y = Math.round(
      baseY + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase) * amp * 0.3,
    );
    ctx.fillRect(x, y, 1, H + VPAD - y);
  }
}

function buildForetHills(pal: ForetPalette, feverMode: boolean): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  // Perspective atmosphérique : 3 couches du plus loin (désaturé/bleuté) au plus proche (vif)
  const farCol  = feverMode ? "#101030" : "#00ee55";  // lointain : bleu-vert doux
  const midCol  = feverMode ? "#0b0f28" : "#00dd00";  // milieu : vert franc
  const nearCol = pal.hillNear;                       // proche : fourni par la palette
  fillHills(ctx, GROUND_Y - 122, 30, 0.0078, 2.2, farCol);
  fillHills(ctx, GROUND_Y - 80,  24, 0.0122, 1.3, midCol);
  fillHills(ctx, GROUND_Y - 42,  18, 0.0202, 4.1, nearCol);
  return canvas;
}

function buildForetFarTrees(pal: ForetPalette): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();

  // Génère deux rangées de centres d'arbres avec profil organique par scan-line.
  // La silhouette est calculée colonne par colonne (max height visible) → résultat
  // très naturel, aucune dent de scie, pas besoin de blitter des arbres un par un.
  type TNode = { x: number; h: number; r: number };
  function genNodes(seed: number): TNode[] {
    const prng = makePrng(seed);
    const nodes: TNode[] = [];
    let x = LX0;
    while (x < RX1) {
      nodes.push({
        x,
        h: 44 + Math.floor(prng() * 72),
        r: 12 + Math.floor(prng() * 22),
      });
      x += 5 + Math.floor(prng() * 9);
    }
    return nodes;
  }

  function fillSilhouette(nodes: TNode[], color: string, minH: number): void {
    ctx.fillStyle = color;
    for (let px = LX0; px < RX1; px++) {
      let maxH = minH;
      for (const n of nodes) {
        const dx = px - n.x;
        if (Math.abs(dx) >= n.r) continue;
        const dy = Math.round(Math.sqrt(Math.max(0, n.r * n.r - dx * dx)));
        maxH = Math.max(maxH, n.h - n.r + dy);
      }
      ctx.fillRect(px, GROUND_Y - maxH, 1, maxH);
    }
  }

  // Couche lointaine : légèrement plus claire (sensation de distance)
  fillSilhouette(genNodes(0xa1ee0001), pal.forestSilHi, 14);
  // Couche proche : plus sombre et plus grande
  fillSilhouette(genNodes(0xa17e3f01), pal.forestSil, 16);

  return canvas;
}

function buildForetMidTrees(feverMode: boolean): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  const rnd = makePrng(0xbada55e1);

  const oakBase  = ["#00ff55", "#22ee44", "#00ee50", "#33ff6a", "#11ee44"] as const;
  const oakShade = ["#006622", "#007a28", "#005520", "#007020"] as const;
  const pineBase = ["#00aa30", "#009928", "#00aa28", "#00aa30"] as const;
  const slimBase = ["#55ff77", "#33ff66", "#66ff88", "#44ff72"] as const;
  const trunks   = ["#4a3012", "#3e2808", "#5a3818", "#422a10"] as const;

  let x = LX0 + 10;
  while (x < RX1) {
    const trunk = feverMode ? "#050510" : trunks[Math.floor(rnd() * trunks.length)]!;
    // 40% pins, 40% chênes, 20% bouleaux — mix varié
    const type  = feverMode ? 1 : Math.floor(rnd() * 10);

    if (type < 4) {
      const h    = 55 + Math.floor(rnd() * 58);
      const leaf = feverMode ? "#0c0c30" : pineBase[Math.floor(rnd() * pineBase.length)]!;
      drawPineTree(ctx, x, GROUND_Y, h, leaf, feverMode ? "#101040" : "#55ee88", trunk);
      x += 40 + Math.floor(rnd() * 28);
    } else if (type < 8) {
      const crownR = 16 + Math.floor(rnd() * 16);
      const trunkH = 12 + Math.floor(rnd() * 10);
      const leaf  = feverMode ? "#0c0c30" : oakBase[Math.floor(rnd() * oakBase.length)]!;
      const shade = feverMode ? "#040418" : oakShade[Math.floor(rnd() * oakShade.length)]!;
      drawOakTree(ctx, x, GROUND_Y, trunkH, crownR, leaf, "#88ff99", shade, trunk);
      x += 48 + Math.floor(rnd() * 34);
    } else {
      const h    = 50 + Math.floor(rnd() * 40);
      const leaf = feverMode ? "#0c0c30" : slimBase[Math.floor(rnd() * slimBase.length)]!;
      drawSlimTree(ctx, x, GROUND_Y, h, leaf, feverMode ? "#101040" : "#aaff99", feverMode ? "#050510" : "#5a6858");
      x += 30 + Math.floor(rnd() * 26);
    }

    // Champignon au pied (15%)
    if (!feverMode && rnd() > 0.85) {
      drawMushroom(ctx, x + Math.round((rnd() - 0.5) * 26), GROUND_Y, 3 + Math.floor(rnd() * 4));
    }
  }
  return canvas;
}

function buildForetGround(feverMode: boolean, bg: BgTheme): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  ctx.fillStyle = feverMode ? bg.groundColorFever : bg.groundColor;
  ctx.fillRect(LX0, GROUND_Y, CW_L, CH_L);
  ctx.fillStyle = feverMode ? bg.subGroundColorFever : bg.subGroundColor;
  ctx.fillRect(LX0, GROUND_Y + 10, CW_L, CH_L);

  if (!feverMode) {
    // Herbe dense — 6 verts différents, hauteurs variées pour un tapis luxuriant
    const GRASS = ["#22ff00", "#18ee00", "#33ff11", "#0ecc00", "#44ff22", "#11dd00"] as const;
    const rndG = makePrng(0x60077a55);
    for (let gx = LX0; gx < RX1; gx += 2) {
      const h  = 2 + Math.floor(rndG() * 7);
      ctx.fillStyle = GRASS[Math.floor(rndG() * GRASS.length)]!;
      ctx.fillRect(gx, GROUND_Y - h, 2, h);
    }
    // Touffes hautes — accents dramatiques dispersés
    const rndT = makePrng(0x77a55e00);
    for (let gx = LX0 + 18; gx < RX1 - 18; gx += 28 + Math.floor(rndT() * 22)) {
      const h = 9 + Math.floor(rndT() * 7);
      ctx.fillStyle = "#2a9820";
      for (let b = -2; b <= 2; b++) {
        ctx.fillRect(gx + b * 3, GROUND_Y - h - Math.abs(b) * 2, 2, h + Math.abs(b) * 2);
      }
    }
    // Fleurs — palette riche, réparties généreusement
    const FLOWERS = ["#ff5588", "#ffaa22", "#ff88dd", "#ffffff", "#aaddff", "#ffcc44", "#ff8844", "#cc88ff", "#ffee66"] as const;
    const rndF = makePrng(0xf10e7e44);
    for (let gx = LX0 + 10; gx < RX1 - 10; gx += 13 + Math.floor(rndF() * 20)) {
      drawFlower(ctx, gx + Math.round((rndF() - 0.5) * 8), GROUND_Y, FLOWERS[Math.floor(rndF() * FLOWERS.length)]!);
    }
  } else {
    const rndG = makePrng(0x60077a55);
    for (let gx = LX0; gx < RX1; gx += 4) {
      const h = 2 + (Math.round(gx * 7 + gx * 3) % 5);
      ctx.fillStyle = bg.subGroundColorFever;
      ctx.fillRect(gx, GROUND_Y - h, 2, h);
    }
  }

  // Brume au sol
  ctx.fillStyle = feverMode ? bg.mistColorFever : bg.mistColor;
  ctx.fillRect(LX0, GROUND_Y - 8, CW_L, 16);
  ctx.fillStyle = feverMode ? bg.mistFarColorFever : bg.mistFarColor;
  ctx.fillRect(LX0, GROUND_Y - 16, CW_L, 12);
  return canvas;
}

function drawFernBush(
  ctx: Ctx2D, cx: number, baseY: number, size: number, color: string, hi: string,
): void {
  const rnd = makePrng(Math.round(cx * 131 + 7) >>> 0);
  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const ang  = -Math.PI / 2 + (i - blades / 2) * 0.28 + (rnd() - 0.5) * 0.1;
    const len  = size * (0.6 + rnd() * 0.5);
    const steps = Math.max(2, Math.round(len / 3));
    let px = cx, py = baseY;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const w = Math.max(1, Math.round((1 - t) * size * 0.08));
      px += Math.cos(ang) * 3 + Math.sin(t * 3) * 0.6;
      py += Math.sin(ang) * 3;
      ctx.fillStyle = s < 2 ? hi : color;
      ctx.fillRect(Math.round(px - w), Math.round(py), w * 2, 3);
    }
  }
}

function buildForetForeground(feverMode: boolean): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  const dark   = feverMode ? "#04040c" : "#0a3222";
  const darkHi = feverMode ? "#0a0a1e" : "#155240";
  const mid    = feverMode ? "#060614" : "#144030";
  const midHi  = feverMode ? "#0c0c22" : "#1f5c42";

  // 7 fougères réparties sur toute la largeur avec tailles variées
  drawFernBush(ctx, LX0 + 22,   GROUND_Y + 8,  100, dark, darkHi);
  drawFernBush(ctx, LX0 + 158,  GROUND_Y + 12,  68, mid,  midHi);
  drawFernBush(ctx, W * 0.30,   GROUND_Y + 10,  66, dark, darkHi);
  drawFernBush(ctx, W * 0.47,   GROUND_Y + 16,  58, mid,  midHi);
  drawFernBush(ctx, W * 0.58,   GROUND_Y + 8,   78, dark, darkHi);
  drawFernBush(ctx, RX1 - 158,  GROUND_Y + 14,  72, mid,  midHi);
  drawFernBush(ctx, RX1 - 22,   GROUND_Y + 8,  108, dark, darkHi);

  if (!feverMode) {
    // Fleurs proéminentes en avant-plan
    const FORE_FLOWERS = [
      { x: LX0 + 65,  c: "#ffaa22" }, { x: LX0 + 228, c: "#ff5588" },
      { x: W * 0.24,  c: "#ffffff" }, { x: W * 0.40,  c: "#aaddff" },
      { x: W * 0.54,  c: "#ffcc44" }, { x: W * 0.68,  c: "#ff88dd" },
      { x: RX1 - 195, c: "#ff5588" }, { x: RX1 - 62,  c: "#ffcc44" },
    ] as const;
    for (const f of FORE_FLOWERS) drawFlower(ctx, f.x, GROUND_Y + 1, f.c);
    // Champignons
    drawMushroom(ctx, LX0 + 115,  GROUND_Y - 1, 7);
    drawMushroom(ctx, W * 0.36,   GROUND_Y - 1, 5);
    drawMushroom(ctx, W * 0.72,   GROUND_Y - 1, 6);
    drawMushroom(ctx, RX1 - 108,  GROUND_Y - 1, 8);
  }

  return canvas;
}

// Position du soleil — doit coïncider avec drawCelestialBody (mode jour).
// Descendu sous l'enseigne HUD (cf. LAUNCHER_Y / HUD_H) pour rester visible.
const SUN_X = W - 42;
const SUN_Y = 74;

// Petit rebond vertical du soleil (partagé avec drawCelestialBody pour que les
// rayons restent accrochés au soleil).
function sunBob(animClock: number): number {
  return Math.sin(animClock * 1.1) * 1.5;
}

// Feuilles ambiantes qui dérivent doucement dans le vent — vie permanente de la forêt.
function drawAmbientLeaves(ctx: CanvasRenderingContext2D, s: GameState, feverMode: boolean): void {
  for (let i = 0; i < AMBIENT_LEAVES.length; i++) {
    const lf = AMBIENT_LEAVES[i]!;
    const rawY = (lf.phase / (Math.PI * 2) * (H + 50) + lf.speedY * s.animClock * 28) % (H + 60);
    const y    = Math.round(rawY) - 20;
    if (y > GROUND_Y - 28 || y < -10) continue;
    const sway = Math.sin(s.animClock * 0.52 + lf.phase * 1.4) * 38 * (Math.abs(lf.drift) / 2.8);
    const x    = Math.round((lf.x + sway + W * 5) % W);
    const twinkle = 0.22 + 0.78 * Math.abs(Math.sin(s.animClock * 0.55 + i * 0.73));

    if (feverMode) {
      ctx.globalAlpha = twinkle * 0.11;
      ctx.fillStyle = "#7733cc";
    } else {
      ctx.globalAlpha = twinkle * 0.52;
      ctx.fillStyle = lf.col;
    }
    ctx.fillRect(x, y, lf.sz, lf.sz);

    // Petite tige sous la feuille — donne un rendu pixel-art plus lisible
    if (lf.sz > 2 && !feverMode) {
      ctx.globalAlpha = twinkle * 0.22;
      ctx.fillStyle = "#2a7818";
      ctx.fillRect(x + 1, y + lf.sz, 1, 2);
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Cache des couches + scanlines ───────────────────────────────────────────

let _foretCache: { key: string; layers: ForetLayer[]; pal: ForetPalette } | null = null;

function getForetLayers(feverMode: boolean, bg: BgTheme): { layers: ForetLayer[]; pal: ForetPalette } {
  const key = feverMode ? "1" : "0";
  if (_foretCache === null || _foretCache.key !== key) {
    const pal = foretPalette(feverMode, bg);
    const layers: ForetLayer[] = [
      { canvas: buildForetSky(pal, feverMode),   parallax: 0,    shakeF: 0.10, drift: 0, tiled: false },
      { canvas: buildForetClouds(pal),           parallax: 0.04, shakeF: 0.10, drift: 5, tiled: true  },
      { canvas: buildForetHills(pal, feverMode), parallax: 0.12, shakeF: 0.20, drift: 0, tiled: false },
      { canvas: buildForetFarTrees(pal),         parallax: 0.22, shakeF: 0.30, drift: 0, tiled: false },
      { canvas: buildForetMidTrees(feverMode),   parallax: 0.40, shakeF: 0.55, drift: 0, tiled: false },
      { canvas: buildForetGround(feverMode, bg), parallax: 0,    shakeF: 1.00, drift: 0, tiled: false },
      { canvas: buildForetForeground(feverMode), parallax: 0.70, shakeF: 1.00, drift: 0, tiled: false },
    ];
    _foretCache = { key, layers, pal };
  }
  return _foretCache;
}

let _scanlines: OffCanvas | null = null;

function getScanlines(): OffCanvas {
  if (_scanlines === null) {
    _scanlines = makeOffscreen(CW_L, CH_L);
    const c = _scanlines.getContext("2d") as Ctx2D;
    c.fillStyle = "rgba(0,0,0,0.04)";
    for (let y = 0; y < CH_L; y += 2) c.fillRect(0, y, CW_L, 1);
  }
  return _scanlines;
}

// ─── Composition de la forêt (par frame) ─────────────────────────────────────

function drawForetLayers(
  ctx: CanvasRenderingContext2D, s: GameState, feverMode: boolean, bg: BgTheme,
): void {
  const { layers, pal } = getForetLayers(feverMode, bg);
  const launchDelta = Math.max(-PARALLAX_CLAMP, Math.min(PARALLAX_CLAMP, s.launcherX - W / 2));

  for (let i = 0; i < layers.length; i++) {
    const L  = layers[i]!;
    const px = launchDelta * L.parallax;
    // Brise : ondulation horizontale, plus forte sur le feuillage proche.
    const breeze = Math.sin(s.animClock * 0.9 + i * 0.7) * L.parallax * 4;
    const ex = LX0 - px + breeze - s.shakeX * (1 - L.shakeF);
    const ey = -VPAD             - s.shakeY * (1 - L.shakeF);

    if (L.tiled) {
      const driftPx = (s.animClock * L.drift) % CW_L;
      let start = (ex - driftPx) % CW_L;
      while (start > LX0) start -= CW_L;
      for (let x = start; x < RX1; x += CW_L) {
        ctx.drawImage(L.canvas, Math.round(x), Math.round(ey));
      }
    } else {
      ctx.drawImage(L.canvas, Math.round(ex), Math.round(ey));
    }

  }

  // Feuilles ambiantes (forêt vivante — dessus des couches statiques)
  drawAmbientLeaves(ctx, s, feverMode);

  // Scanlines CRT, fixées à l'écran (contre-translation complète du shake)
  ctx.drawImage(getScanlines(), Math.round(LX0 - s.shakeX), Math.round(-VPAD - s.shakeY));
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Point d'entrée principal ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  feverIntensity: number,
  theme: GameTheme,
): void {
  const feverMode = feverIntensity > 0.3;

  if (theme.id === "foret") {
    // Décor forêt : couches procédurales avec parallaxe (lanceur + dérive + shake)
    drawForetLayers(ctx, s, feverMode, theme.bg);
  } else {
    // Autres thèmes : fond statique unique (blit depuis OffscreenCanvas)
    ctx.drawImage(getStaticBg(feverMode, theme), -BG_PAD, -BG_PAD);
    switch (theme.id) {
      case "abime": drawAbimeAnimated(ctx, s, feverMode); break;
      case "enfer": drawEnferAnimated(ctx, s, feverMode); break;
      case "glace": drawGlaceAnimated(ctx, s, feverMode); break;
    }
  }

  // Corps céleste (soleil / lune de fièvre)
  drawCelestialBody(ctx, s, feverMode, theme.id);

  // Étoiles de fièvre (commun à tous les thèmes)
  if (feverMode) drawFeverStars(ctx, s);

  // Lucioles (Forêt uniquement)
  if (theme.bg.hasFireflies) drawFireflies(ctx, s, feverMode);

  // Easter egg : oiseaux déclenchés par les impacts de pegs (clin d'œil peagle)
  if (s.birds.length > 0) drawBgBirds(ctx, s);
}
