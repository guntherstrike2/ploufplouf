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

// ─── Feux d'artifice ──────────────────────────────────────────────────────────

// Les trigger times correspondent aux sons joués depuis useGameLoop
export const CELEBRATION_BURST_TRIGS = [0.55, 1.15, 1.80, 2.50, 3.20, 4.00, 4.80] as const;

const BURSTS = [
  { trig: 0.00, cx: 120, cy: 85,  r: 52, n: 20, hue: 50  },
  { trig: 0.55, cx: 355, cy: 68,  r: 58, n: 22, hue: 210 },
  { trig: 1.15, cx: 80,  cy: 108, r: 46, n: 18, hue: 330 },
  { trig: 1.80, cx: 390, cy: 92,  r: 54, n: 20, hue: 120 },
  { trig: 2.50, cx: 240, cy: 72,  r: 64, n: 24, hue: 35  },
  { trig: 3.20, cx: 145, cy: 88,  r: 50, n: 18, hue: 275 },
  { trig: 4.00, cx: 330, cy: 95,  r: 58, n: 22, hue: 185 },
  { trig: 4.80, cx: 240, cy: 78,  r: 70, n: 28, hue: 50  },
] as const;

const BURST_DUR = 1.9;

function drawFireworks(ctx: CanvasRenderingContext2D, wonAge: number, animClock: number): void {
  for (const fw of BURSTS) {
    const fwAge = wonAge - fw.trig;
    if (fwAge <= 0 || fwAge > BURST_DUR) continue;

    const t    = fwAge / BURST_DUR;
    // Alpha: fade in fast, stay, fade out
    const alpha = t < 0.18 ? t / 0.18 : t > 0.65 ? (1 - t) / 0.35 : 1;
    if (alpha <= 0.02) continue;

    // Flash central au moment de l'explosion
    if (t < 0.22) {
      const flashA = (1 - t / 0.22) * 0.55;
      ctx.globalAlpha = flashA;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(fw.cx - 4, fw.cy - 4, 9, 9);
    }

    for (let i = 0; i < fw.n; i++) {
      const angle  = (i / fw.n) * Math.PI * 2;
      // Expansion easeOut : démarre vite, ralentit
      const distT  = Math.min(1, fwAge / 1.0);
      const dist   = fw.r * (1 - (1 - distT) * (1 - distT));
      const grav   = 14 * fwAge * fwAge;

      const px = Math.round(fw.cx + Math.cos(angle) * dist);
      const py = Math.round(fw.cy + Math.sin(angle) * dist + grav);

      const twink = 0.5 + 0.5 * Math.abs(Math.sin(animClock * 7 + i * 1.1));
      const hue   = (fw.hue + i * (360 / fw.n) * 0.32) % 360;
      ctx.globalAlpha = alpha * twink;
      ctx.fillStyle = hsl(hue, 1, 0.62);
      ctx.fillRect(px - 1, py - 1, 3, 3);

      // Traîne si particule encore jeune
      if (fwAge < 0.65) {
        const td      = dist * 0.60;
        const tx      = Math.round(fw.cx + Math.cos(angle) * td);
        const ty      = Math.round(fw.cy + Math.sin(angle) * td + grav * 0.45);
        ctx.globalAlpha = alpha * 0.28;
        ctx.fillRect(tx, ty, 2, 2);
      }

      // Bras secondaires (étoile à 8 branches pour les gros feux)
      if (fw.n >= 24 && i % 3 === 0) {
        const a2 = angle + Math.PI / fw.n;
        const d2 = dist * 0.72;
        const sx = Math.round(fw.cx + Math.cos(a2) * d2);
        const sy = Math.round(fw.cy + Math.sin(a2) * d2 + grav * 0.8);
        ctx.globalAlpha = alpha * twink * 0.65;
        ctx.fillStyle = hsl((hue + 30) % 360, 1, 0.72);
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
    }
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

  // Feux d'artifice
  drawFireworks(ctx, wonAge, s.animClock);

  // Étoiles filantes
  drawVictoryStars(ctx, wonAge, s.animClock);

  // Bordure arc-en-ciel
  drawRainbowBorder(ctx, s.animClock);

  // Texte NEW RECORD si nouveau record personnel
  if (isNewRecord) drawNewRecord(ctx, wonAge, s.animClock);
}
