import { W, H, HUD_H } from "../engine/constants";
import { getActiveBall } from "../engine/assets";
import type { BallStyle } from "../engine/assets";
import type { GameState } from "../engine/types";
import type { GameTheme, PegTheme } from "../engine/game-theme";
import { eagleFace, getFaceMood } from "./face";

// ─── HUD in-canvas — épuré ───────────────────────────────────────────────────
//
// Pas de panneau, pas de décor forêt : juste un léger ombrage en haut (sans
// bord) pour la lisibilité, une grosse TÊTE D'AIGLE de face façon Doom qui
// change d'expression selon l'action, et quatre compteurs nets (niveau, score,
// cibles, œufs). Bouton pause discret à droite. Sprites œuf/peg réutilisés.

// Géométrie (espace canvas) — bornes partagées avec le hit-test pause.
const HX = 6, HW = W - 12;
const LABEL_Y = 13;   // ligne des intitulés
const VALUE_Y = 28;   // ligne des valeurs

// Bouton pause (extrémité droite). Exporté pour le hit-test dans useGameLoop.
export const PAUSE_HIT = { x: HX + HW - 34, y: 10, w: 28, h: 24 } as const;

const INK = {
  cream: "#f5ecca", label: "#cfe2a6", green: "#a6ec56",
  orange: "#ff9a4c", warn: "#ffc24a",
} as const;

// ── Sprites réutilisés (mêmes recettes que ball.ts / pegs.ts) ────────────────

function eggSprite(ctx: CanvasRenderingContext2D, cx: number, cy: number, st: BallStyle, r: number): void {
  const bx = Math.round(cx), by = Math.round(cy);
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
}

function pegSprite(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: PegTheme, fever: boolean): void {
  const s = Math.round(r * 2), x = Math.round(cx - r), y = Math.round(cy - r);
  const fill = fever ? t.orangeFever : t.orange;
  const hi   = fever ? t.orangeGlow : t.orangeHi;
  ctx.fillStyle = fill; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = hi; ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y, 1, s);
  ctx.fillStyle = t.orangeDark; ctx.fillRect(x, y + s - 1, s, 1); ctx.fillRect(x + s - 1, y, 1, s);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(x + 1, y + 1, 2, 1); ctx.fillRect(x + 1, y + 1, 1, 2);
}

// ── Texte ─────────────────────────────────────────────────────────────────────

// Valeur en relief : contour pixel net (4 décalages 1px) + corps clair.
function value(
  ctx: CanvasRenderingContext2D, text: string, x: number, cy: number,
  size: number, color: string, emphasize = false,
): number {
  ctx.font = `bold ${size}px "MS Sans Serif", monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.92)";
  ctx.fillText(text, x + 1, cy); ctx.fillText(text, x - 1, cy);
  ctx.fillText(text, x, cy + 1); ctx.fillText(text, x, cy - 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, cy);
  if (emphasize) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(text, x, cy - 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, cy);
  }
  return ctx.measureText(text).width;
}

// Intitulé : petite capitale, contour pixel complet (lisible sur le ciel).
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.font = 'bold 8px "MS Sans Serif", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.88)";
  ctx.fillText(text, x + 1, y); ctx.fillText(text, x - 1, y);
  ctx.fillText(text, x, y + 1); ctx.fillText(text, x, y - 1);
  ctx.fillStyle = INK.label;
  ctx.fillText(text, x, y);
}

function fmt(n: number): string {
  return n >= 100000 ? `${Math.floor(n / 1000)}k` : n.toLocaleString();
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  orangeLeft: number,
  orangeTotal: number,
  theme: GameTheme,
): void {
  const inFever = orangeLeft > 0 && orangeLeft <= s.effectiveFeverThreshold;
  const lowBalls = s.balls > 0 && s.balls <= 2;
  const pulse = 0.5 + 0.5 * Math.sin(s.animClock * 6);
  const egg = getActiveBall();
  const face = getFaceMood(s);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // ── Vignette danger : bords rouges pulsants quand il reste 1 ou 2 œufs ──
  if (lowBalls) {
    const vPulse = 0.5 + 0.5 * Math.sin(s.animClock * 7);
    const vAlpha = 0.22 + 0.18 * vPulse;
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.82);
    vig.addColorStop(0, "rgba(180,20,20,0)");
    vig.addColorStop(1, `rgba(200,30,10,${vAlpha.toFixed(3)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Ombrage : dégradé sans bord qui se fond dans le ciel (pas de panneau) ──
  const shade = ctx.createLinearGradient(0, 0, 0, HUD_H + 8);
  shade.addColorStop(0, "rgba(6,12,4,0.62)");
  shade.addColorStop(0.65, "rgba(6,12,4,0.22)");
  shade.addColorStop(1, "rgba(6,12,4,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, HUD_H + 8);

  // Fever : touche chaude diffuse par-dessus l'ombre (toujours sans bord).
  if (inFever) {
    const warm = ctx.createLinearGradient(0, 0, 0, HUD_H + 8);
    const a = 0.12 + 0.12 * pulse;
    warm.addColorStop(0, `rgba(255,120,40,${a})`);
    warm.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, HUD_H + 8);
  }

  // ── Tête d'aigle (mascotte façon Doom), à gauche ──
  eagleFace(ctx, HX + 22, 22, face);

  // ── NIVEAU ──
  label(ctx, "NIVEAU", HX + 54, LABEL_Y);
  value(ctx, `${s.level}`, HX + 54, VALUE_Y, 15, INK.green);

  // ── SCORE (héros) ──
  label(ctx, "SCORE", HX + 108, LABEL_Y);
  value(ctx, fmt(s.score), HX + 108, VALUE_Y, 19, INK.cream, true);

  // ── CIBLES (sprite peg orange) ──
  label(ctx, "CIBLES", HX + 244, LABEL_Y);
  pegSprite(ctx, HX + 249, VALUE_Y, 5, theme.peg, inFever);
  value(ctx, `${orangeLeft}/${orangeTotal}`, HX + 258, VALUE_Y, 15,
    inFever ? INK.orange : INK.cream, inFever);

  // ── ŒUFS (icône œuf + compteur) ──
  label(ctx, "ŒUFS", HX + 346, LABEL_Y);
  if (lowBalls) {
    // Fond rouge pulsant derrière le compteur d'œufs
    const bgA = 0.28 + 0.22 * pulse;
    ctx.fillStyle = `rgba(180,30,10,${bgA.toFixed(3)})`;
    ctx.fillRect(HX + 342, 4, 72, HUD_H - 8);
    // Liseret warn : bord bas du pavé
    ctx.fillStyle = `rgba(255,80,40,${(0.55 + 0.35 * pulse).toFixed(3)})`;
    ctx.fillRect(HX + 342, 4 + HUD_H - 9, 72, 1);
  }
  ctx.save();
  if (lowBalls) ctx.globalAlpha = 0.55 + 0.45 * pulse;   // clignote quand il en reste peu
  eggSprite(ctx, HX + 351, VALUE_Y, egg, 4);
  ctx.restore();
  value(ctx, `${s.balls}`, HX + 360, VALUE_Y, 15, lowBalls ? INK.warn : INK.cream, lowBalls);

  // ── Bouton pause (extrémité droite) ──
  pauseButton(ctx);

  ctx.restore();
}

// Bouton pause : pavé translucide net + deux barres claires (pas de chrome win98).
function pauseButton(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = PAUSE_HIT;
  ctx.fillStyle = "rgba(8,16,6,0.5)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  const cx = x + Math.round(w / 2);
  const bh = Math.round(h * 0.5), by = y + Math.round((h - bh) / 2);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(cx - 5, by - 1, 4, bh + 2); ctx.fillRect(cx + 1, by - 1, 4, bh + 2);
  ctx.fillStyle = INK.cream;
  ctx.fillRect(cx - 5, by, 3, bh); ctx.fillRect(cx + 2, by, 3, bh);
}
