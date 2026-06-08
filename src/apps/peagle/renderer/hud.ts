import { W, H, HUD_H } from "../engine/constants";
import { getActiveBall } from "../engine/assets";
import type { BallStyle } from "../engine/assets";
import type { GameState } from "../engine/types";
import type { GameTheme, PegTheme } from "../engine/game-theme";
import { isClutchActive } from "../engine/clutch";
import { eagleFace, getFaceMood, gameFaceCtx } from "./face";
import { cornerHighlightL, chunkPlate } from "./helpers";

// ─── HUD in-canvas — barre-plaque « chunky » ─────────────────────────────────
//
// Le HUD est une seule longue PLAQUE chunky (DA « chunky rounded-rect » : bloc
// plein, coins arrondis 2px, bevel clair-haut/sombre-bas, reflet L) qui porte
// quatre compteurs (niveau, score, cibles, œufs) séparés par de fins traits
// sunken. La TÊTE D'AIGLE façon Doom déborde à gauche comme mascotte et change
// d'expression. Le bouton pause est une petite plaque chunky à droite. Sprites
// œuf/peg réutilisés. États d'alerte (peu d'œufs / clutch) : la section concernée
// se re-teinte sans changer la silhouette → l'arrondi reste.

// Géométrie (espace canvas).
const HX = 6, HW = W - 12;
const PLATE_Y = 5;                          // haut de la plaque
const PLATE_H = HUD_H - 9;                   // hauteur de la plaque
const PLATE_BOT = PLATE_Y + PLATE_H;
const LABEL_Y = PLATE_Y + 9;                 // ligne des intitulés
const VALUE_Y = PLATE_Y + 24;                // ligne des valeurs

// Bouton pause (extrémité droite, dans la plaque). Exporté pour le hit-test.
const PAUSE_W = 30;
export const PAUSE_HIT = { x: HX + HW - PAUSE_W - 4, y: PLATE_Y + 3, w: PAUSE_W, h: PLATE_H - 6 } as const;

const INK = {
  cream: "#f5ecca", label: "#cfe2a6", green: "#a6ec56",
  orange: "#ff9a4c", warn: "#ffc24a",
} as const;

// Palette de la plaque chunky — sombre/translucide pour rester lisible sur le ciel.
const PLATE = {
  fill: "rgba(14,22,12,0.74)", light: "rgba(120,150,90,0.55)",
  dark: "rgba(0,4,0,0.78)", outline: "rgba(0,4,0,0.85)",
  sep: "rgba(0,4,0,0.55)", sepHi: "rgba(150,180,110,0.30)",
} as const;

// Trait séparateur vertical sunken entre deux compteurs (ombre + liseré clair).
function divider(ctx: CanvasRenderingContext2D, x: number): void {
  ctx.fillStyle = PLATE.sep;
  ctx.fillRect(x, PLATE_Y + 5, 1, PLATE_H - 10);
  ctx.fillStyle = PLATE.sepHi;
  ctx.fillRect(x + 1, PLATE_Y + 5, 1, PLATE_H - 10);
}

// ── Score ticker + pop animation (module-level pour persister entre les frames) ──
let _displayedScore = -1;   // score affiché (monte vers s.score par ticker)
let _prevRealScore  = -1;   // détecte les hausses de score pour déclencher le pop
let _scorePop = 0;          // 0→1 au déclenchement, décroît vers 0 (spring-pop)

// easeOutBack locale — même recette que effects.ts, c1 doux pour le HUD.
function hudEob(x: number): number {
  const c1 = 2.8, c3 = c1 + 1, p = x - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}

// ── Gradients cachés (créés une fois par contexte, réutilisés chaque frame) ──
let _gradCtx: CanvasRenderingContext2D | null = null;
let _vigGrad: CanvasGradient | null = null;
let _clutchGrad: CanvasGradient | null = null;

function ensureHudGrads(ctx: CanvasRenderingContext2D): void {
  if (_gradCtx === ctx) return;
  _gradCtx = ctx;
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.82);
  vig.addColorStop(0, "rgba(180,20,20,0)");
  vig.addColorStop(1, "rgba(200,30,10,1)");
  _vigGrad = vig;
  const warm = ctx.createLinearGradient(0, PLATE_Y, 0, PLATE_BOT);
  warm.addColorStop(0, "rgba(255,120,40,0.9)");
  warm.addColorStop(1, "rgba(255,120,40,0)");
  _clutchGrad = warm;
}

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
  cornerHighlightL(ctx, bx - r, by - r, 0.9);
}

// Peg orange du HUD — mêmes coins arrondis 1px que les pegs du jeu (cf. renderer/pegs.ts
// pixelRoundBody) : corps = union d'un rect vertical + un rect horizontal, bevel rogné.
function pegSprite(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: PegTheme, clutch: boolean): void {
  const s = Math.round(r * 2), x = Math.round(cx - r), y = Math.round(cy - r);
  const fill = clutch ? t.orangeClutch : t.orange;
  const hi   = clutch ? t.orangeGlow : t.orangeHi;
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y, s - 2, s);     // colonne centrale (pleine hauteur)
  ctx.fillRect(x, y + 1, s, s - 2);     // ligne centrale (pleine largeur)
  ctx.fillStyle = hi;
  ctx.fillRect(x + 1, y, s - 2, 1); ctx.fillRect(x, y + 1, 1, s - 2);       // top + left
  ctx.fillStyle = t.orangeDark;
  ctx.fillRect(x + 1, y + s - 1, s - 2, 1); ctx.fillRect(x + s - 1, y + 1, 1, s - 2); // bottom + right
  cornerHighlightL(ctx, x, y);
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
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): number {
  ctx.font = 'bold 8px "MS Sans Serif", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.88)";
  ctx.fillText(text, x + 1, y); ctx.fillText(text, x - 1, y);
  ctx.fillText(text, x, y + 1); ctx.fillText(text, x, y - 1);
  ctx.fillStyle = INK.label;
  ctx.fillText(text, x, y);
  return ctx.measureText(text).width;
}

// Largeur d'un intitulé sans le dessiner (pour pré-calculer la largeur de cellule).
function labelWidth(ctx: CanvasRenderingContext2D, text: string): number {
  ctx.font = 'bold 8px "MS Sans Serif", monospace';
  return ctx.measureText(text).width;
}

// Largeur d'une valeur sans la dessiner.
function valueWidth(ctx: CanvasRenderingContext2D, text: string, size: number): number {
  ctx.font = `bold ${size}px "MS Sans Serif", monospace`;
  return ctx.measureText(text).width;
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
  const inClutch = isClutchActive(s);
  const lowBalls = s.balls > 0 && s.balls <= 2;
  const pulse = 0.5 + 0.5 * Math.sin(s.animClock * 6);
  const egg = getActiveBall();
  const face = getFaceMood(gameFaceCtx(s));

  // ── Ticker + pop : initialisation et mise à jour ──
  if (_displayedScore < 0 || s.score < _displayedScore) {
    _displayedScore = s.score; _prevRealScore = s.score; _scorePop = 0;
  }
  if (s.score > _prevRealScore) _scorePop = Math.min(1, _scorePop + 0.45);
  _prevRealScore = s.score;
  _scorePop = Math.max(0, _scorePop - 0.07);
  if (_displayedScore < s.score) {
    const d = s.score - _displayedScore;
    _displayedScore = Math.min(s.score, _displayedScore + Math.max(1, Math.min(Math.ceil(d * 0.25), 400)));
  }

  ensureHudGrads(ctx);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // ── Vignette danger : bords rouges pulsants quand il reste 1 ou 2 œufs ──
  if (lowBalls) {
    const vPulse = 0.5 + 0.5 * Math.sin(s.animClock * 7);
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.18 * vPulse;
    ctx.fillStyle = _vigGrad!;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── La barre-plaque chunky qui porte tous les compteurs ──
  chunkPlate(ctx, HX, PLATE_Y, HW, PLATE_H, {
    fill: PLATE.fill, light: PLATE.light, dark: PLATE.dark, outline: PLATE.outline,
    highlightL: 0.45,
  });

  // Fever : touche chaude diffuse par-dessus la plaque (clippée à la plaque).
  if (inClutch) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(HX + 1, PLATE_Y + 1, HW - 2, PLATE_H - 2);
    ctx.clip();
    ctx.globalAlpha = 0.14 + 0.14 * pulse;
    ctx.fillStyle = _clutchGrad!;
    ctx.fillRect(HX, PLATE_Y, HW, PLATE_H);
    ctx.restore();
  }

  // ── Layout en cellules mesurées : chaque compteur réserve max(intitulé, valeur) ──
  // La tête d'aigle occupe la première cellule (mascotte). Chaque compteur calcule
  // sa largeur AVANT de se dessiner (max entre l'intitulé et icône+valeur), pose un
  // séparateur dans la gouttière qui le précède, puis pousse le curseur. Fini les
  // offsets magiques et l'« NIVEAISCORE » qui se chevauche.
  const GUT = 13;          // gouttière entre deux cellules (le trait sunken s'y loge)
  const ICON_GAP = 13;     // espace icône → valeur (cibles/œufs)
  const scoreStr = fmt(Math.round(_displayedScore));

  // Largeurs de cellule (icône comprise quand il y en a une).
  const wNiveau = Math.max(labelWidth(ctx, "NIVEAU"), valueWidth(ctx, `${s.level}`, 15));
  const wScore  = Math.max(labelWidth(ctx, "SCORE"), valueWidth(ctx, scoreStr, 19));
  const wCibles = Math.max(labelWidth(ctx, "CIBLES"), ICON_GAP + valueWidth(ctx, `${orangeLeft}/${orangeTotal}`, 15));
  const wOeufs  = Math.max(labelWidth(ctx, "ŒUFS"), ICON_GAP + valueWidth(ctx, `${s.balls}`, 15));

  const headW = 40;
  eagleFace(ctx, HX + 6 + headW / 2, PLATE_Y + PLATE_H / 2, face);
  let x = HX + 6 + headW + GUT;

  // — NIVEAU —
  divider(ctx, x - Math.round(GUT / 2));
  label(ctx, "NIVEAU", x, LABEL_Y);
  value(ctx, `${s.level}`, x, VALUE_Y, 15, INK.green);
  x += wNiveau + GUT;

  // — SCORE (héros) — ticker + squash & stretch + flash couleur —
  divider(ctx, x - Math.round(GUT / 2));
  label(ctx, "SCORE", x, LABEL_Y);
  if (_scorePop > 0.01) {
    const popPhase = hudEob(1 - _scorePop);   // 0 au déclenchement → 1 quand calé
    const sc = 1 + (1 - popPhase) * 0.42;    // scale globale (1.42 → 1.0 avec overshoot)
    const sx = 1 + (1 - popPhase) * 0.22;    // squash X : large au pop
    const sy = 1 - (1 - popPhase) * 0.26;    // squash Y : court au pop
    const cx = x + valueWidth(ctx, scoreStr, 19) / 2;
    ctx.save();
    ctx.translate(cx, VALUE_Y);
    ctx.scale(sc * sx, sc * sy);
    ctx.translate(-cx, -VALUE_Y);
    // Flash cream→blanc chaud (doré) : reste dans la palette cream/warm du HUD.
    const fa = Math.min(1, _scorePop * 2);
    const flashColor = `rgb(${Math.round(245 + fa * 10)},${Math.round(236 + fa * 19)},${Math.round(202 + fa * 38)})`;
    value(ctx, scoreStr, x, VALUE_Y, 19, flashColor, true);
    ctx.restore();
  } else {
    value(ctx, scoreStr, x, VALUE_Y, 19, INK.cream, true);
  }
  x += wScore + GUT;

  // — CIBLES (sprite peg orange) —
  divider(ctx, x - Math.round(GUT / 2));
  label(ctx, "CIBLES", x, LABEL_Y);
  pegSprite(ctx, x + 5, VALUE_Y, 5, theme.peg, inClutch);
  value(ctx, `${orangeLeft}/${orangeTotal}`, x + ICON_GAP, VALUE_Y, 15,
    inClutch ? INK.orange : INK.cream, inClutch);
  x += wCibles + GUT;

  // — ŒUFS (icône œuf + compteur) ; section d'alerte chunky si peu d'œufs —
  divider(ctx, x - Math.round(GUT / 2));
  if (lowBalls) {
    // Section re-teintée en rouge pulsant — même silhouette arrondie (chunkPlate),
    // pas un rect nu : l'arrondi de la barre est préservé.
    const bgA = 0.30 + 0.24 * pulse;
    chunkPlate(ctx, x - 6, PLATE_Y + 3, wOeufs + 12, PLATE_H - 6, {
      fill: `rgba(150,26,8,${bgA.toFixed(3)})`,
      light: `rgba(255,120,80,${(0.5 + 0.3 * pulse).toFixed(3)})`,
      dark: "rgba(60,0,0,0.7)", highlightL: 0.3,
    });
  }
  label(ctx, "ŒUFS", x, LABEL_Y);
  ctx.save();
  if (lowBalls) ctx.globalAlpha = 0.55 + 0.45 * pulse;   // clignote quand il en reste peu
  eggSprite(ctx, x + 5, VALUE_Y, egg, 4);
  ctx.restore();
  value(ctx, `${s.balls}`, x + ICON_GAP, VALUE_Y, 15, lowBalls ? INK.warn : INK.cream, lowBalls);

  // ── Bouton pause (extrémité droite, plaque chunky) ──
  pauseButton(ctx);

  ctx.restore();
}

// Bouton pause : petite plaque chunky (DA partagée) + deux barres claires.
function pauseButton(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = PAUSE_HIT;
  chunkPlate(ctx, x, y, w, h, {
    fill: "rgba(20,30,16,0.82)", light: "rgba(150,180,110,0.55)",
    dark: "rgba(0,4,0,0.8)", outline: "rgba(0,4,0,0.85)", highlightL: 0.55,
  });
  const cx = x + Math.round(w / 2);
  const bh = Math.round(h * 0.46), by = y + Math.round((h - bh) / 2);
  ctx.fillStyle = "rgba(0,4,0,0.6)";
  ctx.fillRect(cx - 5, by - 1, 4, bh + 2); ctx.fillRect(cx + 1, by - 1, 4, bh + 2);
  ctx.fillStyle = INK.cream;
  ctx.fillRect(cx - 5, by, 3, bh); ctx.fillRect(cx + 2, by, 3, bh);
}
