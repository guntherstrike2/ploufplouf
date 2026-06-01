import { W, HUD_H } from "../engine/constants";
import { getActiveBall } from "../engine/assets";
import type { BallStyle } from "../engine/assets";
import type { GameState } from "../engine/types";
import type { GameTheme, PegTheme } from "../engine/game-theme";

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

const FACE = {
  head: "#f0e8d0", headHi: "#ffffff", headLo: "#cdbf9a", headLo2: "#a89c76",
  brow: "#8f7d52",
  beak: "#ffcc33", beakHi: "#ffe488", beakLo: "#d99a12", beakTip: "#a6760a",
  mouth: "#3a1d0a", tongue: "#d2563a",
  iris: "#f6d77a", irisRed: "#ff4433", pupil: "#141414", pupilRed: "#7a0d06",
  nape: "#6e4420", napeLo: "#452910",
  drop: "#9fd4ff",
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

// ── Mascotte façon DOOM : grosse tête d'aigle de face, réactive ──────────────
// Une seule tête, dessinée en gros et de face, qui change d'expression selon
// l'action : neutre (cligne, regarde autour), impact (yeux écarquillés, bec
// entrouvert), éclatement de cible (bec grand ouvert, cri), fever (yeux rouges,
// sourcils féroces), peu d'œufs (sourcils inquiets + goutte). Palette FACE.
interface FaceMood {
  blink: boolean;
  open: number;                       // 0..1 ouverture du bec
  brow: "flat" | "angry" | "up";      // sourcils : neutre / féroce / inquiet
  eyeRed: boolean;                    // yeux rouges (fever)
  wide: boolean;                      // yeux écarquillés (impact / surprise)
  look: number;                       // -1..1 décalage pupille (regard idle)
  pop: number;                        // 0..1 pulse d'échelle à l'impact
}

// Tête centrée sur (cx, cy). Boîte de dessin ≈ 30×32 px, repère centré (0,0).
function eagleFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, m: FaceMood): void {
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  const scale = 1 + 0.14 * m.pop;
  if (scale !== 1) ctx.scale(scale, scale);

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
  };

  // épaules brunes derrière la tête (bas-coins) → la tête blanche ressort
  px(-14, 7, 6, 9, FACE.nape);  px(-14, 7, 6, 1, "#8a5a2c");
  px(8, 7, 6, 9, FACE.nape);    px(8, 7, 6, 1, "#8a5a2c");
  px(-14, 14, 6, 2, FACE.napeLo); px(8, 14, 6, 2, FACE.napeLo);

  // dôme de la tête (blanc cassé), silhouette arrondie par paliers
  px(-6, -16, 12, 3, FACE.head);
  px(-9, -13, 18, 3, FACE.head);
  px(-12, -10, 24, 18, FACE.head);
  px(-10, 8, 20, 4, FACE.head);
  px(-7, 12, 14, 2, FACE.head);
  // lumière (haut-gauche) + ombre (bas-droite)
  px(-6, -16, 12, 1, FACE.headHi);
  px(-12, -10, 1, 18, FACE.headHi);
  px(11, -10, 1, 18, FACE.headLo);
  px(-9, 11, 17, 1, FACE.headLo);
  px(-6, 13, 12, 1, FACE.headLo2);

  // sourcils / arcades — donnent l'expression
  if (m.brow === "angry") {
    px(-11, -9, 4, 2, FACE.brow); px(-8, -7, 4, 2, FACE.brow);   // gauche : descend vers le centre
    px(7, -9, 4, 2, FACE.brow);   px(4, -7, 4, 2, FACE.brow);    // droite (miroir)
  } else if (m.brow === "up") {
    px(-11, -7, 4, 2, FACE.brow); px(-8, -9, 4, 2, FACE.brow);   // inquiet : remonte vers le centre
    px(7, -7, 4, 2, FACE.brow);   px(4, -9, 4, 2, FACE.brow);
  } else {
    px(-11, -8, 5, 2, FACE.brow); px(6, -8, 5, 2, FACE.brow);    // neutre : plat
  }

  // yeux (iris pâle + pupille), centrés à x = ±7, y ≈ -3
  for (const sgn of [-1, 1]) {
    const ex = sgn * 7;
    if (m.blink) {
      px(ex - 3, -3, 6, 1, FACE.headLo2);                        // paupière fermée
      continue;
    }
    const irisH = m.wide ? 7 : 5;
    const irisY = m.wide ? -5 : -4;
    px(ex - 3, irisY, 6, irisH, m.eyeRed ? FACE.irisRed : FACE.iris);
    px(ex - 3, irisY, 6, 1, "rgba(0,0,0,0.35)");                 // contour haut
    const lk = Math.round(m.look);
    px(ex - 1 + lk, irisY + 1, 2, 3, m.eyeRed ? FACE.pupilRed : FACE.pupil);
    px(ex - 1 + lk, irisY + 1, 1, 1, FACE.headHi);               // reflet
  }

  // bec jaune crochu, centré, pointant vers le bas
  px(-4, -1, 8, 2, FACE.beak);
  px(-3, 1, 6, 2, FACE.beak);
  px(-2, 3, 4, 1, FACE.beak);
  px(-4, -1, 1, 4, FACE.beakHi);                                 // arête claire (gauche)
  px(3, -1, 1, 4, FACE.beakLo);                                  // ombre (droite)
  px(-2, 0, 1, 1, FACE.beakTip);                                 // narine

  // mandibule inférieure : tombe quand le bec s'ouvre
  const d = Math.round(m.open * 5);
  const ly = 4 + d;
  if (d > 0) {
    px(-3, 4, 6, d, FACE.mouth);                                 // gueule sombre
    px(-1, 4, 2, d, FACE.tongue);                                // langue
  }
  px(-2, ly, 4, 2, FACE.beakLo);
  px(-2, ly, 4, 1, FACE.beak);
  px(-1, ly + 2, 2, 1, FACE.beakTip);                            // pointe crochue

  // goutte d'inquiétude (peu d'œufs)
  if (m.brow === "up") {
    px(10, -11, 2, 3, FACE.drop);
    px(10, -8, 1, 1, FACE.drop);
    px(10, -11, 1, 1, FACE.headHi);
  }

  ctx.restore();
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

  // ── Expression de la tête, dérivée de l'état courant ──
  // hitFreezeFrames est posé à chaque collision (≈4 rebond, ≈9 cible éclatée,
  // ≈14 gros coup) puis décroît → flinch « Doom » d'une poignée de frames.
  const hitMag = s.hitFreezeFrames;
  const justHit = hitMag > 0;
  const burst = hitMag >= 8;          // cible orange éclatée / gros coup
  const face: FaceMood = {
    blink: !justHit && !inFever && (s.animClock % 3.2) < 0.12,
    open: inFever ? 0.45 + 0.4 * pulse : justHit ? (burst ? 1 : 0.55) : 0,
    brow: inFever ? "angry" : burst ? "angry" : lowBalls ? "up" : "flat",
    eyeRed: inFever,
    wide: justHit,
    look: justHit || inFever ? 0 : Math.sin(s.animClock * 0.6) * 1.2,
    pop: Math.min(1, hitMag / 9),
  };

  ctx.save();
  ctx.imageSmoothingEnabled = false;

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
