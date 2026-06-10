import { W, H, MAX_SHAKE } from "../engine/constants";
import type { GameState } from "../engine/types";
import type { GameTheme, BgTheme, ForetDecor, ForetDecorMode } from "../engine/game-theme";
import { roundGlowRect, cornerHighlightL, chunkPlate } from "./helpers";

// Décor Forêt de secours — utilisé si bg.decor est absent (ne devrait pas
// arriver pour le thème Forêt, mais garde le renderer robuste). Valeurs neutres
// proches du jour ; le vrai décor vient de assets.ts (FORET_DECOR).
const FORET_DECOR_MODE_FALLBACK: ForetDecorMode = {
  hills:       ["#55dd66", "#22cc33", "#0ea820", "#087010"],
  forestSil:   "#008830", forestSilHi: "#00ff55",
  trees: {
    trunk:    ["#3a2a18"], leafDark: ["#0d3818"], leafMid: ["#186030"], leafHi: ["#38903c"],
    pineShadow: "#071a0c",
  },
  cloud: "rgba(255,252,250,0.82)", cloudHi: "rgba(255,255,255,1)",
  cloudShadow: "rgba(100,140,190,0.14)", cloudReflect: "rgba(160,200,235,0.18)",
};

const FORET_DECOR_FALLBACK: ForetDecor = {
  day: FORET_DECOR_MODE_FALLBACK, fever: FORET_DECOR_MODE_FALLBACK,
  grass:     ["#22ff00"], grassTuft: "#1a8818",
  stoneTop:  "#606058", stoneBody: "#484840", stoneShadow: "#2c2a26", stoneMoss: "#2a5a22",
  sunCore:   ["#ffe98a", "#ffd24a", "#ffb22e"],
  sunRay:    "#ffcc44", sunRayHot: "#ffe98a", sunHalo: "#ffd24a",
  horizonGlow: "255,220,140",
  ambientLeaves:    ["#4ab832", "#7acc44", "#aadd22", "#c4cc22", "#88bb33", "#55cc44"],
  ambientLeafFever: "#7733cc", leafStem: "#2a7818",
};

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

// ─── Champ de densité cohérent ───────────────────────────────────────────────
// Bruit 1D lisse en x ∈ [0,1] : somme de 3 sinus de fréquences/phases tirées au
// sort. Partagé par les couches (nuages, arbres, props) pour créer des CLAIRIÈRES
// et des ZONES DENSES cohérentes au lieu d'une dispersion uniforme. Deux couches
// nourries du même seed dérivé partagent donc le même relief de densité (les
// trouées de la silhouette lointaine s'alignent avec les clairières au sol, etc.).
type DensityField = (x: number) => number;

// `contrast` > 1 creuse les vallées et gonfle les pics (clairières plus franches).
function makeDensityField(seed: number, contrast = 1): DensityField {
  const rnd = makePrng(seed);
  // 3 octaves : grande houle (clairières larges) → détail (lisières dentelées).
  const oct = [
    { f: 1.2 + rnd() * 1.0,  a: 0.55, p: rnd() * Math.PI * 2 },
    { f: 2.7 + rnd() * 1.6,  a: 0.30, p: rnd() * Math.PI * 2 },
    { f: 5.5 + rnd() * 2.5,  a: 0.15, p: rnd() * Math.PI * 2 },
  ];
  return (x) => {
    // x normalisé attendu ∈ [0,1] ; un tour de phase ≈ une à deux clairières.
    let v = 0;
    for (const o of oct) v += Math.sin(x * o.f * Math.PI * 2 + o.p) * o.a;
    v = 0.5 + v * 0.5;                       // → [0,1] approx (somme des a = 1)
    v = Math.max(0, Math.min(1, v));
    return contrast === 1 ? v : Math.pow(v, contrast);
  };
}

// Normalise une coordonnée de couche x ∈ [LX0, RX1] vers [0,1] pour le champ.
function normX(x: number): number {
  return (x - LX0) / (RX1 - LX0);
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
  // Couronne (tronc inclus) pré-rendue dans son propre sprite (origine = base
  // du tronc au sol) → animée individuellement par frame (phase + rotation
  // propres). null transitoirement entre la création et le bake post-tri.
  canopy: CanopySprite | null;
  // Décalages de vent propres à l'arbre, dérivés de x → la houle traverse la
  // forêt au lieu de la faire pencher d'un bloc.
  windPhase: number;  // déphasage de la sinusoïde (rad)
  windAmp:   number;  // amplitude (px de balancement au sommet), ∝ hauteur
};

// Sprite d'une couronne, son origine (ax, ay) repérant la base du tronc dans
// le sprite → au blit on place (ax, ay) sur (treeX, GROUND_Y) et on pivote là.
type CanopySprite = { canvas: OffCanvas; ax: number; ay: number; w: number; h: number };

function generateLeaves(seed: number, leafCols: readonly string[]): AmbientLeaf[] {
  const rnd = makePrng(seed);
  return Array.from({ length: 26 }, () => ({
    x:      Math.round(rnd() * W),
    speedY: 0.14 + rnd() * 0.42,
    drift:  (rnd() - 0.5) * 3.2,
    phase:  rnd() * Math.PI * 2,
    sz:     rnd() < 0.38 ? 3 : 2,
    col:    leafCols[Math.floor(rnd() * leafCols.length)]!,
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

    // Rectangle pour chaque tier, coins arrondis 1px (encoches pixel-art) — cohérent
    // avec les pegs/œufs/feuillages : lignes haut et bas rentrées d'1px de chaque côté.
    ctx.fillStyle = leafMid;
    ctx.fillRect(tx - hw + 1, tierTopY, hw * 2 - 2, 1);                 // bord haut (rentré)
    ctx.fillRect(tx - hw,     tierTopY + 1, hw * 2, tierH - 2);         // corps
    ctx.fillRect(tx - hw + 1, tierTopY + tierH - 1, hw * 2 - 2, 1);     // bord bas (rentré)

    // Highlight haut + gauche
    ctx.fillStyle = leafHi;
    ctx.fillRect(tx - hw + 1, tierTopY, hw * 2 - 2, 2);
    ctx.fillRect(tx - hw,     tierTopY + 1, 2, Math.round(tierH * 0.50));

    // Shadow bas + droite
    ctx.fillStyle = leafShadow;
    ctx.fillRect(tx - hw + 1, tierBotY - 2, hw * 2 - 2, 3);
    ctx.fillRect(tx + hw - 2, tierTopY + 2, 2, tierH - 4);

    // Reflet en « L » au coin haut-gauche du tier — comme les pegs
    cornerHighlightL(ctx, tx - hw, tierTopY);
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
  roundGlowRect(ctx, W - 96, 46, 50);
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
  decor?: ForetDecor,
): void {
  if (clutchMode) {
    const pulse = 0.88 + 0.12 * Math.sin(s.animClock * 1.2);
    const cx = 42;  // à gauche, cohérent avec le reflet en haut-gauche
    const cy = 92 + Math.round(Math.sin(s.animClock * 0.85) * 2.5);
    ctx.fillStyle = `rgba(180,150,255,${0.12 * pulse})`;
    roundGlowRect(ctx, cx - 22, cy - 22, 44);
    ctx.fillStyle = `rgba(210,190,255,${0.22 * pulse})`;
    roundGlowRect(ctx, cx - 16, cy - 16, 32);
    ctx.fillStyle = `rgba(240,230,180,${0.95 * pulse})`;
    ctx.fillRect(cx - 10 + 1, cy - 10, 20 - 2, 20);   // cœur lune, coins arrondis 1px
    ctx.fillRect(cx - 10, cy - 10 + 1, 20, 20 - 2);
    // Reflet en « L » au coin haut-gauche — identique aux pegs
    cornerHighlightL(ctx, cx - 10, cy - 10);
    ctx.fillStyle = "rgba(180,160,100,0.4)";
    ctx.fillRect(cx - 2, cy - 2, 3, 3);
    ctx.fillRect(cx + 4, cy + 2, 2, 2);
  } else if (themeId === "foret") {
    drawJuicySun(ctx, s, decor);
  } else {
    // Soleil simple (autres thèmes en mode jour) — à GAUCHE (cohérent avec le reflet).
    // cx = centre du soleil ; cœur 16×16 aux coins arrondis 1px.
    const pulse = 0.9 + 0.1 * Math.sin(s.animClock * 0.5);
    const cx = 42, cy = 68;
    ctx.fillStyle = `rgba(255,230,100,${0.9 * pulse})`;
    ctx.fillRect(cx - 8 + 1, cy - 8, 16 - 2, 16);   // colonne centrale
    ctx.fillRect(cx - 8, cy - 8 + 1, 16, 16 - 2);   // ligne centrale
    ctx.fillStyle = `rgba(255,245,160,${0.6 * pulse})`;
    roundGlowRect(ctx, cx - 12, cy - 12, 24);
    ctx.fillStyle = `rgba(255,220,80,${0.5 * pulse})`;
    ctx.fillRect(cx, cy - 18, 2, 6);    // rayon haut
    ctx.fillRect(cx, cy + 14, 2, 6);    // rayon bas
    ctx.fillRect(cx - 16, cy - 1, 6, 2); // rayon gauche
    ctx.fillRect(cx + 14, cy - 1, 6, 2); // rayon droite
    // Reflet en « L » au coin haut-gauche (comme les pegs) — par-dessus le halo
    cornerHighlightL(ctx, cx - 8, cy - 8);
  }
}

// Soleil "juicy" (forêt) : carré dégradé + halo carré additif + rayons
// triangulaires qui tournent doucement, avec un léger rebond vertical.
function drawJuicySun(ctx: CanvasRenderingContext2D, s: GameState, decor?: ForetDecor): void {
  const d = decor ?? FORET_DECOR_FALLBACK;
  const [coreHi, coreMid, coreHot] = d.sunCore;
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
    ctx.fillStyle = d.sunHalo;
    roundGlowRect(ctx, cx - r, cy - r, r * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // Rayons cardinaux : partent des 4 bords du carré central
  const rayLen = Math.round(14 + breath * 5);
  for (let d2 = 1; d2 <= rayLen; d2++) {
    const t  = d2 / rayLen;
    const hw = Math.max(1, Math.round((1 - t * 0.85) * 4));
    ctx.globalAlpha = (1 - t * 0.72) * 0.92 * pulse;
    ctx.fillStyle = t < 0.25 ? d.sunRayHot : d.sunRay;
    ctx.fillRect(cx - hw, cy - R - d2, hw * 2, 1);   // haut
    ctx.fillRect(cx - hw, cy + R + d2, hw * 2, 1);   // bas
    ctx.fillRect(cx - R - d2, cy - hw, 1, hw * 2);   // gauche
    ctx.fillRect(cx + R + d2, cy - hw, 1, hw * 2);   // droite
  }

  // Rayons diagonaux : partent des 4 coins du carré
  const diagLen = Math.round(10 + breath * 4);
  for (let dd = 1; dd <= diagLen; dd++) {
    const t = dd / diagLen;
    ctx.globalAlpha = (1 - t * 0.85) * 0.65 * pulse;
    ctx.fillStyle = d.sunHalo;
    ctx.fillRect(cx - R - dd,     cy - R - dd,     2, 2);   // coin haut-gauche
    ctx.fillRect(cx + R + dd - 1, cy - R - dd,     2, 2);   // coin haut-droite
    ctx.fillRect(cx - R - dd,     cy + R + dd - 1, 2, 2);   // coin bas-gauche
    ctx.fillRect(cx + R + dd - 1, cy + R + dd - 1, 2, 2);   // coin bas-droite
  }
  ctx.globalAlpha = 1;

  // Cœur : carré avec dégradé vertical (clair en haut, chaud en bas).
  // Coins arrondis 1px (même langage pixel-art que les pegs/œufs) : les lignes
  // extrêmes (haut/bas) sont rentrées d'1px de chaque côté.
  for (let dy = -R; dy <= R; dy++) {
    const t = (dy + R) / (R * 2);
    ctx.fillStyle = t < 0.4 ? coreHi : t < 0.75 ? coreMid : coreHot;
    const inset = (dy === -R || dy === R) ? 1 : 0;
    ctx.fillRect(Math.round(cx - R) + inset, Math.round(cy + dy), R * 2 - inset * 2, 1);
  }

  // Reflet en « L » au coin haut-gauche — comme les pegs
  cornerHighlightL(ctx, cx - R, cy - R);
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

  // ⑨ Scanlines : rendues par l'overlay DOM global `CrtOverlay`, plus du tout
  //    côté canvas.

  return canvas;
}

function getStaticBg(clutchMode: boolean, theme: GameTheme): OffCanvas {
  const key = `${clutchMode ? 1 : 0}:${theme.id}`;
  if (_staticBgCache === null || _staticBgKey !== key) {
    // close() non-standard : appelé seulement s'il existe (cf. disposeForetEntry).
    if (typeof OffscreenCanvas !== "undefined" && _staticBgCache instanceof OffscreenCanvas) {
      const close = (_staticBgCache as OffscreenCanvas & { close?: () => void }).close;
      if (typeof close === "function") close.call(_staticBgCache);
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

// ─── Vent ─────────────────────────────────────────────────────────────────
// Le balancement est un cisaillement horizontal de la couche autour du sol :
// les cimes ondulent, les troncs restent ancrés (shear nul à GROUND_Y). Deux
// sinusoïdes déphasées + lentes donnent un souffle organique plutôt qu'un
// métronome. L'amplitude est une pente (px de décalage par px de hauteur au
// sommet), petite → quelques px de balancement en haut des arbres.
const WIND_SLOPE_BASE = 0.018;  // pente max du cisaillement (×windF de la couche)
const WIND_FREQ_A     = 0.55;   // rad/s — houle principale
const WIND_FREQ_B     = 1.30;   // rad/s — frémissement rapide superposé
// Pivot du shear en coords écran (sol de la couche, déjà décalé de VPAD au blit).
const WIND_PIVOT_Y    = GROUND_Y + VPAD;

// Pente de cisaillement instantanée pour une couche (somme de 2 sinus).
// Utilisé pour les arbres LOINTAINS (silhouette plate, balancement de bloc OK).
function windShear(clock: number, windF: number): number {
  if (windF <= 0) return 0;
  const sway =
    Math.sin(clock * WIND_FREQ_A) * 0.8 +
    Math.sin(clock * WIND_FREQ_B + 1.7) * 0.2;
  return sway * WIND_SLOPE_BASE * windF;
}

// Balancement instantané d'UNE couronne (mid layer). phase propre à l'arbre →
// la houle traverse la forêt ; un déphasage entre les 2 sinus de chaque arbre
// évite que tout reparte en phase. Renvoie un angle (rad) ∈ ~[-0.06, 0.06].
const CANOPY_SWAY_ANGLE = 0.052;  // amplitude angulaire max (rad ≈ 3°)
function canopySway(clock: number, phase: number, amp: number): number {
  const sway =
    Math.sin(clock * WIND_FREQ_A + phase) * 0.78 +
    Math.sin(clock * WIND_FREQ_B + phase * 1.7 + 1.1) * 0.22;
  return sway * CANOPY_SWAY_ANGLE * amp;
}

// Dessine chaque couronne d'arbre du milieu avec son balancement propre. Le
// sprite est ancré par sa base (canopy.ax, canopy.ay) sur (treeX, GROUND_Y) en
// coords de couche ; on pivote à cette base d'un petit angle + dérive latérale.
// (layerX, layerY) = coin haut-gauche de la couche en coords écran.
function drawMidCanopies(
  ctx: CanvasRenderingContext2D, clock: number, trees: MidTreeDef[],
  layerX: number, layerY: number,
): void {
  for (const t of trees) {
    const c = t.canopy;
    if (!c) continue;
    // Base du tronc en coords écran (mêmes maths que le blit de couche).
    const baseX = layerX + LAYER_MARGIN + t.x;
    const baseY = layerY + VPAD + GROUND_Y;
    const angle = canopySway(clock, t.windPhase, t.windAmp);
    if (angle === 0) {
      ctx.drawImage(c.canvas, Math.round(baseX - c.ax), Math.round(baseY - c.ay));
      continue;
    }
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(angle);
    // Léger glissement latéral en plus de la rotation → la cime « pousse » au
    // vent au lieu de juste pivoter (sin partagé via l'angle, mis à l'échelle).
    ctx.translate(angle * t.h * 0.6, 0);
    ctx.drawImage(c.canvas, -c.ax, -c.ay);
    ctx.restore();
  }
}

interface ForetLayer {
  canvas:   OffCanvas | null; // null = couche-marqueur sans blit (arbres mid :
                              //   dessinés par drawMidCanopies à sa position).
  parallax: number;   // 0 = fixe, 1 = suit le lanceur à fond
  shakeF:   number;   // 0 = immobile au shake, 1 = shake plein
  drift:    number;   // px/s de dérive continue (couche tilée)
  tiled:    boolean;  // true → blit répété horizontalement (nuages)
  windF:    number;   // amplitude du balancement vent (0 = immobile). Cisaille
                      //   la couche autour du sol : cimes qui ondulent, troncs ancrés.
}

interface ForetPalette {
  sky:         { top: readonly [number, number, number]; bot: readonly [number, number, number] };
  mode:        ForetDecorMode; // tokens du mode courant (jour OU fever)
  shared:      ForetDecor;     // tokens partagés (herbe, sol, soleil, horizon)
  cloud:       string; cloudHi:     string;
  forestSil:   string; forestSilHi: string;
}

function foretPalette(clutchMode: boolean, bg: BgTheme): ForetPalette {
  const shared = bg.decor ?? FORET_DECOR_FALLBACK;
  const mode   = clutchMode ? shared.fever : shared.day;
  return {
    sky:       clutchMode
      ? { top: bg.skyTopClutch, bot: bg.skyBotClutch }
      : { top: bg.skyTop,       bot: bg.skyBot },
    mode, shared,
    cloud:     mode.cloud,     cloudHi:     mode.cloudHi,
    forestSil: mode.forestSil, forestSilHi: mode.forestSilHi,
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
      ctx.fillStyle = `rgba(${pal.shared.horizonGlow},${(t * t * 0.18).toFixed(3)})`;
      ctx.fillRect(LX0, GROUND_Y - 115 + row * 10, CW_L, 12);
    }
  }
  return canvas;
}

function buildForetClouds(pal: ForetPalette, seed: number): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  const rnd = makePrng(seed);
  // Champ de densité du ciel : les nuages se groupent en bancs (zones denses) et
  // laissent des trouées de ciel clair, au lieu d'un étalement régulier.
  const density = makeDensityField(seed ^ 0xc10d5b1f, 1.2);
  const count = 4 + Math.floor(rnd() * 4); // 4–7 nuages candidats par run
  for (let i = 0; i < count; i++) {
    // Position tirée puis biaisée vers les zones denses du champ : on échantillonne
    // 2 x candidats et on garde le plus dense → bancs naturels.
    let cx = LX0 + 40 + rnd() * (CW_L - 80);
    const alt = LX0 + 40 + rnd() * (CW_L - 80);
    if (density(normX(alt)) > density(normX(cx))) cx = alt;
    // Trouée franche : si on tombe dans une zone très claire, on saute ce nuage.
    if (density(normX(cx)) < 0.28 && rnd() > 0.35) continue;
    const cy    = 60 + rnd() * 90;
    const puffs = 4 + Math.floor(rnd() * 4);
    const baseW = 32 + rnd() * 42;

    // Ombre bleue décalée derrière
    for (let p = 0; p < puffs; p++) {
      const pw = Math.round(baseW * (0.5 + rnd() * 0.7));
      const ph = Math.max(5, Math.round(pw * 0.44));
      const ox = Math.round((p - puffs / 2) * baseW * 0.46 + (rnd() - 0.5) * 8);
      const oy = Math.round((rnd() - 0.5) * 6);
      ctx.fillStyle = pal.mode.cloudShadow;
      roundGlowRect(ctx, Math.round(cx + ox - pw / 2) + 2, Math.round(cy + oy - ph / 2) + 4, pw, ph);
    }
    // Corps du nuage
    for (let p = 0; p < puffs; p++) {
      const pw = Math.round(baseW * (0.5 + rnd() * 0.7));
      const ph = Math.max(5, Math.round(pw * 0.44));
      const ox = Math.round((p - puffs / 2) * baseW * 0.46 + (rnd() - 0.5) * 8);
      const oy = Math.round((rnd() - 0.5) * 6);
      ctx.fillStyle = pal.cloud;
      roundGlowRect(ctx, Math.round(cx + ox - pw / 2), Math.round(cy + oy - ph / 2), pw, ph);
    }
    // Ligne blanche sur le dessus
    ctx.fillStyle = pal.cloudHi;
    ctx.fillRect(Math.round(cx - baseW * 0.72), Math.round(cy - 7), Math.round(baseW * 1.46), 2);
    // Reflet bleuté sur le bas
    ctx.fillStyle = pal.mode.cloudReflect;
    ctx.fillRect(Math.round(cx - baseW * 0.58), Math.round(cy + 6), Math.round(baseW * 1.18), 3);
  }
  return canvas;
}

// Une couche de collines = somme de plusieurs sinus (octaves) aux fréquences,
// amplitudes et phases tirées au sort → silhouette réellement différente par run.
interface HillLayer {
  baseY: number;
  octaves: { freq: number; amp: number; phase: number }[];
  color: string;
}

function fillHills(ctx: Ctx2D, layer: HillLayer): void {
  ctx.fillStyle = layer.color;
  for (let x = LX0; x < RX1; x++) {
    let y = layer.baseY;
    for (const o of layer.octaves) y += Math.sin(x * o.freq + o.phase) * o.amp;
    const yi = Math.round(y);
    ctx.fillRect(x, yi, 1, H + VPAD - yi);
  }
}

// Génère une couche de collines aléatoire : hauteur de base, fréquence de base
// et amplitude varient par seed, plus 2 octaves harmoniques pour des bosses
// irrégulières (pas juste une vague régulière).
function genHillLayer(
  rnd: () => number, baseYMin: number, baseYMax: number,
  ampMin: number, ampMax: number, freqMin: number, freqMax: number,
  color: string,
): HillLayer {
  const baseY = GROUND_Y - (baseYMin + rnd() * (baseYMax - baseYMin));
  const amp   = ampMin + rnd() * (ampMax - ampMin);
  const freq  = freqMin + rnd() * (freqMax - freqMin);
  return {
    baseY,
    color,
    octaves: [
      { freq,                                amp,            phase: rnd() * Math.PI * 2 },
      { freq: freq * (2.0 + rnd() * 0.8),    amp: amp * 0.32, phase: rnd() * Math.PI * 2 },
      { freq: freq * (4.0 + rnd() * 1.5),    amp: amp * 0.16, phase: rnd() * Math.PI * 2 },
    ],
  };
}

function buildForetHills(pal: ForetPalette, seed: number): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  const rnd = makePrng(seed);
  const [h0, h1, h2, h3] = pal.mode.hills;
  // Lointain (haut, doux) → proche (bas, plus marqué). Chaque couche tire ses
  // propres baseY/amp/freq dans une plage → relief différent à chaque partie.
  fillHills(ctx, genHillLayer(rnd, 130, 175, 20, 38, 0.0040, 0.0080, h0));
  fillHills(ctx, genHillLayer(rnd,  95, 128, 16, 32, 0.0065, 0.0115, h1));
  fillHills(ctx, genHillLayer(rnd,  60,  88, 12, 26, 0.0095, 0.0165, h2));
  fillHills(ctx, genHillLayer(rnd,  32,  56,  8, 18, 0.0140, 0.0230, h3));
  return canvas;
}

function buildForetFarTrees(pal: ForetPalette, seed: number): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();

  // Blocs rectangulaires qui forment la silhouette de la canopée.
  // Les blocs se superposent : on calcule la hauteur max par colonne →
  // silhouette continue avec des "dents" rectangulaires bien visibles.
  interface Block { x: number; w: number; h: number }

  // Champ de densité de la silhouette lointaine : creuse des baisses (trouées
  // dans la crête) et des massifs hauts. contrast 1.3 → vallées nettes.
  const density = makeDensityField(seed ^ 0xfa27ee5e, 1.3);

  function genBlocks(bSeed: number, hMin: number, hMax: number, minW: number, maxW: number): Block[] {
    const pr = makePrng(bSeed);
    const blocks: Block[] = [];
    let x = LX0;
    while (x < RX1) {
      const w = minW + Math.floor(pr() * (maxW - minW));
      // Densité au centre du bloc → hauteur modulée : clairière = crête basse,
      // massif = pics hauts. Plage 0.45..1 pour garder une ligne d'arbres lisible.
      const dens = density(normX(x + w / 2));
      const hRaw = hMin + pr() * (hMax - hMin);
      const h    = Math.round(hRaw * (0.45 + dens * 0.55));
      blocks.push({ x, w, h });
      // Trouées plus larges dans les clairières (espace entre massifs).
      x += w + 1 + Math.floor(pr() * 8) + Math.round((1 - dens) * 14);
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

  // Reflet en « L » au coin haut-gauche — comme les pegs
  cornerHighlightL(ctx, tx - hw, topY);

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

  // Reflet en « L » au coin haut-gauche — comme les pegs
  cornerHighlightL(ctx, tx - hw, topY);

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
// Bake une couronne dans son propre sprite. Le dessinateur travaille en coords
// absolues autour de (cx, baseY) ; on lui donne une origine locale telle que la
// couronne tienne dans le sprite, avec une marge latérale pour la rotation au
// vent (le sommet se déplace de ~sin(angle)·hauteur). ax/ay repèrent la base du
// tronc → point d'ancrage ET pivot au blit.
function bakeCanopySprite(
  draw: (ctx: Ctx2D, cx: number, baseY: number) => void,
  w: number, h: number,
): CanopySprite {
  const sidePad = Math.max(8, Math.round(h * 0.18)); // marge pour rotation + débords
  const topPad  = 8;                                  // bosses qui dépassent en haut (≤7px)
  const sw = w + sidePad * 2;
  const sh = h + topPad + 2;
  const ax = sw >> 1;       // base du tronc : centrée en x
  const ay = sh;            // base du tronc : tout en bas du sprite
  const canvas = makeOffscreen(sw, sh);
  const ctx = canvas.getContext("2d") as Ctx2D;
  draw(ctx, ax, ay);        // (cx, baseY) → (ax, ay)
  return { canvas, ax, ay, w: sw, h: sh };
}

// créant des clairières naturelles et des zones denses. Troncs baked dans le
// canvas statique ; couronnes animées par frame (vent).
// La couche n'a plus de canvas propre : troncs ET couronnes vivent désormais
// dans les sprites par-arbre (animés). On ne renvoie donc que les arbres ; le
// blit de la couche mid est remplacé par drawMidCanopies.
function buildForetMidLayer(pal: ForetPalette, seed: number): { trees: MidTreeDef[] } {
  const rnd = makePrng(seed);

  const ramp = pal.mode.trees;
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]!;

  // Champ de densité : creuse des clairières (peu/pas d'arbres) et des bosquets
  // denses. contrast 1.5 → vallées plus franches (vraies trouées). Le seed dérive
  // de celui de la couche → relief stable pour cette partie, différent à chaque.
  const density = makeDensityField(seed ^ 0xc1ea217e, 1.5);

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
      // Densité locale [0,1] : pilote l'espacement et les trouées.
      const dens = density(normX(tx));

      const rawH = 50 + Math.floor(rnd() * 70);
      // Les arbres des zones denses sont un poil plus hauts (canopée touffue) ;
      // ceux des clairières plus bas/épars.
      const h    = Math.max(28, Math.min(140, Math.round(rawH * cluster.hScale * (0.78 + dens * 0.34))));

      const type: "oak" | "pine" | "shrub" =
        cluster.kind === "oak"  ? (rnd() < 0.80 ? "oak"   : "shrub") :
        cluster.kind === "pine" ? (rnd() < 0.80 ? "pine"  : "oak"  ) :
        (rnd() < 0.42 ? "oak"  : rnd() < 0.68 ? "pine" : "shrub");

      const trunkCol = pick(ramp.trunk);
      const leafDark = pick(ramp.leafDark);
      const leafMid  = pick(ramp.leafMid);
      const leafHi   = pick(ramp.leafHi);

      let w: number;
      let step: number;
      let effH = h;

      if (type === "oak") {
        w = Math.round(h * (0.62 + rnd() * 0.52));
        step = Math.round(w * (0.42 + rnd() * 0.30) + 4 + rnd() * 14);
      } else if (type === "pine") {
        w = Math.round(h * (0.26 + rnd() * 0.22));
        step = Math.round(w * (0.55 + rnd() * 0.35) + 3 + rnd() * 10);
      } else {
        // Arbuste : plus large que haut, pas de tronc
        effH = Math.min(28, h);
        w    = Math.round(effH * (1.4 + rnd() * 1.0));
        step = Math.round(w * 0.55 + 2 + rnd() * 10);
      }

      // Clairière : en zone peu dense, on saute l'arbre et on avance d'un grand
      // pas → vraie trouée. Sinon l'espacement se resserre avec la densité.
      if (dens < 0.32 && rnd() > dens * 2.4) {
        tx += step + Math.round((0.4 - dens) * 120);
        continue;
      }
      step = Math.round(step * (1.35 - dens * 0.5)); // dense → arbres serrés

      trees.push({
        x: tx, h: effH, w, type, trunkCol, leafDark, leafMid, leafHi,
        canopy: null,             // baké après le tri
        windPhase: 0, windAmp: 0, // calculés après le tri
      });
      tx += step;
    }
  }

  trees.sort((a, b) => a.x - b.x);

  // Couronne (tronc inclus pour oak/pine) bakée dans le sprite propre de chaque
  // arbre, puis animée par frame (cf. drawMidCanopies) : pivot à la base du
  // tronc → couronne qui ondule, tronc quasi fixe. Coût/frame = un drawImage +
  // transform par arbre (sprites pré-rendus, aucune rastérisation par frame —
  // bien moins cher que l'ancien dessin pixel par pixel).
  for (const tree of trees) {
    if (tree.type === "oak") {
      tree.canopy = bakeCanopySprite(
        (c, cx, baseY) => {
          // Tronc d'abord (sous la couronne)
          const tw     = Math.max(2, Math.round(tree.h * 0.055));
          const trunkH = Math.round(tree.h * 0.36);
          c.fillStyle = tree.trunkCol;
          c.fillRect(cx - (tw >> 1), baseY - trunkH, tw, trunkH);
          drawOakCanopy(c, cx, baseY, tree.h, tree.w, tree.leafDark, tree.leafMid, tree.leafHi);
        },
        tree.w, tree.h,
      );
    } else if (tree.type === "pine") {
      tree.canopy = bakeCanopySprite(
        (c, cx, baseY) => drawRectPine(c, cx, baseY, tree.h, tree.w,
          tree.leafMid, tree.leafHi, ramp.pineShadow, tree.trunkCol),
        tree.w, tree.h,
      );
    } else {
      tree.canopy = bakeCanopySprite(
        (c, cx, baseY) => drawShrubCanopy(c, cx, baseY, tree.h, tree.w, tree.leafDark, tree.leafMid, tree.leafHi),
        tree.w, tree.h,
      );
    }

    // Vent propre à l'arbre : phase ∝ x (la houle traverse la forêt), amplitude
    // ∝ hauteur (les grands arbres ondulent plus, les arbustes à peine).
    tree.windPhase = tree.x * 0.013;
    tree.windAmp   = (tree.type === "shrub" ? 0.10 : 0.45) * Math.max(0.3, tree.h / 100);
  }

  return { trees };
}

// ─── Props de sol (cailloux, racines, touffes) ──────────────────────────────
// Tout le sous-bois est dispersé procéduralement (seedé) par un seul scatter :
// densité, taille, forme et espacement variés, parfois en bouquets. Chaque prop
// porte un flag `behind` → rendu au plan des arbres (parallaxe mid, avant les
// troncs) pour dépasser de derrière ; sinon au sol (avant-plan). Fini les
// listes de positions codées en dur (qui se répétaient à l'identique).

type GroundProp =
  | { kind: "stone"; x: number; behind: boolean; rw: number; rh: number }
  | { kind: "tuft";  x: number; behind: boolean; h: number; blades: number; col: number };

// Scatter unique : marche irrégulière gauche→droite, à chaque pas on tire un
// type de prop (pondéré) et on l'ajoute, parfois en petit bouquet. L'espacement
// dépend du type (l'herbe est plus dense, les souches plus rares).
function generateGroundProps(seed: number, grassN: number): GroundProp[] {
  const rnd = makePrng(seed);
  const props: GroundProp[] = [];
  // ~30 % de tout ce sous-bois passe derrière la ligne d'arbres.
  const behind = () => rnd() < 0.30;
  // Champ de densité du sous-bois : sous-bois touffu (gros trous comblés, herbe
  // privilégiée) vs clairières nues. contrast 1.4 → clairières franches.
  const density = makeDensityField(seed ^ 0x9b0773de, 1.4);
  // Trou avant le prochain prop, resserré en zone dense (sous-bois) et élargi en
  // clairière (sol nu) — facteur ×0.4..×1.8.
  const gap = (base: number) => Math.round(base * (1.8 - density(normX(x)) * 1.4));

  let x = LX0 + 12 + Math.floor(rnd() * 30);
  while (x < RX1 - 12) {
    const dens = density(normX(x));
    // En zone dense on penche vers l'herbe (sous-bois), en clairière vers le sol
    // nu (cailloux épars). On décale le seuil de tirage avec la densité.
    const roll = rnd();
    const stoneCut = 0.16 - dens * 0.06;        // moins de cailloux en sous-bois
    if (roll < stoneCut) {
      // ── Caillou (parfois en grappe qui se chevauche) ──
      const clusterN = rnd() < 0.30 ? 2 + Math.floor(rnd() * 2) : 1;
      const b = behind();
      for (let i = 0; i < clusterN && x < RX1 - 12; i++) {
        const rw = 12 + Math.floor(rnd() * 18);
        const rh = Math.round(rw * (0.5 + rnd() * 0.18));
        props.push({ kind: "stone", x: Math.round(x), behind: b, rw, rh });
        x += rw * (0.55 + rnd() * 0.5) + 4;
      }
      x += gap(22 + Math.floor(rnd() * 70));
    } else {
      // ── Touffe d'herbe haute (bouquet plus fourni en zone dense) ──
      const clusterMax = 1 + Math.round(dens * 3);
      const clusterN = rnd() < 0.35 + dens * 0.3 ? 2 + Math.floor(rnd() * clusterMax) : 1;
      const b = behind();
      for (let i = 0; i < clusterN && x < RX1 - 12; i++) {
        props.push({
          kind: "tuft", x: Math.round(x), behind: b,
          h: 9 + Math.floor(rnd() * 11),
          blades: 3 + Math.floor(rnd() * 3),
          col: Math.floor(rnd() * grassN),
        });
        x += 6 + Math.floor(rnd() * 10);
      }
      x += gap(12 + Math.floor(rnd() * 38));
    }
  }
  return props;
}

function drawStoneProp(ctx: Ctx2D, p: Extract<GroundProp, { kind: "stone" }>, baseY: number, d: ForetDecor): void {
  const x = Math.round(p.x - p.rw / 2);
  const y = baseY - p.rh;
  chunkPlate(ctx, x, y, p.rw, p.rh, {
    fill: d.stoneBody, light: d.stoneTop, dark: d.stoneShadow, outline: d.stoneShadow,
  });
  // Mousse sur le dessus — touche forêt, posée par-dessus le bevel haut.
  ctx.fillStyle = d.stoneMoss;
  ctx.fillRect(p.x - Math.round(p.rw * 0.25), y - 2, Math.round(p.rw * 0.52), 4);
}

function drawTuftProp(ctx: Ctx2D, p: Extract<GroundProp, { kind: "tuft" }>, baseY: number, d: ForetDecor): void {
  // Brins en éventail : le central le plus haut, les latéraux décroissent.
  ctx.fillStyle = d.grass[p.col % d.grass.length] ?? d.grassTuft;
  const half = p.blades >> 1;
  for (let b = -half; b <= half; b++) {
    const bh = p.h - Math.abs(b) * 2;
    if (bh <= 0) continue;
    ctx.fillRect(p.x + b * 3, baseY - bh, 2, bh);
  }
}

function drawGroundProp(ctx: Ctx2D, p: GroundProp, baseY: number, d: ForetDecor): void {
  if (p.kind === "stone") drawStoneProp(ctx, p, baseY, d);
  else drawTuftProp(ctx, p, baseY, d);
}

// Bake les props `behind` dans un sprite de couche (plan des arbres mid).
// Blitté avant les troncs/couronnes dans la passe mid → ils dépassent de
// derrière les arbres. Renvoie null si aucun prop en fond (rien à blitter).
function buildForetBackProps(pal: ForetPalette, props: GroundProp[]): OffCanvas | null {
  if (!props.some((p) => p.behind)) return null;
  const { canvas, ctx } = makeLayerCanvas();
  for (const p of props) if (p.behind) drawGroundProp(ctx, p, GROUND_Y, pal.shared);
  return canvas;
}

function buildForetGround(
  clutchMode: boolean, bg: BgTheme, pal: ForetPalette, seed: number, props: GroundProp[],
): OffCanvas {
  const { canvas, ctx } = makeLayerCanvas();
  const rnd = makePrng(seed);
  const d = pal.shared;

  ctx.fillStyle = clutchMode ? bg.groundColorClutch : bg.groundColor;
  ctx.fillRect(LX0, GROUND_Y, CW_L, CH_L);
  ctx.fillStyle = clutchMode ? bg.subGroundColorClutch : bg.subGroundColor;
  ctx.fillRect(LX0, GROUND_Y + 10, CW_L, CH_L);

  if (!clutchMode) {
    // Tapis d'herbe dense par pixel (base) — sous tous les props.
    for (let gx = LX0; gx < RX1; gx += 2) {
      const h = 2 + Math.floor(rnd() * 7);
      ctx.fillStyle = d.grass[Math.floor(rnd() * d.grass.length)]!;
      ctx.fillRect(gx, GROUND_Y - h, 2, h);
    }
    // Props d'avant-plan (les `behind` sont rendus au plan des arbres, cf.
    // buildForetBackProps). Cailloux à la DA chunky, racines, touffes.
    for (const p of props) if (!p.behind) drawGroundProp(ctx, p, GROUND_Y, d);
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

// Position du soleil — doit coïncider avec drawCelestialBody (mode jour).
// Descendu sous l'enseigne HUD (cf. LAUNCHER_Y / HUD_H) pour rester visible.
// Placé à GAUCHE : le reflet pixel des astres est en haut-gauche, donc la source de
// lumière vient de la gauche → soleil/lune logiquement de ce côté.
const SUN_X = 42;
const SUN_Y = 72;

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

// Voile sombre plein-écran : s'assombrit (entering=true) ou s'éclaircit (entering=false).
function drawDuskFg(ctx: CanvasRenderingContext2D, t: number, entering: boolean): void {
  const fade = entering ? easeInCubic(t) : 1 - easeOutCubic(t);
  if (fade < 0.006) return;
  ctx.fillStyle = `rgba(8,3,30,${(fade * 0.60).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
}

// Feuilles ambiantes qui dérivent doucement dans le vent — vie permanente de la forêt.
function drawAmbientLeaves(
  ctx: CanvasRenderingContext2D, s: GameState, clutchMode: boolean,
  leaves: AmbientLeaf[], decor: ForetDecor,
): void {
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
      ctx.fillStyle = decor.ambientLeafFever;
    } else {
      ctx.globalAlpha = twinkle * 0.52;
      ctx.fillStyle = lf.col;
    }
    ctx.fillRect(x, y, lf.sz, lf.sz);

    // Petite tige sous la feuille — donne un rendu pixel-art plus lisible
    if (lf.sz > 2 && !clutchMode) {
      ctx.globalAlpha = twinkle * 0.22;
      ctx.fillStyle = decor.leafStem;
      ctx.fillRect(x + 1, y + lf.sz, 1, 2);
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Cache des couches ───────────────────────────────────────────────────────
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
  backProps:   OffCanvas | null; // props (cailloux/racines/touffes) derrière les arbres (plan mid), ou null
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
  const leaves     = generateLeaves(seed ^ 0x1eaf7a11, pal.shared.ambientLeaves);
  const fireflies  = generateFireflies(seed ^ 0x10f1f111);
  const midResult  = buildForetMidLayer(pal, seed ^ 0xbada55e1);
  const props      = generateGroundProps(seed ^ 0x57011e99, pal.shared.grass.length);
  const backProps  = buildForetBackProps(pal, props);
  const layers: ForetLayer[] = [
    { canvas: buildForetSky(pal, clutchMode),                      parallax: 0,    shakeF: 0.10, drift: 0, tiled: false, windF: 0    },
    { canvas: buildForetClouds(pal, seed ^ 0x5eed1234),           parallax: 0.04, shakeF: 0.10, drift: 5, tiled: true,  windF: 0    },
    { canvas: buildForetHills(pal, seed ^ 0x41116000),            parallax: 0.12, shakeF: 0.20, drift: 0, tiled: false, windF: 0    },
    { canvas: buildForetFarTrees(pal, seed),                      parallax: 0.22, shakeF: 0.30, drift: 0, tiled: false, windF: 0.6  },
    // Couche-marqueur mid : drawMidCanopies y blitte les props de fond puis les
    // troncs/couronnes (cailloux/racines/touffes qui dépassent de derrière).
    { canvas: null,             /* arbres mid → drawMidCanopies */ parallax: 0.40, shakeF: 0.55, drift: 0, tiled: false, windF: 0    },
    { canvas: buildForetGround(clutchMode, bg, pal, seed ^ 0x60077a55, props), parallax: 0, shakeF: 1.00, drift: 0, tiled: false, windF: 0 },
  ];
  return { key, layers, pal, leaves, fireflies, midTrees: midResult.trees, backProps };
}

function closeOffscreen(c: OffCanvas): void {
  // OffscreenCanvas.close() est une API non-standard absente des navigateurs
  // récents — on l'appelle seulement si elle existe. Sinon le GC libère le
  // canvas dès que le cache est vidé.
  if (c instanceof OffscreenCanvas) {
    const close = (c as OffscreenCanvas & { close?: () => void }).close;
    if (typeof close === "function") close.call(c);
  }
}

function disposeForetEntry(e: ForetCacheEntry): void {
  if (typeof OffscreenCanvas === "undefined") return;
  for (const L of e.layers) if (L.canvas) closeOffscreen(L.canvas);
  // Sprites de couronnes (un par arbre du milieu).
  for (const t of e.midTrees) if (t.canopy) closeOffscreen(t.canopy.canvas);
  if (e.backProps) closeOffscreen(e.backProps);
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


// ─── Composition de la forêt (par frame) ─────────────────────────────────────

function drawForetLayers(
  ctx: CanvasRenderingContext2D, s: GameState, clutchMode: boolean, bg: BgTheme,
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
        // ═══ MODE JOUR ═══ — soleil statique + descente progressive pré-fever
        const preDusk = Math.round(s.duskProgress * 180);
        ctx.save(); ctx.translate(0, preDusk);
        drawCelestialBody(ctx, s, false, "foret", bg.decor);
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

    if (L.canvas === null) {
      // Couche-marqueur (arbres du milieu), parallaxe/shake partagés. D'abord
      // les props de fond (derrière les troncs), puis les couronnes animées
      // (chacune ondule, pivot à sa base).
      if (cache.backProps) {
        ctx.drawImage(cache.backProps, Math.round(ex), Math.round(ey) + ty);
      }
      drawMidCanopies(ctx, s.animClock, cache.midTrees, Math.round(ex), Math.round(ey) + ty);
    } else if (L.tiled) {
      const driftPx = (s.animClock * L.drift) % CW_L;
      let start = (ex - driftPx) % CW_L;
      while (start > LX0) start -= CW_L;
      for (let x = start; x < RX1; x += CW_L) {
        ctx.drawImage(L.canvas, Math.round(x), Math.round(ey) + ty);
      }
    } else {
      const shear = windShear(s.animClock, L.windF);
      if (shear !== 0) {
        // Cisaillement horizontal pivoté au sol : x' = x + shear·(groundY − y).
        // Les cimes (y petit) se décalent, les troncs (y ≈ groundY) restent fixes.
        const groundScreenY = Math.round(ey) + ty + WIND_PIVOT_Y;
        ctx.save();
        ctx.transform(1, 0, -shear, 1, shear * groundScreenY, 0);
        ctx.drawImage(L.canvas, Math.round(ex), Math.round(ey) + ty);
        ctx.restore();
      } else {
        ctx.drawImage(L.canvas, Math.round(ex), Math.round(ey) + ty);
      }
    }
  }

  // Feuilles ambiantes et lucioles (forêt vivante)
  drawAmbientLeaves(ctx, s, clutchMode, leaves, bg.decor ?? FORET_DECOR_FALLBACK);
  drawFireflies(ctx, s, clutchMode, fireflies);

  // Voiles plein-écran : crépuscule/aube (transitions fever)
  if (!clutchMode) {
    if (inDusk) drawDuskFg(ctx, clutchT, false); // retour jour : éclaircissement
  } else if (inDusk) {
    drawDuskFg(ctx, clutchT, true); // entrée fever : assombrissement
  }

}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Point d'entrée principal ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  clutchIntensity: number,
  theme: GameTheme,
): void {
  const clutchMode = clutchIntensity > 0.3;

  if (theme.id === "foret") {
    // Décor forêt : couches procédurales avec parallaxe (lanceur + dérive + shake)
    drawForetLayers(ctx, s, clutchMode, theme.bg);
  } else {
    // Autres thèmes : fond statique unique (blit depuis OffscreenCanvas)
    ctx.drawImage(getStaticBg(clutchMode, theme), -BG_PAD, -BG_PAD);
    switch (theme.id) {
      case "abime": drawAbimeAnimated(ctx, s, clutchMode); break;
      case "enfer": drawEnferAnimated(ctx, s, clutchMode); break;
      case "glace": drawGlaceAnimated(ctx, s, clutchMode); break;
    }
  }

  // Corps céleste — géré dans drawForetLayers pour la forêt (passe derrière les nuages)
  if (theme.id !== "foret") drawCelestialBody(ctx, s, clutchMode, theme.id);

  // Étoiles de fièvre (commun à tous les thèmes)
  if (clutchMode) drawClutchStars(ctx, s);

  // Easter egg : oiseaux déclenchés par les impacts de pegs (clin d'œil peagle)
  if (s.birds.length > 0) drawBgBirds(ctx, s);

  // Note : les scanlines CRT ne sont plus bakées ici — elles sont rendues par
  // l'overlay DOM global `CrtOverlay`, par-dessus le canvas ET les menus React.
}
