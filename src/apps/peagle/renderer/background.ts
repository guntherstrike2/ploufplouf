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
// ─── FORÊT data — générée par run via forestSeed ─────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Lucioles et feuilles sont des types de données générées par run.
// Elles vivent dans le cache de couches (ForetCacheEntry) plutôt que comme
// constantes de module, afin de changer d'aspect à chaque nouvelle partie.

type AmbientLeaf = {
  x: number; speedY: number; drift: number; phase: number; sz: number; col: string;
};
type FireflyItem = { x: number; y: number };
type MidTreeDef  = {
  x: number; h: number; w: number; type: "oak" | "pine" | "shrub";
  trunkCol: string; leafDark: string; leafMid: string; leafHi: string;
};

const LEAF_COLS = ["#4ab832", "#7acc44", "#aadd22", "#c4cc22", "#88bb33", "#55cc44"] as const;

function generateLeaves(seed: number): AmbientLeaf[] {
  const rnd = makePrng(seed);
  return Array.from({ length: 26 }, () => ({
    x:      Math.round(rnd() * W),
    speedY: 0.14 + rnd() * 0.42,
    drift:  (rnd() - 0.5) * 3.2,
    phase:  rnd() * Math.PI * 2,
    sz:     rnd() < 0.38 ? 3 : 2,
    col:    LEAF_COLS[Math.floor(rnd() * LEAF_COLS.length)]!,
  }));
}

function generateFireflies(seed: number): FireflyItem[] {
  const rnd = makePrng(seed);
  return Array.from({ length: 14 }, () => ({
    x: 28 + Math.floor(rnd() * (W - 56)),
    y: GROUND_Y - 28 - Math.floor(rnd() * 100),
  }));
}

const CLUTCH_STARS = [
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

// Pin pixel-art à tiers rectangulaires empilés — look blocky pixel art,
// distinct des triangles lisses de l'ancienne version.
function drawRectPine(
  ctx: Ctx2D, cx: number, baseY: number, h: number, w: number,
  leafMid: string, leafHi: string, leafShadow: string, trunkColor: string,
): void {
  const tx       = Math.round(cx);
  const trunkH   = Math.max(3, Math.round(h * 0.14));
  const trunkW   = Math.max(2, Math.round(w * 0.11));
  const tiers    = h > 65 ? 4 : 3;
  const tipY     = baseY - h;
  const foliageH = h - trunkH;

  ctx.fillStyle = trunkColor;
  ctx.fillRect(tx - (trunkW >> 1), baseY - trunkH, trunkW, trunkH);

  for (let t = 0; t < tiers; t++) {
    const hw       = Math.round((w / 2) * (0.28 + 0.72 * (t + 1) / tiers));
    const tierTopY = Math.round(tipY + (t / tiers) * foliageH * 0.85);
    const tierH    = Math.max(5, Math.round(foliageH / tiers * 1.30));
    const tierBotY = tierTopY + tierH;

    // Rectangle plein pour chaque tier
    ctx.fillStyle = leafMid;
    ctx.fillRect(tx - hw, tierTopY, hw * 2, tierH);

    // Highlight haut + gauche
    ctx.fillStyle = leafHi;
    ctx.fillRect(tx - hw + 1, tierTopY, hw * 2 - 2, 2);
    ctx.fillRect(tx - hw,     tierTopY + 1, 2, Math.round(tierH * 0.50));

    // Shadow bas + droite
    ctx.fillStyle = leafShadow;
    ctx.fillRect(tx - hw + 1, tierBotY - 2, hw * 2 - 2, 3);
    ctx.fillRect(tx + hw - 2, tierTopY + 2, 2, tierH - 4);
  }
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

function drawAbimeStaticLayers(ctx: Ctx2D, clutchMode: boolean): void {
  // Nébuleuses
  for (const neb of ABIME_NEBULAS) {
    const mult = clutchMode ? 1.8 : 1;
    ctx.fillStyle = `rgba(${neb.r},${neb.g},${neb.b},${(neb.a * mult).toFixed(3)})`;
    ctx.fillRect(neb.x, neb.y, neb.w, neb.h);
    ctx.fillStyle = `rgba(${neb.r},${neb.g},${neb.b},${(neb.a * 0.6 * mult).toFixed(3)})`;
    ctx.fillRect(
      Math.round(neb.x + neb.w * 0.2), Math.round(neb.y + neb.h * 0.2),
      Math.round(neb.w * 0.6),         Math.round(neb.h * 0.6),
    );
  }

  // Planète
  drawAbimePlanet(ctx, clutchMode);

  // Champ d'étoiles de base (les scintillements sont animés par-dessus)
  ctx.globalAlpha = 0.72;
  for (const st of ABIME_STARS) {
    ctx.fillStyle = st.col;
    ctx.fillRect(st.x, st.y, st.sz, st.sz);
  }
  ctx.globalAlpha = 1;
}

function drawAbimePlanet(ctx: Ctx2D, clutchMode: boolean): void {
  const cx = W - 74, cy = 68, r = 18;

  // Halo d'atmosphère
  for (let ar = r + 7; ar > r; ar--) {
    const alpha = (ar - r - 1) * 0.014;
    ctx.fillStyle = clutchMode
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
    ctx.fillStyle = clutchMode
      ? (t < 0.35 ? "#00336a" : t < 0.65 ? "#002255" : "#001133")
      : (t < 0.35 ? "#7733bb" : t < 0.65 ? "#551199" : "#330066");
    ctx.fillRect(cx - hw, cy + dy, hw * 2, 1);
  }

  // Bande équatoriale
  for (let dy = 1; dy <= 4; dy++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (hw < 2) continue;
    ctx.fillStyle = clutchMode ? "rgba(0,60,130,0.38)" : "rgba(160,80,255,0.30)";
    ctx.fillRect(cx - hw, cy + dy, hw * 2, 1);
  }

  // Highlight
  ctx.fillStyle = clutchMode ? "rgba(100,180,255,0.58)" : "rgba(220,190,255,0.62)";
  ctx.fillRect(cx - r + 4, cy - r + 4, 6, 2);
  ctx.fillRect(cx - r + 4, cy - r + 5, 2, 3);

  // Anneau
  const rw = r + 12;
  for (let dx = -rw; dx <= rw; dx++) {
    if (Math.abs(dx) < r - 3) continue;
    const ovalDy = Math.round(4 * Math.sqrt(Math.max(0, 1 - (dx / rw) ** 2)));
    ctx.fillStyle = clutchMode ? "rgba(0,80,180,0.44)" : "rgba(150,100,220,0.44)";
    ctx.fillRect(cx + dx, cy + ovalDy, 1, 1);
    if (ovalDy > 0) ctx.fillRect(cx + dx, cy - ovalDy, 1, 1);
  }
}

// ─── ABÎME — animation par frame ─────────────────────────────────────────────

function drawAbimeAnimated(ctx: CanvasRenderingContext2D, s: GameState, clutchMode: boolean): void {
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
  ctx.globalAlpha = pulse * (clutchMode ? 0.10 : 0.06);
  ctx.fillStyle = clutchMode ? "#004488" : "#6622aa";
  ctx.fillRect(W - 96, 46, 50, 50);
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── ENFER — éléments statiques ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function drawEnferMountains(ctx: Ctx2D, clutchMode: boolean): void {
  // Colonnnes de feu lointaines (halo dans le fond)
  const fireX = [50, 140, 240, 340, 440] as const;
  for (const fx of fireX) {
    for (let dy = 0; dy < 180; dy++) {
      const t = dy / 180;
      const fw = Math.round(20 * (1 - t * 0.7));
      const a  = (1 - t) * (clutchMode ? 0.11 : 0.065);
      ctx.fillStyle = `rgba(255,${80 - Math.round(50 * t)},0,${a.toFixed(3)})`;
      ctx.fillRect(((fx - fw / 2) | 0), GROUND_Y - dy, fw, 2);
    }
  }

  // Montagnes volcaniques (couche lointaine, couche proche)
  for (const layer of [0, 1] as const) {
    for (const m of ENFER_MOUNTAINS) {
      if (m.layer !== layer) continue;
      const color = layer === 0
        ? (clutchMode ? "#1a0800" : "#3a1008")
        : (clutchMode ? "#0e0400" : "#220600");
      drawMountain(ctx, m.x, m.peakY, GROUND_Y, m.bw, color);
    }
  }
}

function drawEnferGroundDetails(ctx: Ctx2D, clutchMode: boolean): void {
  // Stalactites de lave accrochées au plafond
  for (const st of ENFER_STALACTITES) {
    drawStalactite(ctx, st.x, st.bw, st.len,
      clutchMode ? "#1a0600" : "#2a0c04",
      clutchMode ? "#441008" : "#661408",
    );
    // Lueur au bout
    ctx.fillStyle = clutchMode ? "rgba(255,80,0,0.5)" : "rgba(200,50,0,0.35)";
    ctx.fillRect(st.x - 1, st.len - 3, 3, 4);
  }

  // Fissures de lave dans le sol
  for (const c of ENFER_LAVA_CRACKS) {
    ctx.fillStyle = clutchMode ? "rgba(255,180,0,0.72)" : "rgba(255,100,0,0.55)";
    ctx.fillRect(c.x, GROUND_Y - 1, c.len, 2);
    ctx.fillStyle = clutchMode ? "rgba(255,220,50,0.38)" : "rgba(255,200,0,0.28)";
    ctx.fillRect(c.x, GROUND_Y - 2, c.len, 1);
    ctx.fillRect(c.x, GROUND_Y + 1, c.len, 1);
    ctx.fillStyle = clutchMode ? "rgba(255,100,0,0.18)" : "rgba(200,50,0,0.12)";
    ctx.fillRect(c.x - 2, GROUND_Y - 3, c.len + 4, 6);
  }
}

// ─── ENFER — animation par frame ─────────────────────────────────────────────

function drawEnferAnimated(ctx: CanvasRenderingContext2D, s: GameState, clutchMode: boolean): void {
  // Braises qui montent
  for (let i = 0; i < ENFER_EMBERS.length; i++) {
    const e = ENFER_EMBERS[i]!;
    const rawY = GROUND_Y - ((e.phase / (Math.PI * 2) * 380 + e.speed * s.animClock * 28) % 400);
    const y = Math.round(rawY);
    if (y < 0 || y > GROUND_Y) continue;

    const drift = Math.sin(s.animClock * 1.4 + e.phase) * 14;
    const x     = Math.round((e.x + drift + W * 3) % W);
    const twink = 0.4 + 0.6 * Math.abs(Math.sin(s.animClock * 2.2 + i * 0.8));

    ctx.globalAlpha = twink * (clutchMode ? 0.85 : 0.55);
    ctx.fillStyle = e.col;
    ctx.fillRect(x, y, 2, 2);
    ctx.globalAlpha = twink * (clutchMode ? 0.22 : 0.12);
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
    ctx.globalAlpha = flicker * (clutchMode ? 0.72 : 0.45);
    ctx.fillStyle = "#ff8800";
    ctx.fillRect(st.x - 2, st.len, 4, 3);
    ctx.globalAlpha = flicker * (clutchMode ? 0.18 : 0.10);
    ctx.fillStyle = "#ff6600";
    ctx.fillRect(st.x - 5, st.len - 2, 10, 8);
  }
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── GLACE — éléments statiques ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function drawGlaceGroundDetails(ctx: Ctx2D, clutchMode: boolean): void {
  // Congères de neige sur le sol
  for (const d of GLACE_SNOWDRIFTS) {
    for (let dy = 0; dy < d.rh; dy++) {
      const t  = dy / d.rh;
      const hw = Math.round(d.rw / 2 * Math.sqrt(1 - t * t));
      ctx.fillStyle = clutchMode ? "#5577aa" : "#c8e8f0";
      ctx.fillRect(d.cx - hw, GROUND_Y - d.rh + dy, hw * 2, 1);
    }
    ctx.fillStyle = clutchMode ? "rgba(100,150,200,0.38)" : "rgba(255,255,255,0.52)";
    ctx.fillRect(d.cx - Math.round(d.rw * 0.28), GROUND_Y - d.rh + 2, Math.round(d.rw * 0.38), 2);
  }

  // Arbres gelés en arrière-plan
  for (const t of GLACE_TREES) {
    drawFrozenTree(ctx, t.x, GROUND_Y, t.h, t.scale, clutchMode ? "#335577" : "#88aabb");
  }

  // Stalactites de glace (plafond → bas)
  for (const st of GLACE_STALACTITES) {
    drawStalactite(ctx, st.x, st.bw, st.len,
      clutchMode ? "#224466" : "#88ccee",
      clutchMode ? "#336688" : "#cceeff",
    );
    ctx.fillStyle = clutchMode ? "rgba(50,100,200,0.38)" : "rgba(100,220,255,0.48)";
    ctx.fillRect(st.x - 2, st.len - 3, 4, 5);
  }

  // Stalagmites de glace (sol → haut)
  for (const st of GLACE_STALAGMITES) {
    drawStalagmite(ctx, st.x, GROUND_Y, st.bw, st.len,
      clutchMode ? "#1a3a55" : "#66aacc",
      clutchMode ? "#2a5577" : "#aaddee",
    );
  }

  // Cristaux de glace
  for (const cr of GLACE_CRYSTALS) {
    drawIceCrystal(ctx, cr.x, GROUND_Y - 5, cr.h,
      clutchMode ? "#1a4466" : "#44aadd",
      clutchMode ? "rgba(50,100,180,0.65)" : "rgba(180,240,255,0.78)",
    );
  }
}

// ─── GLACE — animation par frame ─────────────────────────────────────────────

function drawGlaceAnimated(ctx: CanvasRenderingContext2D, s: GameState, clutchMode: boolean): void {
  // Aurore boréale
  drawGlaceAurora(ctx, s.animClock, clutchMode);

  // Chute de neige
  for (const sf of GLACE_SNOW) {
    const rawY = (sf.phase / (Math.PI * 2) * H + sf.speed * s.animClock * 28) % (H + 30);
    const y    = Math.round(rawY) - 10;
    if (y < 0 || y > GROUND_Y) continue;
    const drift = Math.sin(s.animClock * 0.9 + sf.phase) * 20 * Math.abs(sf.drift);
    const x     = Math.round((sf.x + drift + W * 4) % W);
    ctx.globalAlpha = clutchMode ? 0.15 : 0.62;
    ctx.fillStyle = "#ddeeff";
    ctx.fillRect(x, y, sf.sz, sf.sz);
  }
  ctx.globalAlpha = 1;

  // Scintillement des cristaux
  for (let i = 0; i < GLACE_CRYSTALS.length; i++) {
    const cr = GLACE_CRYSTALS[i]!;
    const t  = Math.abs(Math.sin(s.animClock * 0.85 + i * 1.45));
    if (t > 0.82) {
      ctx.globalAlpha = (t - 0.82) * 4 * (clutchMode ? 0.28 : 0.88);
      ctx.fillStyle = "#ffffff";
      const sparkY = (GROUND_Y - cr.h / 2) | 0;
      ctx.fillRect(cr.x - 1, sparkY, 3, 1);
      ctx.fillRect(cr.x,     sparkY - 1, 1, 3);
    }
  }
  ctx.globalAlpha = 1;
}

function drawGlaceAurora(ctx: CanvasRenderingContext2D, animClock: number, clutchMode: boolean): void {
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
      const fa   = clutchMode ? si * 0.38 : si;
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
  ctx: CanvasRenderingContext2D, s: GameState, clutchMode: boolean, themeId?: string,
): void {
  if (clutchMode) {
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

function drawClutchStars(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (let i = 0; i < CLUTCH_STARS.length; i++) {
    const st = CLUTCH_STARS[i]!;
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

function drawFireflies(ctx: CanvasRenderingContext2D, s: GameState, clutchMode: boolean, fireflies: FireflyItem[]): void {
  for (let i = 0; i < fireflies.length; i++) {
    const ff = fireflies[i]!;
    if (ff.y > GROUND_Y - 20) continue;
    const phase   = i * 1.7 + s.animClock * (0.4 + (i % 3) * 0.15);
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(phase));

    if (clutchMode) {
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

function buildStaticBg(clutchMode: boolean, bg: BgTheme, themeId: string): OffCanvas {
  const CW = W + BG_PAD * 2;
  const CH = H + BG_PAD * 2;
  const canvas = makeOffscreen(CW, CH);
  const ctx = canvas.getContext("2d") as Ctx2D;
  ctx.translate(BG_PAD, BG_PAD);

  const skyRows = 12;
  const topC = clutchMode ? bg.skyTopClutch : bg.skyTop;
  const botC = clutchMode ? bg.skyBotClutch : bg.skyBot;

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
  if (themeId === "abime") drawAbimeStaticLayers(ctx, clutchMode);

  // ③ Montagnes d'Enfer (dessinées avant le sol pour que la base soit cachée)
  if (themeId === "enfer") drawEnferMountains(ctx, clutchMode);

  // ⑤ Sol principal (étendu au-delà des bords pour couvrir le shake)
  ctx.fillStyle = clutchMode ? bg.groundColorClutch : bg.groundColor;
  ctx.fillRect(-BG_PAD, GROUND_Y, CW, CH);

  // ⑥ Herbe (Forêt / Glace — pas pour Enfer)
  if (themeId !== "enfer") {
    ctx.fillStyle = clutchMode ? bg.subGroundColorClutch : bg.subGroundColor;
    for (let gx = -BG_PAD; gx < W + BG_PAD; gx += 4) {
      const h = 2 + (Math.abs((gx >> 2) * 13 + 7) % 5);
      ctx.fillRect(gx, GROUND_Y - h, 2, h);
    }
    ctx.fillStyle = clutchMode ? bg.subGroundColorClutch : bg.subGroundColor;
    ctx.fillRect(-BG_PAD, GROUND_Y + 10, CW, CH);
  }

  // ⑦ Détails au sol : Enfer (fissures + stalactites) / Glace (glace + neige)
  if (themeId === "enfer") drawEnferGroundDetails(ctx, clutchMode);
  if (themeId === "glace") drawGlaceGroundDetails(ctx, clutchMode);

  // ⑧ Brume au sol
  ctx.fillStyle = clutchMode ? bg.mistColorClutch : bg.mistColor;
  ctx.fillRect(-BG_PAD, GROUND_Y - 8, CW, 16);
  ctx.fillStyle = clutchMode ? bg.mistFarColorClutch : bg.mistFarColor;
  ctx.fillRect(-BG_PAD, GROUND_Y - 16, CW, 12);

  // ⑨ Scanlines (baked une seule fois)
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  for (let sy = -BG_PAD; sy < H + BG_PAD; sy += 2) {
    ctx.fillRect(-BG_PAD, sy, CW, 1);
  }

  return canvas;
}

function getStaticBg(clutchMode: boolean, theme: GameTheme): OffCanvas {
  const key = `${clutchMode ? 1 : 0}:${theme.id}`;
  if (_staticBgCache === null || _staticBgKey !== key) {
    if (typeof OffscreenCanvas !== "undefined" && _staticBgCache instanceof OffscreenCanvas) {
      (_staticBgCache as OffscreenCanvas & { close(): void }).close();
    }
    _staticBgCache = buildStaticBg(clutchMode, theme.bg, theme.id);
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

function foretPalette(clutchMode: boolean, bg: BgTheme): ForetPalette {
  if (clutchMode) {
    return {
      sky:       { top: bg.skyTopClutch, bot: bg.skyBotClutch },
      // Nuages nocturnes — légèrement plus visibles que l'ancien rgba(40,30,80)
      cloud:     "rgba(48,38,105,0.55)",  cloudHi:     "rgba(78,62,148,0.58)",
      // Collines nuit : profondeur indigo
      hillFar:   "#0f0d30",               hillNear:    "#09071e",
      // Silhouettes d'arbres lointains — assez sombres mais distinguables
      forestSil: "#100c3e",               forestSilHi: "#1e1862",
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

function buildForetSky(pal: ForetPalette, clutchMode: boolean): OffCanvas {
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

  if (!clutchMode) {
    // Halo chaud à l'horizon — lumière dorée qui monte vers le ciel
    for (let row = 0; row < 12; row++) {
      const t = 1 - row / 12;
      ctx.fillStyle = `rgba(255,220,140,${(t * t * 0.18).toFixed(3)})`;
      ctx.fillRect(LX0, GROUND_Y - 115 + row * 10, CW_L, 12);
    }

    // Rayons de soleil baked — écriture directe dans l'ImageData pour éviter
    // les ~144 000 appels fillRect individuels que génère la double boucle pixel.
    const sx = SUN_X, sy = SUN_Y;
    const RAY_DEFS = [
      { a: Math.PI * 0.54, hw0: 15, len: 280, alpha: 0.068 },
      { a: Math.PI * 0.63, hw0: 26, len: 340, alpha: 0.082 },
      { a: Math.PI * 0.73, hw0: 20, len: 310, alpha: 0.062 },
      { a: Math.PI * 0.82, hw0: 30, len: 370, alpha: 0.076 },
      { a: Math.PI * 0.91, hw0: 16, len: 350, alpha: 0.058 },
      { a: Math.PI * 1.05, hw0: 24, len: 410, alpha: 0.070 },
    ] as const;
    // getImageData opère en coords canvas physiques (ignorant le translate).
    // Le translate(LAYER_MARGIN, VPAD) de makeLayerCanvas décale les coords jeu :
    //   canvas_px = jeu_x + LAYER_MARGIN,  canvas_py = jeu_y + VPAD
    const imgData = ctx.getImageData(0, 0, CW_L, CH_L);
    const data = imgData.data;
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
        for (let i = -hw; i <= hw; i++) {
          const px = Math.round(cx + perpX * i) + LAYER_MARGIN;
          const py = Math.round(cy + perpY * i) + VPAD;
          if (px < 0 || px >= CW_L || py < 0 || py >= CH_L) continue;
          const idx = (py * CW_L + px) * 4;
          // Blend rgba(255,235,155,a) sur un fond opaque
          data[idx]!     = Math.round(data[idx]!     + (255 - data[idx]!)     * a);
          data[idx + 1]! = Math.round(data[idx + 1]! + (235 - data[idx + 1]!) * a);
          data[idx + 2]! = Math.round(data[idx + 2]! + (155 - data[idx + 2]!) * a);
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
}

function buildForetClouds(pal: ForetPalette, seed: number): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  const rnd = makePrng(seed);
  const count = 3 + Math.floor(rnd() * 3); // 3–5 nuages par run
  for (let i = 0; i < count; i++) {
    const cx    = LX0 + 40 + (i / count) * (CW_L - 80) + (rnd() - 0.5) * 32;
    const cy    = 60 + rnd() * 90;
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

function buildForetHills(pal: ForetPalette, clutchMode: boolean, seed: number): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  const rnd = makePrng(seed);
  const p0  = 2.0 + (rnd() - 0.5) * 1.4;
  const p1  = 1.2 + (rnd() - 0.5) * 1.0;
  const p2  = 3.5 + (rnd() - 0.5) * 1.2;
  const p3  = 4.8 + (rnd() - 0.5) * 1.0;
  if (clutchMode) {
    fillHills(ctx, GROUND_Y - 150, 28, 0.0058, p0, "#181542");
    fillHills(ctx, GROUND_Y - 108, 24, 0.0088, p1, "#100e30");
    fillHills(ctx, GROUND_Y - 72,  18, 0.0128, p2, "#0a0820");
    fillHills(ctx, GROUND_Y - 42,  12, 0.0188, p3, "#060614");
  } else {
    fillHills(ctx, GROUND_Y - 150, 28, 0.0058, p0, "#55dd66");
    fillHills(ctx, GROUND_Y - 108, 24, 0.0088, p1, "#22cc33");
    fillHills(ctx, GROUND_Y - 72,  18, 0.0128, p2, "#0ea820");
    fillHills(ctx, GROUND_Y - 42,  12, 0.0188, p3, "#087010");
  }
  return canvas;
}

function buildForetFarTrees(pal: ForetPalette, seed: number): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();

  // Blocs rectangulaires qui forment la silhouette de la canopée.
  // Les blocs se superposent : on calcule la hauteur max par colonne →
  // silhouette continue avec des "dents" rectangulaires bien visibles.
  interface Block { x: number; w: number; h: number }

  function genBlocks(bSeed: number, hMin: number, hMax: number, minW: number, maxW: number): Block[] {
    const pr = makePrng(bSeed);
    const blocks: Block[] = [];
    let x = LX0;
    while (x < RX1) {
      const w = minW + Math.floor(pr() * (maxW - minW));
      const h = hMin + Math.floor(pr() * (hMax - hMin));
      blocks.push({ x, w, h });
      x += w + 1 + Math.floor(pr() * 8);
    }
    return blocks;
  }

  function drawSilRow(blocks: Block[], color: string, hiColor: string): void {
    for (let x = LX0; x < RX1; x++) {
      let maxH = 0;
      for (const b of blocks) {
        if (x >= b.x && x < b.x + b.w && b.h > maxH) maxH = b.h;
      }
      if (maxH > 0) {
        ctx.fillStyle = color;
        ctx.fillRect(x, GROUND_Y - maxH, 1, maxH + VPAD);
      }
    }
    // Arête supérieure highlight sur chaque bloc (look pixel-art)
    ctx.fillStyle = hiColor;
    for (const b of blocks) {
      ctx.fillRect(b.x + 1,  GROUND_Y - b.h,     b.w - 2, 2);
      ctx.fillRect(b.x,      GROUND_Y - b.h + 1,  2,      Math.round(b.h * 0.22));
    }
  }

  // Rangée lointaine : blocs étroits, plus clairs, plus courts
  drawSilRow(genBlocks(seed ^ 0xca001bee, 18, 52, 14, 30), pal.forestSilHi, "rgba(255,255,255,0.10)");
  // Rangée proche : blocs larges, plus sombres, plus hauts, plus denses
  drawSilRow(genBlocks(seed ^ 0xca002bee, 40, 92, 18, 38), pal.forestSil,   "rgba(255,255,255,0.05)");

  return canvas;
}

// Couronne chêne rectangulaire pixel-art — tronc baked dans le canvas statique,
// seule la couronne est animée (vent). Coordonnées en game-space.
function drawOakCanopy(
  ctx: Ctx2D, cx: number, baseY: number, h: number, w: number,
  leafDark: string, leafMid: string, leafHi: string,
): void {
  const tx      = Math.round(cx);
  const hw      = w >> 1;
  const trunkH  = Math.round(h * 0.36);
  const canopyH = h - trunkH;
  const topY    = baseY - trunkH - canopyH;

  // Rectangle principal avec encoches pixel-art aux coins (1px)
  ctx.fillStyle = leafMid;
  ctx.fillRect(tx - hw + 1, topY,                  w - 2, 1);          // bord haut (rentré)
  ctx.fillRect(tx - hw,     topY + 1,              w,     canopyH - 2); // corps
  ctx.fillRect(tx - hw + 1, topY + canopyH - 1,   w - 2, 1);           // bord bas (rentré)

  // Highlight haut-gauche
  ctx.fillStyle = leafHi;
  ctx.fillRect(tx - hw + 1, topY,      w - 3,                    2);
  ctx.fillRect(tx - hw,     topY + 1,  2,  Math.round(canopyH * 0.50));

  // Shadow bas-droite
  ctx.fillStyle = leafDark;
  ctx.fillRect(tx - hw + 2, topY + canopyH - 2, w - 4, 2);
  ctx.fillRect(tx + hw - 2, topY + 2,           2,     canopyH - 4);

  // Bosses pixel-art sur le dessus (déterministes via hash cx^h)
  const bseed  = (((tx * 2654435761) ^ (h * 40503)) >>> 0);
  const nBumps = 2 + (bseed & 3);
  for (let i = 0; i < nBumps; i++) {
    const bi  = (bseed >>> (i * 5 + 3)) & 0xff;
    const bw2 = 2 + ((bseed >>> (i * 7 + 1)) & 3);
    const bh2 = 2 + ((bseed >>> (i * 3 + 2)) & 3);
    const bx  = tx - hw + 3 + Math.round((bi / 255) * (w - 8));
    ctx.fillStyle = (i & 1) ? leafMid : leafHi;
    ctx.fillRect(bx, topY - bh2, bw2, bh2 + 1);
  }
}

// Arbuste rectangulaire bas — pousse directement du sol, pas de tronc visible.
function drawShrubCanopy(
  ctx: Ctx2D, cx: number, baseY: number, h: number, w: number,
  leafDark: string, leafMid: string, leafHi: string,
): void {
  const tx  = Math.round(cx);
  const hw  = w >> 1;
  const topY = baseY - h;

  // Corps large
  ctx.fillStyle = leafMid;
  ctx.fillRect(tx - hw + 1, topY,     w - 2, h);
  ctx.fillRect(tx - hw,     topY + 1, 1,     h - 2);
  ctx.fillRect(tx + hw - 1, topY + 1, 1,     h - 2);

  // Highlight haut + gauche
  ctx.fillStyle = leafHi;
  ctx.fillRect(tx - hw + 1, topY,     w - 4, 2);
  ctx.fillRect(tx - hw,     topY + 1, 2,     Math.round(h * 0.45));

  // Shadow bas + droite
  ctx.fillStyle = leafDark;
  ctx.fillRect(tx - hw + 2, baseY - 2, w - 4, 2);
  ctx.fillRect(tx + hw - 2, topY + 2,  2,     h - 4);

  // Bosses sur le dessus (déterministes)
  const bseed   = (((tx * 1664525) ^ (w * 22695477)) >>> 0);
  const numBumps = 2 + (bseed & 1);
  for (let i = 0; i < numBumps; i++) {
    const bi = (bseed >>> (i * 9 + 4)) & 0xff;
    const bx = tx - hw + 4 + Math.round((bi / 255) * (w - 10));
    ctx.fillStyle = (i & 1) ? leafMid : leafHi;
    ctx.fillRect(bx, topY - 3, 4, 4);
  }
}

// Algorithme de forêt par clusters — chaque cluster a une espèce dominante
// et une échelle de taille cohérente. Les clusters se chevauchent partiellement,
// créant des clairières naturelles et des zones denses. Troncs baked dans le
// canvas statique ; couronnes animées par frame (vent).
function buildForetMidLayer(clutchMode: boolean, seed: number): { canvas: OffCanvas; trees: MidTreeDef[] } {
  const { canvas, ctx } = makeLayerCanvas();
  const rnd = makePrng(seed);

  const dayTrunks   = ["#3a2a18", "#2e2010", "#442e1a", "#362412"] as const;
  const dayLeafDark = ["#0d3818", "#0a3016", "#123018", "#0c2c14"] as const;
  const dayLeafMid  = ["#186030", "#137828", "#1c5828", "#0e7030"] as const;
  const dayLeafHi   = ["#38903c", "#2ab040", "#2e8838", "#20b034"] as const;
  const fevTrunks   = ["#080828", "#0a0a32", "#06061c", "#0c0c2e"] as const;
  const fevLeafDark = ["#05071a", "#040618", "#070920", "#040510"] as const;
  const fevLeafMid  = ["#0c1042", "#0e1450", "#0a0e38", "#10165e"] as const;
  const fevLeafHi   = ["#161e72", "#1e2888", "#12205c", "#1e2e8a"] as const;

  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]!;

  type ClusterKind = "oak" | "pine" | "mixed";
  interface Cluster { from: number; to: number; kind: ClusterKind; hScale: number }

  // Génère les clusters qui couvrent toute la largeur de la couche
  const clusters: Cluster[] = [];
  let cx = LX0 + 10;
  while (cx < RX1 - 10) {
    const width  = 50 + Math.floor(rnd() * 95);
    const kind: ClusterKind = rnd() < 0.40 ? "oak" : rnd() < 0.55 ? "pine" : "mixed";
    const hScale = 0.65 + rnd() * 0.65;
    clusters.push({ from: cx, to: cx + width, kind, hScale });
    cx += Math.round(width * (0.50 + rnd() * 0.55));
  }

  const trees: MidTreeDef[] = [];

  for (const cluster of clusters) {
    let tx = cluster.from + 2 + Math.floor(rnd() * 10);
    while (tx < cluster.to) {
      const rawH = 50 + Math.floor(rnd() * 70);
      const h    = Math.max(28, Math.min(140, Math.round(rawH * cluster.hScale)));

      const type: "oak" | "pine" | "shrub" =
        cluster.kind === "oak"  ? (rnd() < 0.80 ? "oak"   : "shrub") :
        cluster.kind === "pine" ? (rnd() < 0.80 ? "pine"  : "oak"  ) :
        (rnd() < 0.42 ? "oak"  : rnd() < 0.68 ? "pine" : "shrub");

      const trunkCol = clutchMode ? pick(fevTrunks)   : pick(dayTrunks);
      const leafDark = clutchMode ? pick(fevLeafDark) : pick(dayLeafDark);
      const leafMid  = clutchMode ? pick(fevLeafMid)  : pick(dayLeafMid);
      const leafHi   = clutchMode ? pick(fevLeafHi)   : pick(dayLeafHi);

      let w: number;
      let step: number;

      if (type === "oak") {
        w = Math.round(h * (0.62 + rnd() * 0.52));
        // Tronc baked (la couronne est animée séparément)
        const tw     = Math.max(2, Math.round(h * 0.055));
        const trunkH = Math.round(h * 0.36);
        ctx.fillStyle = trunkCol;
        ctx.fillRect(Math.round(tx) - (tw >> 1), GROUND_Y - trunkH, tw, trunkH);
        step = Math.round(w * (0.42 + rnd() * 0.30) + 4 + rnd() * 14);
      } else if (type === "pine") {
        w = Math.round(h * (0.26 + rnd() * 0.22));
        // Tronc baked (le pin entier est aussi redessiné par frame, mais le tronc
        // baked reste visible en fallback si le vent est nul)
        const tw     = Math.max(2, Math.round(w * 0.11));
        const trunkH = Math.max(4, Math.round(h * 0.14));
        ctx.fillStyle = trunkCol;
        ctx.fillRect(Math.round(tx) - (tw >> 1), GROUND_Y - trunkH, tw, trunkH);
        step = Math.round(w * (0.55 + rnd() * 0.35) + 3 + rnd() * 10);
      } else {
        // Arbuste : plus large que haut, pas de tronc
        const sh = Math.min(28, h);
        w    = Math.round(sh * (1.4 + rnd() * 1.0));
        step = Math.round(w * 0.55 + 2 + rnd() * 10);
        trees.push({ x: tx, h: sh, w, type, trunkCol, leafDark, leafMid, leafHi });
        tx += step;
        continue;
      }

      trees.push({ x: tx, h, w, type, trunkCol, leafDark, leafMid, leafHi });
      tx += step;
    }
  }

  trees.sort((a, b) => a.x - b.x);

  // Couronnes bakées une fois dans le canvas de couche (statiques — plus de vent).
  // Avant, elles étaient redessinées CHAQUE frame (boucle sur tous les arbres ×
  // dizaines de fillRect chacun, cf. drawForetLayers) : c'était le plus gros coût
  // CPU par frame sur le thème Forêt. Les baker ici supprime entièrement ce coût.
  // Dessinées après le tri (ordre peintre gauche→droite) et au même z que les
  // troncs → trunk + couronne enfin cohérents.
  for (const tree of trees) {
    if (tree.type === "oak") {
      drawOakCanopy(ctx, tree.x, GROUND_Y, tree.h, tree.w, tree.leafDark, tree.leafMid, tree.leafHi);
    } else if (tree.type === "pine") {
      drawRectPine(ctx, tree.x, GROUND_Y, tree.h, tree.w,
        tree.leafMid, tree.leafHi,
        clutchMode ? "#030510" : "#071a0c",
        tree.trunkCol,
      );
    } else {
      drawShrubCanopy(ctx, tree.x, GROUND_Y, tree.h, tree.w, tree.leafDark, tree.leafMid, tree.leafHi);
    }
  }

  return { canvas, trees };
}

function buildForetGround(clutchMode: boolean, bg: BgTheme, seed: number): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  const rnd = makePrng(seed);

  ctx.fillStyle = clutchMode ? bg.groundColorClutch : bg.groundColor;
  ctx.fillRect(LX0, GROUND_Y, CW_L, CH_L);
  ctx.fillStyle = clutchMode ? bg.subGroundColorClutch : bg.subGroundColor;
  ctx.fillRect(LX0, GROUND_Y + 10, CW_L, CH_L);

  if (!clutchMode) {
    // Herbe dense et variée
    const GRASS = ["#22ff00", "#18ee00", "#33ff11", "#0ecc00", "#44ff22", "#11dd00"] as const;
    for (let gx = LX0; gx < RX1; gx += 2) {
      const h = 2 + Math.floor(rnd() * 7);
      ctx.fillStyle = GRASS[Math.floor(rnd() * GRASS.length)]!;
      ctx.fillRect(gx, GROUND_Y - h, 2, h);
    }

    // Touffes hautes avec brins épars
    for (let gx = LX0 + 18; gx < RX1 - 18; gx += 26 + Math.floor(rnd() * 24)) {
      const h = 10 + Math.floor(rnd() * 8);
      ctx.fillStyle = "#1a8818";
      for (let b = -2; b <= 2; b++) {
        ctx.fillRect(gx + b * 3, GROUND_Y - h - Math.abs(b) * 2, 2, h + Math.abs(b) * 2);
      }
    }

    // Racines en surface — arches noueuses qui émergent du sol
    const ROOTS = [
      { x: LX0 + 28, dir:  1 }, { x:  85, dir: -1 }, { x: 198, dir:  1 },
      { x:       312, dir: -1 }, { x: 398, dir:  1 }, { x: RX1 - 40, dir: -1 },
    ] as const;
    for (const rt of ROOTS) {
      for (let i = 0; i < 26; i++) {
        const t  = i / 25;
        const rx = Math.round(rt.x + rt.dir * i * 4.2);
        const ry = Math.round(GROUND_Y - Math.sin(t * Math.PI) * 13);
        ctx.fillStyle = (i < 3 || i > 22) ? "#5a3a1a" : "#2a1a08";
        ctx.fillRect(rx, ry - 1, 3, 3);
      }
    }

    // Pierres moussues arrondies
    const STONES = [
      { x:  50, rw: 18, rh: 11 }, { x: 148, rw: 25, rh: 15 },
      { x: 258, rw: 16, rh:  9 }, { x: 372, rw: 28, rh: 17 },
      { x: 460, rw: 14, rh:  8 },
    ] as const;
    for (const st of STONES) {
      for (let dy = 0; dy < st.rh; dy++) {
        const t  = dy / st.rh;
        const hw = Math.round(st.rw / 2 * Math.sqrt(1 - (2 * t - 1) ** 2));
        ctx.fillStyle = dy < 3 ? "#606058" : "#484840";
        ctx.fillRect(st.x - hw, GROUND_Y - st.rh + dy, hw * 2, 1);
      }
      // Mousse sur le dessus
      ctx.fillStyle = "#2a5a22";
      ctx.fillRect(st.x - Math.round(st.rw * 0.25), GROUND_Y - st.rh - 2, Math.round(st.rw * 0.52), 4);
      // Reflet
      ctx.fillStyle = "#787068";
      ctx.fillRect(st.x - Math.round(st.rw * 0.28), GROUND_Y - st.rh + 2, Math.round(st.rw * 0.26), 2);
    }
  } else {
    for (let gx = LX0; gx < RX1; gx += 4) {
      const h = 2 + (Math.abs((gx >> 2) * 13 + 7) % 5);
      ctx.fillStyle = bg.subGroundColorClutch;
      ctx.fillRect(gx, GROUND_Y - h, 2, h);
    }
  }

  ctx.fillStyle = clutchMode ? bg.mistColorClutch : bg.mistColor;
  ctx.fillRect(LX0, GROUND_Y - 8, CW_L, 16);
  ctx.fillStyle = clutchMode ? bg.mistFarColorClutch : bg.mistFarColor;
  ctx.fillRect(LX0, GROUND_Y - 16, CW_L, 12);
  return canvas;
}

// Canvas statique : arches de racines seulement.
function buildForetForeLayer(clutchMode: boolean): { canvas: OffCanvas } {
  const { canvas, ctx } = makeLayerCanvas();

  // Arches de racines : statiques, ne bougent pas avec le vent
  if (!clutchMode) {
    const ARCHES = [
      { cx: LX0 + 38,             hw: 28, maxH: 20 },
      { cx: Math.round(W * 0.56), hw: 32, maxH: 24 },
      { cx: RX1 - 44,             hw: 25, maxH: 18 },
    ] as const;
    for (const arch of ARCHES) {
      ctx.fillStyle = "#0a1a06";
      for (let dx = -arch.hw; dx <= arch.hw; dx++) {
        const t     = dx / arch.hw;
        const y     = Math.round(GROUND_Y - arch.maxH * (1 - t * t));
        const thick = Math.max(2, Math.round(3 * (1 - Math.abs(t) * 0.6)));
        ctx.fillRect(arch.cx + dx - (thick >> 1), y - (thick >> 1), thick, thick);
      }
    }
  }

  return { canvas };
}

// Position du soleil — doit coïncider avec drawCelestialBody (mode jour).
// Descendu sous l'enseigne HUD (cf. LAUNCHER_Y / HUD_H) pour rester visible.
const SUN_X = W - 42;
const SUN_Y = 54;

// Petit rebond vertical du soleil (partagé avec drawCelestialBody pour que les
// rayons restent accrochés au soleil).
function sunBob(animClock: number): number {
  return Math.sin(animClock * 1.1) * 1.5;
}

// ─── Intro bounce ─────────────────────────────────────────────────────────────
// animClock part de 0 à chaque niveau → intro jouée automatiquement.
// Chaque couche translate (sans distorsion) avec easeOutBack : overshoot ~19%,
// sol/arbres montent du bas, nuages descendent du haut, soleil pop depuis son centre.
const INTRO_MAX = 4.0;

function easeOutBack(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 2.5, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function introSpring(animClock: number, delay: number): number {
  if (animClock >= INTRO_MAX) return 1;
  return easeOutBack(Math.max(0, Math.min(1, (animClock - delay) / 1.4)));
}

// Offset Y de départ par couche 1..6 (px) : positif = depuis le bas, négatif = depuis le haut
// [nuages, collines, arbres loin, arbres milieu, sol, avant-plan]
const LAYER_INTRO_OFFSETS = [-70, 100, 125, 150, 80, 180] as const;
const LAYER_INTRO_DELAYS  = [0.80, 0.18, 0.40, 0.60, 0.04, 1.00] as const;
const SUN_INTRO_DELAY     = 0.25;

// ─── Coucher / lever de lune (transitions fever forêt) ────────────────────────
// Quand fever s'active  : soleil descend + corps céleste fever monte + ciel s'assombrit.
// Quand fever se désactive : corps céleste descend + soleil remonte + ciel s'éclaircit.
// La "lune" est le corps céleste fever existant (drawCelestialBody clutchMode=true).
const CLUTCH_BODY_Y = 92; // cy nominal du corps céleste fever (cf. drawCelestialBody)
const DUSK_DURATION = 2.8; // animClock units ≈ 1.55s réels à 60fps

// Tracker fever transition (état module, comme les caches de couches).
let _prevClutchForDusk = false;
let _clutchTransitionStart = -(DUSK_DURATION + 1); // bien avant → transition déjà terminée

function updateClutchTransition(animClock: number, clutchMode: boolean): { t: number; enteringClutch: boolean } {
  // Détecte un reset de niveau (animClock repart en arrière)
  if (animClock < _clutchTransitionStart) {
    _prevClutchForDusk = clutchMode;
    _clutchTransitionStart = animClock - DUSK_DURATION - 1;
  }
  if (clutchMode !== _prevClutchForDusk) {
    _prevClutchForDusk = clutchMode;
    _clutchTransitionStart = animClock;
  }
  const t = Math.min(1, Math.max(0, (animClock - _clutchTransitionStart) / DUSK_DURATION));
  return { t, enteringClutch: clutchMode };
}

// Lueur orangée au coucher de soleil / lever de lune. Pic à t≈0.35.
// Gradient continu haut→bas pour éviter toute ligne de séparation visible.
function drawDuskBg(ctx: CanvasRenderingContext2D, t: number): void {
  const peak = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
  if (peak < 0.008) return;
  // Vrai dégradé linéaire : aucun chevauchement de bandes → pas de ligne rouge
  // visible à chaque jointure. Alpha monte de 0.14 (haut) à 0.55 (horizon).
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  const STOPS = 8;
  for (let i = 0; i <= STOPS; i++) {
    const rt = i / STOPS; // 0 = haut du ciel, 1 = sol
    const a = peak * (0.14 + 0.41 * rt * rt);
    // Couleur : rouge-orange en haut (g=70), orange plus chaud en bas (g=40)
    const g = Math.round(70 - rt * 30);
    grad.addColorStop(rt, `rgba(255,${g},0,${a.toFixed(3)})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, GROUND_Y);
}

// Assombrissement progressif avant que le fever mode s'enclenche.
// progress 0→1 : de plein jour (aucun orange dépensé) à juste avant le seuil fever.
// Pas de mouvement du soleil — seul le ciel s'assombrit et se teinte de chaud.
function drawPreClutchDuskOverlay(ctx: CanvasRenderingContext2D, progress: number): void {
  if (progress < 0.02) return;
  const t = progress;
  const t2 = t * t; // ease-in

  // Voile de nuit qui monte doucement depuis le haut
  const darkA = t2 * 0.44;
  ctx.fillStyle = `rgba(8,3,30,${darkA.toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);

  // Lueur orangée/rouge à l'horizon — chaleur du coucher de soleil naissant.
  // Dégradé continu (et non des bandes empilées) pour éviter les traits rouges
  // visibles à chaque jointure de rectangle.
  const glowTop = GROUND_Y - 100;
  const grad = ctx.createLinearGradient(0, glowTop, 0, GROUND_Y + 10);
  const STOPS = 8;
  for (let i = 0; i <= STOPS; i++) {
    const rt = i / STOPS;
    const a = t2 * 0.30 * (1 - rt * rt);
    const g = Math.round(55 + rt * 50);
    grad.addColorStop(rt, `rgba(255,${g},15,${a.toFixed(3)})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, glowTop, W, GROUND_Y + 10 - glowTop);
}

// Voile sombre plein-écran : s'assombrit (entering=true) ou s'éclaircit (entering=false).
function drawDuskFg(ctx: CanvasRenderingContext2D, t: number, entering: boolean): void {
  const fade = entering ? easeInCubic(t) : 1 - easeOutCubic(t);
  if (fade < 0.006) return;
  ctx.fillStyle = `rgba(8,3,30,${(fade * 0.60).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
}

// Feuilles ambiantes qui dérivent doucement dans le vent — vie permanente de la forêt.
function drawAmbientLeaves(ctx: CanvasRenderingContext2D, s: GameState, clutchMode: boolean, leaves: AmbientLeaf[]): void {
  for (let i = 0; i < leaves.length; i++) {
    const lf = leaves[i]!;
    const rawY = (lf.phase / (Math.PI * 2) * (H + 50) + lf.speedY * s.animClock * 28) % (H + 60);
    const y    = Math.round(rawY) - 20;
    if (y > GROUND_Y - 28 || y < -10) continue;
    const sway = Math.sin(s.animClock * 0.52 + lf.phase * 1.4) * 38 * (Math.abs(lf.drift) / 2.8);
    const x    = Math.round((lf.x + sway + W * 5) % W);
    const twinkle = 0.22 + 0.78 * Math.abs(Math.sin(s.animClock * 0.55 + i * 0.73));

    if (clutchMode) {
      ctx.globalAlpha = twinkle * 0.11;
      ctx.fillStyle = "#7733cc";
    } else {
      ctx.globalAlpha = twinkle * 0.52;
      ctx.fillStyle = lf.col;
    }
    ctx.fillRect(x, y, lf.sz, lf.sz);

    // Petite tige sous la feuille — donne un rendu pixel-art plus lisible
    if (lf.sz > 2 && !clutchMode) {
      ctx.globalAlpha = twinkle * 0.22;
      ctx.fillStyle = "#2a7818";
      ctx.fillRect(x + 1, y + lf.sz, 1, 2);
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Cache des couches + scanlines ───────────────────────────────────────────
//
// La clé inclut le seed de la forêt : quand une nouvelle partie commence (seed
// différent), toutes les couches sont régénérées → décor jamais identique.

interface ForetCacheEntry {
  key:         string;
  layers:      ForetLayer[];
  pal:         ForetPalette;
  leaves:      AmbientLeaf[];
  fireflies:   FireflyItem[];
  midTrees:    MidTreeDef[];
}

// Cache à plusieurs entrées (clé `clutchMode:seed`). On garde simultanément la
// variante jour ET fever du seed courant → la bascule en fièvre devient un
// cache-hit au lieu de reconstruire les 7 couches dans la frame rAF (gros
// hoquet pile à l'entrée en fièvre). Les entrées d'un ancien seed sont purgées
// au changement de niveau pour borner la mémoire (et libérer les OffscreenCanvas).
const _foretCache = new Map<string, ForetCacheEntry>();
let _foretCacheSeed: number | null = null;
const _foretWarmScheduled = new Set<string>();

function buildForetEntry(clutchMode: boolean, bg: BgTheme, seed: number): ForetCacheEntry {
  const key        = `${clutchMode ? 1 : 0}:${seed}`;
  const pal        = foretPalette(clutchMode, bg);
  const leaves     = generateLeaves(seed ^ 0x1eaf7a11);
  const fireflies  = generateFireflies(seed ^ 0x10f1f111);
  const midResult  = buildForetMidLayer(clutchMode, seed ^ 0xbada55e1);
  const foreResult = buildForetForeLayer(clutchMode);
  const layers: ForetLayer[] = [
    { canvas: buildForetSky(pal, clutchMode),                      parallax: 0,    shakeF: 0.10, drift: 0, tiled: false },
    { canvas: buildForetClouds(pal, seed ^ 0x5eed1234),           parallax: 0.04, shakeF: 0.10, drift: 5, tiled: true  },
    { canvas: buildForetHills(pal, clutchMode, seed ^ 0x41116000), parallax: 0.12, shakeF: 0.20, drift: 0, tiled: false },
    { canvas: buildForetFarTrees(pal, seed),                      parallax: 0.22, shakeF: 0.30, drift: 0, tiled: false },
    { canvas: midResult.canvas,                                    parallax: 0.40, shakeF: 0.55, drift: 0, tiled: false },
    { canvas: buildForetGround(clutchMode, bg, seed ^ 0x60077a55), parallax: 0,    shakeF: 1.00, drift: 0, tiled: false },
    { canvas: foreResult.canvas,                                   parallax: 0.70, shakeF: 1.00, drift: 0, tiled: false },
  ];
  return { key, layers, pal, leaves, fireflies, midTrees: midResult.trees };
}

function disposeForetEntry(e: ForetCacheEntry): void {
  if (typeof OffscreenCanvas === "undefined") return;
  for (const L of e.layers) {
    if (L.canvas instanceof OffscreenCanvas) {
      (L.canvas as OffscreenCanvas & { close(): void }).close();
    }
  }
}

// Précharge la variante opposée (jour ↔ fever) du seed courant pendant un temps
// d'inactivité du navigateur → sort la reconstruction du chemin critique.
function scheduleWarmSibling(clutchMode: boolean, bg: BgTheme, seed: number): void {
  const sibKey = `${clutchMode ? 0 : 1}:${seed}`;
  if (_foretCache.has(sibKey) || _foretWarmScheduled.has(sibKey)) return;
  _foretWarmScheduled.add(sibKey);
  const run = () => {
    _foretWarmScheduled.delete(sibKey);
    // Le seed a pu changer entre-temps (nouveau niveau) → on n'ajoute rien.
    if (_foretCacheSeed === seed && !_foretCache.has(sibKey)) {
      _foretCache.set(sibKey, buildForetEntry(!clutchMode, bg, seed));
    }
  };
  if (typeof requestIdleCallback !== "undefined") requestIdleCallback(run, { timeout: 1500 });
  else setTimeout(run, 200);
}

function getForetLayers(clutchMode: boolean, bg: BgTheme, seed: number): ForetCacheEntry {
  // Changement de seed (nouveau niveau) → purge des couches de l'ancien seed.
  if (_foretCacheSeed !== seed) {
    for (const e of _foretCache.values()) disposeForetEntry(e);
    _foretCache.clear();
    _foretWarmScheduled.clear();
    _foretCacheSeed = seed;
  }
  const key = `${clutchMode ? 1 : 0}:${seed}`;
  let entry = _foretCache.get(key);
  if (!entry) {
    entry = buildForetEntry(clutchMode, bg, seed);
    _foretCache.set(key, entry);
  }
  // Préchauffe la variante opposée hors du chemin critique (idle).
  scheduleWarmSibling(clutchMode, bg, seed);
  return entry;
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
  ctx: CanvasRenderingContext2D, s: GameState, clutchMode: boolean, bg: BgTheme, preClutchDusk: number,
): void {
  // État de transition fever calculé avant tout — pilote le choix des couches.
  // Sur game over (lost), on force la transition terminée pour éviter les effets dusk.
  const { t: rawClutchT } = updateClutchTransition(s.animClock, clutchMode);
  const clutchT = s.phase === "lost" ? 1 : rawClutchT;
  const inDusk = clutchT < 1;

  // Pendant la transition, on garde les couches SOURCE (avant la bascule) pour
  // éviter que le ciel change instantanément dès le 1er frame de fever.
  const effectiveClutchMode = inDusk ? !clutchMode : clutchMode;
  const cache = getForetLayers(effectiveClutchMode, bg, s.forestSeed);
  const { layers, leaves, fireflies } = cache;
  const launchDelta = Math.max(-PARALLAX_CLAMP, Math.min(PARALLAX_CLAMP, s.launcherX - W / 2));

  for (let i = 0; i < layers.length; i++) {
    const L  = layers[i]!;
    const px = launchDelta * L.parallax;
    const ex = LX0 - px - s.shakeX * (1 - L.shakeF);
    const ey = -VPAD             - s.shakeY * (1 - L.shakeF);

    // Intro : translate pur (pas de scale → pas de distorsion)
    const spring = i === 0 ? 1 : introSpring(s.animClock, LAYER_INTRO_DELAYS[i - 1] ?? 0);
    const ty = i === 0 ? 0 : Math.round((1 - spring) * (LAYER_INTRO_OFFSETS[i - 1] ?? 0));

    // Soleil / lune après le ciel (i=0), avant les nuages (i=1)
    if (i === 1) {
      if (!clutchMode) {
        // ═══ MODE JOUR ═══ — soleil statique + décalage pré-fever
        const preDusk = Math.round(s.duskProgress * 180);
        ctx.save(); ctx.translate(0, preDusk);
        drawCelestialBody(ctx, s, false, "foret");
        ctx.restore();
        if (inDusk) drawDuskBg(ctx, 1 - clutchT);
      } else {
        // ═══ MODE FEVER ═══
        if (inDusk) {
          // Entrée du fever : lune monte depuis le bas
          const moonOffY = Math.round((1 - easeInOutCubic(clutchT)) * (GROUND_Y + 40 - CLUTCH_BODY_Y));
          ctx.save(); ctx.translate(0, moonOffY);
          drawCelestialBody(ctx, s, true, "foret");
          ctx.restore();
          drawDuskBg(ctx, clutchT);
        } else {
          // Fever établi : corps céleste fever au repos
          const ss = introSpring(s.animClock, SUN_INTRO_DELAY);
          ctx.save();
          ctx.translate(SUN_X, SUN_Y); ctx.scale(ss, ss); ctx.translate(-SUN_X, -SUN_Y);
          drawCelestialBody(ctx, s, true, "foret");
          ctx.restore();
        }
      }
    }

    if (L.tiled) {
      const driftPx = (s.animClock * L.drift) % CW_L;
      let start = (ex - driftPx) % CW_L;
      while (start > LX0) start -= CW_L;
      for (let x = start; x < RX1; x += CW_L) {
        ctx.drawImage(L.canvas, Math.round(x), Math.round(ey) + ty);
      }
    } else {
      ctx.drawImage(L.canvas, Math.round(ex), Math.round(ey) + ty);
    }
  }

  // Feuilles ambiantes et lucioles (forêt vivante)
  drawAmbientLeaves(ctx, s, clutchMode, leaves);
  drawFireflies(ctx, s, clutchMode, fireflies);

  // Voiles plein-écran : crépuscule/aube (transitions fever) + assombrissement pré-fever
  if (!clutchMode) {
    if (inDusk) {
      drawDuskFg(ctx, clutchT, false); // retour jour : éclaircissement
    } else if (preClutchDusk > 0.02) {
      drawPreClutchDuskOverlay(ctx, preClutchDusk);
    }
  } else if (inDusk) {
    drawDuskFg(ctx, clutchT, true); // entrée fever : assombrissement
  }

  // Scanlines CRT, fixées à l'écran (contre-translation complète du shake)
  ctx.drawImage(getScanlines(), Math.round(LX0 - s.shakeX), Math.round(-VPAD - s.shakeY));
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Point d'entrée principal ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  clutchIntensity: number,
  theme: GameTheme,
  preClutchDusk = 0,
): void {
  const clutchMode = clutchIntensity > 0.3;

  if (theme.id === "foret") {
    // Décor forêt : couches procédurales avec parallaxe (lanceur + dérive + shake)
    drawForetLayers(ctx, s, clutchMode, theme.bg, preClutchDusk);
  } else {
    // Autres thèmes : fond statique unique (blit depuis OffscreenCanvas)
    ctx.drawImage(getStaticBg(clutchMode, theme), -BG_PAD, -BG_PAD);
    switch (theme.id) {
      case "abime": drawAbimeAnimated(ctx, s, clutchMode); break;
      case "enfer": drawEnferAnimated(ctx, s, clutchMode); break;
      case "glace": drawGlaceAnimated(ctx, s, clutchMode); break;
    }
    // Assombrissement progressif pré-fever pour les thèmes non-forêt
    if (preClutchDusk > 0.02) drawPreClutchDuskOverlay(ctx, preClutchDusk);
  }

  // Corps céleste — géré dans drawForetLayers pour la forêt (passe derrière les nuages)
  if (theme.id !== "foret") drawCelestialBody(ctx, s, clutchMode, theme.id);

  // Étoiles de fièvre (commun à tous les thèmes)
  if (clutchMode) drawClutchStars(ctx, s);

  // Easter egg : oiseaux déclenchés par les impacts de pegs (clin d'œil peagle)
  if (s.birds.length > 0) drawBgBirds(ctx, s);
}
