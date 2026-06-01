import { W, HUD_H } from "../engine/constants";
import { getActiveBall } from "../engine/assets";
import type { BallStyle } from "../engine/assets";
import type { GameState } from "../engine/types";
import type { GameTheme, PegTheme } from "../engine/game-theme";

// ─── HUD in-canvas — enseigne de bois unifiée ────────────────────────────────
//
// Un seul objet cohérent, dans le monde du jeu : une enseigne de bois (registre
// des nids) avec une zone gravée en creux où s'alignent les compteurs. Les
// icônes réutilisent les VRAIS sprites du jeu — l'œuf (getActiveBall) et le peg
// orange (theme.peg) — pour une cohérence parfaite. Le lanceur est descendu sous
// l'enseigne (cf. LAUNCHER_Y).

// Géométrie de l'enseigne (espace canvas) — partagée avec le hit-test pause.
const HX = 6, HY = 4, HW = W - 12, HH = HUD_H - 8;

// Bouton pause intégré à l'enseigne (extrémité droite). Exporté pour le hit-test
// pointeur dans useGameLoop (le bouton est dessiné dans le canvas, pas en HTML).
export const PAUSE_HIT = { x: HX + HW - 37, y: HY + 9, w: 30, h: HH - 14 } as const;

const WOOD = {
  shadow: "rgba(0,0,0,0.45)",
  body:   "#52391c",
  light:  "#6a4a26",
  dark:   "#39260f",
  hi:     "#8a6034",
  lo:     "#22150a",
  grain:  "rgba(28,17,8,0.4)",
} as const;

const RECESS = {
  fill: "#160f06",
  top:  "#0c0803",   // bord sunken haut/gauche
  bot:  "#3a2a14",   // bord sunken bas/droite
} as const;

const INK = {
  cream:  "#f2e6c2",
  label:  "#9c8a5a",
  green:  "#9be04e",
  orange: "#ff8a3c",
  warn:   "#ffc24a",
  gold:   "#ffd24a",
  leaf:   "#4f8a26",
  leafHi: "#74b840",
} as const;

// ── Sprites réutilisés (mêmes recettes que ball.ts / pegs.ts) ────────────────

function eggSprite(ctx: CanvasRenderingContext2D, cx: number, cy: number, st: BallStyle, r: number): void {
  const bx = Math.round(cx), by = Math.round(cy);
  ctx.fillStyle = st.glow;
  ctx.globalAlpha = 0.22; ctx.fillRect(bx - r - 1, by - r - 1, r * 2 + 2, r * 2 + 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = st.body;
  ctx.fillRect(bx - r + 1, by - r, r * 2 - 2, r * 2);
  ctx.fillRect(bx - r, by - r + 1, r * 2, r * 2 - 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx - r + 1, by - r, r * 2 - 2, 1);
  ctx.fillRect(bx - r, by - r + 1, 1, r * 2 - 2);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(bx - r + 1, by + r - 1, r * 2 - 2, 1);
  ctx.fillRect(bx + r - 1, by - r + 1, 1, r * 2 - 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(bx - r + 1, by - r + 1, 2, 1);
  ctx.fillRect(bx - r + 1, by - r + 1, 1, 2);
  ctx.fillStyle = st.speckle;
  ctx.fillRect(bx - 1, by - r + 2, 2, 1);
  ctx.fillRect(bx + r - 3, by - 1, 1, 2);
}

function pegSprite(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: PegTheme, fever: boolean): void {
  const s = Math.round(r * 2), x = Math.round(cx - r), y = Math.round(cy - r);
  const fill = fever ? t.orangeFever : t.orange;
  const hi   = fever ? t.orangeGlow : t.orangeHi;
  ctx.fillStyle = fever ? t.orangeGlow : t.orange;
  ctx.globalAlpha = 0.28; ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = fill; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = hi; ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y, 1, s);
  ctx.fillStyle = t.orangeDark; ctx.fillRect(x, y + s - 1, s, 1); ctx.fillRect(x + s - 1, y, 1, s);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(x + 1, y + 1, 2, 1); ctx.fillRect(x + 1, y + 1, 1, 2);
}

function leafSprite(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.moveTo(-5, 3); ctx.lineTo(5, -5); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = INK.leaf;
  ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(4, -4); ctx.lineTo(3, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = INK.leafHi;
  ctx.fillRect(-2, -1, 4, 1);
  ctx.restore();
}

// ── Texte ─────────────────────────────────────────────────────────────────────

// Valeur en relief : contour sombre + corps clair. Renvoie la largeur du texte.
function value(
  ctx: CanvasRenderingContext2D, text: string, x: number, cy: number,
  size: number, color: string, glow = 0,
): number {
  ctx.font = `bold ${size}px "MS Sans Serif", monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = 6 * glow; }
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillText(text, x + 1, cy + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, cy);
  ctx.shadowBlur = 0;
  return ctx.measureText(text).width;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.font = '6px "MS Sans Serif", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK.label;
  ctx.fillText(text, x, y);
}

// ── Enseigne ────────────────────────────────────────────────────────────────

function sign(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // ombre portée
  ctx.fillStyle = WOOD.shadow;
  ctx.fillRect(x + 2, y + 3, w, h);
  // corps bois + dégradé vertical
  ctx.fillStyle = WOOD.body;  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = WOOD.light; ctx.fillRect(x, y, w, Math.floor(h * 0.4));
  ctx.fillStyle = WOOD.dark;  ctx.fillRect(x, y + Math.floor(h * 0.78), w, h - Math.floor(h * 0.78));
  // une veine discrète
  ctx.fillStyle = WOOD.grain; ctx.fillRect(x + 6, y + Math.round(h * 0.5), w - 12, 1);
  // cadre bois (biseau)
  ctx.fillStyle = WOOD.hi; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = WOOD.lo; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
}

function recess(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = RECESS.fill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = RECESS.top;  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = RECESS.bot;  ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
}

function notch(ctx: CanvasRenderingContext2D, x: number, top: number, h: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x, top, 1, h);
  ctx.fillStyle = "rgba(120,90,50,0.25)"; ctx.fillRect(x + 1, top, 1, h);
}

// Bouton pause taillé dans l'enseigne : touche de bois en relief + glyphe ❚❚.
function pauseButton(ctx: CanvasRenderingContext2D, pulse: number): void {
  const { x, y, w, h } = PAUSE_HIT;
  // touche de bois (relief : claire en haut/gauche, sombre en bas/droite)
  ctx.fillStyle = WOOD.light; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = WOOD.hi; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = WOOD.lo; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = WOOD.grain; ctx.fillRect(x + 2, y + Math.round(h / 2), w - 4, 1);
  // léger halo crème qui respire → invite à cliquer
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.05 + 0.06 * pulse;
  ctx.fillStyle = INK.cream;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
  // glyphe pause (2 barres) avec contour sombre
  const cx = x + Math.round(w / 2);
  const bh = Math.round(h * 0.46), by = y + Math.round((h - bh) / 2);
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(cx - 6, by - 1, 5, bh + 2); ctx.fillRect(cx + 1, by - 1, 5, bh + 2);
  ctx.fillStyle = INK.cream;
  ctx.fillRect(cx - 5, by, 3, bh); ctx.fillRect(cx + 2, by, 3, bh);
}

function fmt(n: number): string {
  return n >= 100000 ? `${Math.floor(n / 1000)}k` : n.toLocaleString();
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  orangeLeft: number,
  orangeTotal: number,
  bestScore: number,
  theme: GameTheme,
): void {
  const inFever = orangeLeft > 0 && orangeLeft <= s.effectiveFeverThreshold;
  const lowBalls = s.balls > 0 && s.balls <= 2;
  const hasCombo = s.combo >= 3;
  const pulse = 0.5 + 0.5 * Math.sin(s.animClock * 6);
  const egg = getActiveBall();

  const x = HX, y = HY, w = HW, h = HH;

  ctx.save();

  sign(ctx, x, y, w, h);

  // Zone gravée en creux
  const rx = x + 5, ry = y + 5, rw = w - 10, rh = h - 10;
  recess(ctx, rx, ry, rw, rh);

  // Fever : la zone gravée rougeoie
  if (inFever) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.14 + 0.18 * pulse;
    ctx.fillStyle = INK.orange;
    ctx.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);
    ctx.restore();
  }

  const lblY = ry + 7;
  const valY = ry + rh - 8;

  // ── NIVEAU ──
  label(ctx, "NIVEAU", rx + 10, lblY);
  leafSprite(ctx, rx + 14, valY);
  value(ctx, `${s.level}`, rx + 22, valY, 13, INK.green);
  notch(ctx, rx + 58, ry + 4, rh - 8);

  // ── SCORE (héros) ──
  label(ctx, "SCORE", rx + 70, lblY);
  value(ctx, fmt(s.score), rx + 70, valY, 17, INK.cream);
  notch(ctx, rx + 196, ry + 4, rh - 8);

  // ── CIBLES (sprite peg orange) ──
  label(ctx, "CIBLES", rx + 208, lblY);
  pegSprite(ctx, rx + 213, valY, 5, theme.peg, inFever);
  value(ctx, `${orangeLeft}/${orangeTotal}`, rx + 222, valY, 13,
    inFever ? INK.orange : INK.cream, inFever ? 0.4 + 0.6 * pulse : 0);
  notch(ctx, rx + 286, ry + 4, rh - 8);

  // ── ŒUFS (sprite œuf) ──
  label(ctx, "ŒUFS", rx + 298, lblY);
  eggSprite(ctx, rx + 303, valY, egg, 5);
  value(ctx, `${s.balls}`, rx + 312, valY, 13,
    lowBalls ? INK.warn : INK.cream, lowBalls ? 0.4 + 0.6 * pulse : 0);
  notch(ctx, rx + 340, ry + 4, rh - 8);

  // ── COMBO (prioritaire) sinon RECORD ──
  if (hasCombo) {
    label(ctx, "COMBO", rx + 352, lblY);
    value(ctx, `×${Math.max(1, Math.floor(s.combo / 3))}`, rx + 352, valY, 15,
      INK.orange, 0.4 + 0.6 * pulse);
  } else if (bestScore > 0) {
    label(ctx, "RECORD", rx + 352, lblY);
    value(ctx, fmt(bestScore), rx + 352, valY, 12, INK.gold);
  }

  // ── Bouton pause taillé dans l'enseigne (extrémité droite) ──
  notch(ctx, PAUSE_HIT.x - 6, ry + 4, rh - 8);
  pauseButton(ctx, pulse);

  ctx.restore();
}
