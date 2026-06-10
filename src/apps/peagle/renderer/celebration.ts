import { W, H } from "../engine/constants";
import type { GameState } from "../engine/types";

// ─── PRNG ─────────────────────────────────────────────────────────────────────

function prng(seed: number): () => number {
  let s = ((seed ^ 0xc0ffee42) + 1) >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ─── HSL → rgb() string (integer fast path) ──────────────────────────────────

function hsl(h: number, sat: number, lig: number): string {
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) {        g = c; b = x; }
  else if (h < 240) {        g = x; b = c; }
  else if (h < 300) { r = x;        b = c; }
  else              { r = c;        b = x; }
  return `rgb(${((r + m) * 255) | 0},${((g + m) * 255) | 0},${((b + m) * 255) | 0})`;
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#ff2244", "#ff7700", "#ffdd00", "#22ee44", "#00aaff",
  "#cc44ff", "#ff44bb", "#00ffbb", "#ffcc00", "#44ddff",
  "#ff4400", "#88ff00", "#ff0088", "#00ffee", "#ffaa22",
] as const;

interface ConfettiPiece {
  x0:        number;
  fallSpeed: number;
  driftAmp:  number;
  driftFreq: number;
  phase:     number;
  colorIdx:  number;
  sz:        number;
  wide:      boolean;
  delay:     number;
}

let _confCached: ConfettiPiece[] | null = null;
let _confSeed = -1;

function getConfetti(seed: number): ConfettiPiece[] {
  if (_confSeed === seed && _confCached) return _confCached;
  const rnd = prng(seed);
  _confCached = Array.from({ length: 100 }, () => ({
    x0:        Math.round(rnd() * (W + 80)) - 40,
    fallSpeed: 28 + rnd() * 58,
    driftAmp:  5 + rnd() * 26,
    driftFreq: 0.8 + rnd() * 2.6,
    phase:     rnd() * Math.PI * 2,
    colorIdx:  Math.floor(rnd() * CONFETTI_COLORS.length),
    sz:        rnd() < 0.38 ? 3 : 2,
    wide:      rnd() < 0.45,
    delay:     rnd() * 1.4,
  }));
  _confSeed = seed;
  return _confCached;
}

function drawConfetti(ctx: CanvasRenderingContext2D, wonAge: number, seed: number): void {
  const confetti = getConfetti(seed);
  for (const c of confetti) {
    const age = wonAge - c.delay;
    if (age <= 0) continue;
    const rawY = (c.phase / (Math.PI * 2)) * (H + 60) + age * c.fallSpeed;
    const y = Math.round(rawY % (H + 60)) - 20;
    if (y > H + 15) continue;
    const rawX = c.x0 + Math.sin(age * c.driftFreq + c.phase) * c.driftAmp;
    const x = Math.round(((rawX % W) + W) % W);
    ctx.fillStyle = CONFETTI_COLORS[c.colorIdx]!;
    if (c.wide) {
      ctx.fillRect(x - 3, y, 6, c.sz - 1);
    } else {
      ctx.fillRect(x, y, c.sz, c.sz);
    }
  }
}

// ─── Pluie de plumes d'aigle ──────────────────────────────────────────────────
//
// Remplace les feux d'artifice : des plumes qui tournoient en tombant, en
// tonalités aigle (doré / crème / brun). Deux couches :
//   • un voile de plumes ambiant qui descend en continu (comme le confetti) ;
//   • des « bouffées » synchronisées sur les mêmes trig times que les sons
//     (CELEBRATION_BURST_TRIGS) : à chaque salve, un paquet de plumes est
//     relâché depuis le haut, calé sur le « pop » audio joué par useGameLoop.

// Les trigger times correspondent aux sons joués depuis useGameLoop.
export const CELEBRATION_BURST_TRIGS = [0.55, 1.15, 1.80, 2.50, 3.20, 4.00, 4.80] as const;

// Teintes plume : doré chaud, crème/blanc, brun aigle.
const FEATHER_COLORS = [
  "#ffd24a", // or principal
  "#ffe870", // or clair
  "#f2e6c2", // crème
  "#ffffff", // blanc reflet
  "#c79a52", // brun doré
  "#8a5a2b", // brun aigle
] as const;

// Dessine une plume pixel-art à (x,y), inclinée de `rot` rad, échelle `sz`.
// Silhouette lisible : large près de la base, effilée vers une POINTE asymétrique,
// légèrement COURBÉE (banane), avec un rachis clair fendant les deux nappes de
// barbes — c'est cette asymétrie + la courbe + la fente qui font lire « plume »
// plutôt qu'un grain ovale.
function drawFeather(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rot: number, sz: number,
  color: string, alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.imageSmoothingEnabled = false;

  const len   = Math.max(8, Math.round(13 * sz)); // plus longue → silhouette claire
  const maxW  = Math.max(2, Math.round(3.2 * sz)); // largeur max (vers le 1/3 bas)
  const curve = 1.6 * sz;                          // amplitude de la courbure
  const half  = len / 2;

  // Profil de largeur asymétrique : le ventre est dans le tiers inférieur (t≈0.3)
  // puis décroît jusqu'à 0 à la pointe (t=1) → vraie pointe, pas un ovale.
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);                    // 0 (base) → 1 (pointe)
    // enfle vite puis s'affine : pow asymétrique
    const shape = Math.pow(t, 0.55) * Math.pow(1 - t, 0.85) * 2.1;
    const w = Math.round(maxW * shape);
    if (w <= 0) continue;

    // Courbure : le rachis dérive latéralement le long de la longueur (banane).
    const spine = Math.round(Math.sin(t * Math.PI) * curve);
    const yy = i - half;

    // Nappe de barbes (la moitié "soleil" un peu plus claire pour le volume).
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(spine - w, yy, w * 2 + 1, 1);

    // Fente centrale : 1px transparent simulé par le rachis clair posé par-dessus.
  }

  // Rachis clair (tige) qui fend la plume — suit la même courbe.
  for (let i = 1; i < len - 1; i++) {
    const t = i / (len - 1);
    const spine = Math.round(Math.sin(t * Math.PI) * curve);
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(spine, i - half, 1, 1);
  }

  ctx.restore();
}

interface Feather {
  x0:        number;
  fallSpeed: number;
  driftAmp:  number;
  driftFreq: number;
  phase:     number;
  spinSpeed: number;
  colorIdx:  number;
  sz:        number;
  delay:     number;
  burst:     number; // -1 = voile ambiant ; sinon index de la salve
}

let _featherCached: Feather[] | null = null;
let _featherSeed = -1;

function getFeathers(seed: number): Feather[] {
  if (_featherSeed === seed && _featherCached) return _featherCached;
  const rnd = prng(seed);

  const feathers: Feather[] = [];

  // Voile ambiant : plumes réparties, qui tombent doucement en boucle.
  for (let i = 0; i < 46; i++) {
    feathers.push({
      x0:        Math.round(rnd() * (W + 80)) - 40,
      fallSpeed: 16 + rnd() * 30,
      driftAmp:  10 + rnd() * 30,
      driftFreq: 0.5 + rnd() * 1.8,
      phase:     rnd() * Math.PI * 2,
      spinSpeed: (rnd() - 0.5) * 3.2,
      colorIdx:  Math.floor(rnd() * FEATHER_COLORS.length),
      sz:        0.6 + rnd() * 0.7,
      delay:     rnd() * 2.4,
      burst:     -1,
    });
  }

  // Bouffées synchronisées : un paquet de plumes lâché à chaque trig audio,
  // depuis une zone large en haut, pour « pleuvoir » sur le pop sonore.
  CELEBRATION_BURST_TRIGS.forEach((trig, b) => {
    const count = 10 + Math.floor(rnd() * 6);
    for (let i = 0; i < count; i++) {
      feathers.push({
        x0:        Math.round(rnd() * (W + 60)) - 30,
        fallSpeed: 34 + rnd() * 46,
        driftAmp:  14 + rnd() * 34,
        driftFreq: 0.7 + rnd() * 2.2,
        phase:     rnd() * Math.PI * 2,
        spinSpeed: (rnd() - 0.5) * 4.5,
        colorIdx:  Math.floor(rnd() * FEATHER_COLORS.length),
        sz:        0.7 + rnd() * 0.8,
        delay:     trig + rnd() * 0.18,
        burst:     b,
      });
    }
  });

  _featherCached = feathers;
  _featherSeed = seed;
  return _featherCached;
}

function drawFeatherRain(ctx: CanvasRenderingContext2D, wonAge: number, seed: number): void {
  const feathers = getFeathers(seed);

  for (const f of feathers) {
    const age = wonAge - f.delay;
    if (age <= 0) continue;

    // Chute : voile en boucle (wrap), bouffées en passage unique.
    let y: number;
    let alpha: number;
    if (f.burst < 0) {
      const span = H + 80;
      const rawY = (f.phase / (Math.PI * 2)) * span + age * f.fallSpeed;
      y = (rawY % span) - 40;
      alpha = 0.55;
    } else {
      y = -30 + age * f.fallSpeed;
      if (y > H + 20) continue;
      // fade-in rapide à l'apparition, fade-out près du bas
      const fin = Math.min(1, age / 0.25);
      const fout = y > H * 0.7 ? Math.max(0, (H + 20 - y) / (H * 0.3 + 20)) : 1;
      alpha = 0.85 * fin * fout;
    }
    if (alpha <= 0.02) continue;

    const x = f.x0 + Math.sin(age * f.driftFreq + f.phase) * f.driftAmp;
    if (x < -20 || x > W + 20) continue;

    // Rotation = tournoiement (spin) + balancement suivant la dérive latérale.
    const sway = Math.cos(age * f.driftFreq + f.phase) * 0.5;
    const rot  = age * f.spinSpeed + sway;

    drawFeather(ctx, Math.round(x), Math.round(y), rot, f.sz, FEATHER_COLORS[f.colorIdx]!, alpha);
  }
  ctx.globalAlpha = 1;
}

// ─── Bordure arc-en-ciel pulsante ─────────────────────────────────────────────

function drawRainbowBorder(ctx: CanvasRenderingContext2D, animClock: number): void {
  const pulse = 0.20 + 0.12 * Math.sin(animClock * 3.8);
  const S = 6;

  ctx.save();
  ctx.globalAlpha = pulse;

  for (let x = 0; x < W; x += S) {
    const h = ((animClock * 50 + x * 0.9) % 360 + 360) % 360;
    ctx.fillStyle = hsl(h, 1, 0.60);
    ctx.fillRect(x, 0, S, 5);
    ctx.fillRect(x, H - 5, S, 5);
  }

  for (let y = 0; y < H; y += S) {
    const h = ((animClock * 50 + y * 0.7) % 360 + 360) % 360;
    ctx.fillStyle = hsl(h, 1, 0.60);
    ctx.fillRect(0, y, 5, S);
    ctx.fillRect(W - 5, y, 5, S);
  }

  ctx.restore();
}

// ─── Étoiles filantes de victoire ─────────────────────────────────────────────

function drawVictoryStars(ctx: CanvasRenderingContext2D, wonAge: number, animClock: number): void {
  const STARS = [
    { period: 1.8, sx: 20,  sy: 30,  ex: 420, ey: 140, col: "#ffee66" },
    { period: 2.2, sx: 460, sy: 20,  ex: 60,  ey: 160, col: "#88ffee" },
    { period: 2.6, sx: 30,  sy: 80,  ex: 430, ey: 110, col: "#ff88cc" },
  ] as const;

  for (const st of STARS) {
    const phase = wonAge % st.period;
    if (phase > 0.7) continue;
    const progress = phase / 0.7;

    const cx = Math.round(st.sx + (st.ex - st.sx) * progress);
    const cy = Math.round(st.sy + (st.ey - st.sy) * progress);
    const dist = Math.hypot(st.ex - st.sx, st.ey - st.sy);
    const nx = (st.ex - st.sx) / dist;
    const ny = (st.ey - st.sy) / dist;

    for (let k = 14; k >= 0; k--) {
      const a = (1 - k / 14) * (1 - progress * 0.7) * 0.85;
      ctx.globalAlpha = a;
      ctx.fillStyle = k < 4 ? "#ffffff" : st.col;
      ctx.fillRect(
        Math.round(cx - nx * k * 4.2),
        Math.round(cy - ny * k * 4.2),
        k < 3 ? 2 : 1, 1,
      );
    }
  }
  ctx.globalAlpha = 1;
  void animClock; // used indirectly via wonAge modulo
}

// ─── NEW RECORD ───────────────────────────────────────────────────────────────

function drawNewRecord(ctx: CanvasRenderingContext2D, wonAge: number, animClock: number): void {
  const fadeIn = Math.max(0, Math.min(1, (wonAge - 0.5) / 0.35));
  if (fadeIn <= 0) return;

  const popScale = fadeIn < 1
    ? 0.4 + 0.6 * (1 - (1 - fadeIn) * (1 - fadeIn))
    : 1 + 0.05 * Math.sin(animClock * 4.5);

  const cx = W / 2;
  const cy = Math.round(H * 0.40);
  const text = "★ NEW RECORD ★";
  const fontSize = 26;

  ctx.save();
  ctx.globalAlpha = fadeIn * (0.88 + 0.12 * Math.sin(animClock * 3.0));
  ctx.imageSmoothingEnabled = false;
  ctx.font = `bold ${fontSize}px "MS Sans Serif", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(popScale, popScale);

  // Outline pixel-art
  ctx.fillStyle = "rgba(0,0,0,0.95)";
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      if (dx === 0 && dy === 0) continue;
      ctx.fillText(text, dx, dy);
    }
  }

  // Dégradé arc-en-ciel animé
  const tw = ctx.measureText(text).width;
  const grad = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
  for (let i = 0; i <= 8; i++) {
    const h = ((animClock * 90 + i * 45) % 360 + 360) % 360;
    grad.addColorStop(i / 8, hsl(h, 1, 0.65));
  }
  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);

  // Reflet blanc
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText(text, 0, -1);

  ctx.restore();
  ctx.restore();
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function drawCelebration(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  isNewRecord = false,
): void {
  if (s.phase !== "won") return;
  const wonAge = s.animClock - s.levelWonAt;
  if (wonAge < 0) return;

  // Flash initial gold/blanc
  if (wonAge < 0.40) {
    ctx.save();
    ctx.globalAlpha = ((0.40 - wonAge) / 0.40) * 0.62;
    ctx.fillStyle = "#ffe860";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Confetti — seeded par run + niveau pour être unique à chaque victoire
  const confettiSeed = ((s.forestSeed ^ (s.level * 98765)) >>> 0);
  drawConfetti(ctx, wonAge, confettiSeed);

  // Pluie de plumes d'aigle (remplace les feux d'artifice)
  const featherSeed = ((s.forestSeed ^ (s.level * 54321)) >>> 0);
  drawFeatherRain(ctx, wonAge, featherSeed);

  // Étoiles filantes
  drawVictoryStars(ctx, wonAge, s.animClock);

  // Bordure arc-en-ciel
  drawRainbowBorder(ctx, s.animClock);

  // Texte NEW RECORD si nouveau record personnel
  if (isNewRecord) drawNewRecord(ctx, wonAge, s.animClock);
}
