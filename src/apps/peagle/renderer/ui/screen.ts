// ─── PRIMITIVES CANVAS « CARTE DIÉGÉTIQUE » — écrans PAUSE / GAME OVER ────────────
//
// Pendant canvas des overlays DOM `.pg-diag-*` (carte de pause / game over). Mêmes
// valeurs visuelles que peagle.css (couleurs, paddings, biseaux) répliquées au pixel.
// Module PUR : aucune dépendance React, aucun effet de bord — uniquement des fonctions
// qui dessinent dans un ctx déjà positionné/scalé par l'appelant (ScreenOverlayCanvas).
//
// Un écran = une liste de BLOCS (bubble / mascot / title / score / record / ranking /
// sep / buttons / tip). Pour chaque bloc : `measureBlock` (hauteur en px CSS, wrap-aware)
// + un `drawXxx`. L'appelant mesure tout (→ carte auto-dimensionnée comme la colonne
// flexbox DOM), centre la carte, puis dessine les blocs de haut en bas.
//
// Tout le texte passe par la fonte pixel (`pegText`/`FONT_BIG`/`FONT_EXT`) — cohérence
// pixel-art totale, y compris les pseudos accentués du classement (FONT_EXT).

import { ROLE } from "../../engine/palette";
import { alpha, wrapText } from "../helpers";
import { eagleFace, type FaceMood } from "../face";
import {
  drawPegButton, hitPeg, pegText, pegTextWidth,
  FONT_BIG, FONT_EXT, type PegRect, type PegVariant, type PegAnim,
} from "./peg-button";

// ── Échelles de dot (px par dot) des textes pixel, calées sur les tailles DOM ─────
// La fonte fait 8 dots de haut. Hauteur visible ≈ 7 dots utiles → on choisit des
// échelles ENTIÈRES (pixel net) approchant les font-size CSS.
const SC = {
  title: 2,   // ~16px (DOM 13px) — un peu plus gros, net
  score: 4,   // ~28px valeur de score
  scoreLabel: 1,
  record: 1,
  rankLabel: 1,
  rankName: 1,
  rankScore: 1,
  tipLabel: 1,
  tipBody: 2,
  bubble: 2,
  hint: 1,
} as const;

// Hauteur en px d'un texte pixel à l'échelle `sc` (7 dots utiles sur 8).
const lineH = (sc: number) => 7 * sc;

// ── Couleurs (tokens palette + hardcodes CSS du classement / bulle) ───────────────
const C = {
  cardBg: ROLE.surface,        // #142208
  ink: ROLE.ink,               // #060d02
  bevelHi: ROLE.bevelHi,       // #66a234
  bevelLo: ROLE.bevelLo,       // #0c1d07
  cream: ROLE.cream,           // #f2e6c2
  textMuted: ROLE.textMuted,   // #88a86c
  gold: ROLE.gold,             // #ffd24a
  red: ROLE.red,               // #ff5544
  greenHi: ROLE.accentHi,      // #b4ec6a
  green: ROLE.accent,          // #8fd83e
  leafDim: ROLE.leafDim,       // #56922a
  text: ROLE.text,             // #dcf5b6
  // hardcodes du CSS
  bubbleBg: "#f5f0d8", bubbleBorder: "#222", bubbleInk: "#1a1a1a",
  rankLabel: "#c9a23a",
  sep: "#2e5220",
  tipBg: "rgba(6,14,4,0.55)", tipBorder: "rgba(46,82,32,0.55)", tipBorderGo: "rgba(96,64,16,0.5)",
  rankBg0: "rgba(20,28,10,0.42)", rankBg1: "rgba(6,12,4,0.42)",
  meBg: "rgba(126,209,58,0.14)", meRing: "rgba(126,209,58,0.28)",
} as const;

const BADGE: Record<string, { top: string; bot: string; border: string; ink: string }> = {
  gold:   { top: "#ffe870", bot: "#c49010", border: "#7a5808", ink: "#160a00" },
  silver: { top: "#e8e8f0", bot: "#8090a0", border: "#5a6878", ink: "#101418" },
  bronze: { top: "#d09050", bot: "#805020", border: "#5a3010", ink: "#140800" },
  plain:  { top: "#1c3a12", bot: "#1c3a12", border: "#0a1c08", ink: C.textMuted },
};

// ─────────────────────────────────────────────────────────────────────────────────
// MODÈLE DE BLOCS
// ─────────────────────────────────────────────────────────────────────────────────

export type MascotSpec =
  | { kind: "pause" }
  | { kind: "gameover"; variant: 0 | 1 | 2 };

export interface ScreenButtonDef {
  label: string;
  variant: PegVariant;
  tint?: string;          // surcharge d'encre (boutons dev violets)
  onClick: () => void;
}

export type RankRowModel = {
  rank: number | "—";
  name: string;
  score: number;
  me: boolean;
  suffix?: string;        // " · you" / " · outside top 10"
};
export type RankingModel =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "rows"; rows: RankRowModel[]; gapBeforeLast: boolean; hint?: string };

export type ScreenBlock =
  | { kind: "bubble"; text: string }
  | { kind: "mascot"; spec: MascotSpec }
  | { kind: "title"; text: string; glow: "lost" | "pause" }
  | { kind: "score"; label: string; value: string }
  | { kind: "record"; text: string }
  | { kind: "ranking"; model: RankingModel }
  | { kind: "sep" }
  | { kind: "buttons"; items: ScreenButtonDef[]; caption?: string }
  | { kind: "tip"; label: string; text: string; go?: boolean };

// État d'anim global passé à chaque draw (élapsé depuis le reveal + horloge absolue).
export interface ScreenAnim {
  elapsed: number;   // s depuis l'ouverture de l'écran
  now: number;       // s (performance.now()/1000) pour les pulses/bob
}

// Hit-rects des boutons collectés pendant le dessin (lus par le pointer du composant).
export interface ButtonHit { rect: PegRect; onClick: () => void }

// ── Géométrie de carte (px CSS) ───────────────────────────────────────────────────
export const CARD_PAD_X = 16;
export const CARD_PAD_Y = 18;
const BLOCK_GAP = 8;
const PLAY_H = 50, SEC_H = 40, BTN_GAP = 8;
const BTN_W_RATIO = 0.72;     // min(230, 0.72*card) côté DOM
const MASCOT_GO = 100, MASCOT_PAUSE = 60;

// ── Largeur d'un bouton dans la carte ─────────────────────────────────────────────
const btnWidth = (cardW: number) => Math.min(230, Math.round(cardW * BTN_W_RATIO));

// ─────────────────────────────────────────────────────────────────────────────────
// MESURE
// ─────────────────────────────────────────────────────────────────────────────────

// Lignes wrappées d'un texte pixel à l'échelle `sc`, dans `maxW` px.
function wrapPixel(text: string, sc: number, maxW: number, ext = false): string[] {
  const font = ext ? FONT_EXT : FONT_BIG;
  const space = (font.w + font.gap) * sc;
  return wrapText(text, maxW, (w) => font.cols(w) * sc, space);
}

export function measureBlock(block: ScreenBlock, cardW: number): number {
  switch (block.kind) {
    case "bubble": {
      const maxW = Math.min(260, Math.round(cardW * 0.82)) - 32;  // - padding bulle
      const lines = wrapPixel(block.text, SC.bubble, maxW, true);
      return lines.length * (lineH(SC.bubble) + 3) + 18 + 11;     // padding 9*2 + queue 11
    }
    case "mascot":
      return block.spec.kind === "gameover" ? MASCOT_GO * 32 / 28 : MASCOT_PAUSE * 32 / 28;
    case "title":
      return lineH(SC.title) + 10;
    case "score":
      return lineH(SC.scoreLabel) + 4 + lineH(SC.score) + 8;
    case "record":
      return lineH(SC.record) + 4;
    case "ranking":
      return measureRanking(block.model);
    case "sep":
      return 1 + 12;
    case "buttons": {
      let h = block.caption ? lineH(SC.tipLabel) + 4 : 0;
      block.items.forEach((b, i) => {
        h += (b.variant === "play" ? PLAY_H : SEC_H) + (i > 0 ? BTN_GAP : 0);
      });
      return h;
    }
    case "tip": {
      const maxW = Math.min(260, Math.round(cardW * 0.84)) - 24;
      const lines = wrapPixel(block.text, SC.tipBody, maxW, true);
      return lineH(SC.tipLabel) + 3 + lines.length * (lineH(SC.tipBody) + 2) + 14;
    }
  }
}

function measureRanking(model: RankingModel): number {
  if (model.kind === "loading") return lineH(SC.hint) + 16;
  if (model.kind === "empty") return 0;
  const rowH = 18 + 2;
  let h = lineH(SC.rankLabel) + 5;       // label "HUNTERS' SKY"
  h += model.rows.length * rowH;
  if (model.gapBeforeLast) h += 8;        // marqueur ⋮
  if (model.hint) h += lineH(SC.hint) + 4;
  return h + 16;                          // padding 8*2
}

// Hauteur totale (carte sans padding vertical) d'une liste de blocs + gaps.
export function measureScreen(blocks: ScreenBlock[], cardW: number): number {
  let h = 0;
  blocks.forEach((b, i) => {
    const bh = measureBlock(b, cardW);
    if (bh <= 0) return;
    h += bh + (i > 0 ? BLOCK_GAP : 0);
  });
  return h;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DESSIN — coquille
// ─────────────────────────────────────────────────────────────────────────────────

// Backdrop plein écran (scanlines + voile vert ; rouge radial en variante lost).
export function drawBackdrop(
  ctx: CanvasRenderingContext2D, w: number, h: number, variant: "pause" | "lost", a = 1,
): void {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(3,6,2,0.64)";
  ctx.fillRect(0, 0, w, h);
  if (variant === "lost") {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, "rgba(4,2,2,0.0)");
    g.addColorStop(1, "rgba(70,8,4,0.84)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // scanlines 1px toutes les 4px
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  for (let y = 3; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

// Cadre de carte : ombre portée + corps + biseau + bordure ink (réplique .pg-diag-card).
export function drawCardFrame(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): void {
  // ombre portée 6,7
  ctx.fillStyle = "rgba(3,8,2,0.7)";
  ctx.fillRect(x + 6, y + 7, w, h);
  // corps
  ctx.fillStyle = C.cardBg;
  ctx.fillRect(x, y, w, h);
  // biseau inset 2px : clair haut/gauche, sombre bas/droite
  ctx.fillStyle = C.bevelHi;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = C.bevelLo;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
  // bordure ink 3px (par-dessus, vers l'extérieur du biseau)
  ctx.fillStyle = C.ink;
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.fillRect(x, y, 3, h);
  ctx.fillRect(x + w - 3, y, 3, h);
}

// ─────────────────────────────────────────────────────────────────────────────────
// DESSIN — blocs. Chaque drawXxx dessine centré horizontalement dans [x, x+cardW],
// à partir de `y` (haut du bloc), et est responsable de SA hauteur (= measureBlock).
// `cy` interne calculé au besoin. Renvoie void ; buttons pousse dans `hits`.
// ─────────────────────────────────────────────────────────────────────────────────

function centerX(x: number, cardW: number) { return x + cardW / 2; }

export function drawBubble(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, cardW: number,
): void {
  const maxW = Math.min(260, Math.round(cardW * 0.82)) - 32;
  const lines = wrapPixel(text, SC.bubble, maxW, true);
  const textW = Math.max(...lines.map((l) => pegTextWidth(l, SC.bubble, FONT_EXT)));
  const padX = 16, padY = 9, tail = 11;
  const boxW = textW + padX * 2;
  const boxH = lines.length * (lineH(SC.bubble) + 3) - 3 + padY * 2;
  const bx = centerX(x, cardW) - boxW / 2;
  // bulle
  ctx.fillStyle = C.bubbleBorder; ctx.fillRect(bx - 2, y - 2, boxW + 4, boxH + 4);
  ctx.fillStyle = C.bubbleBg; ctx.fillRect(bx, y, boxW, boxH);
  // queue vers le bas (triangle)
  const tcx = centerX(x, cardW);
  ctx.fillStyle = C.bubbleBorder;
  for (let i = 0; i < tail; i++) ctx.fillRect(tcx - (tail - i), y + boxH + i, (tail - i) * 2, 1);
  ctx.fillStyle = C.bubbleBg;
  for (let i = 0; i < tail - 3; i++) ctx.fillRect(tcx - (tail - 3 - i), y + boxH - 1 + i, (tail - 3 - i) * 2, 1);
  // texte (encre sombre, sans reflet clair — la bulle est claire)
  let ty = y + padY + lineH(SC.bubble) / 2;
  for (const ln of lines) {
    pegInk(ctx, ln, tcx, ty, SC.bubble, "center", FONT_EXT, C.bubbleInk);
    ty += lineH(SC.bubble) + 3;
  }
}

// Variante de pegText SANS le reflet clair (1 seule passe encre) — pour la bulle claire.
function pegInk(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sc: number,
  align: CanvasTextAlign, font: typeof FONT_EXT, ink: string,
): void {
  const wPix = pegTextWidth(text, sc, font);
  const hPix = font.rows * sc;
  let ox = Math.round(x);
  if (align === "center") ox = Math.round(x - wPix / 2);
  else if (align === "right") ox = Math.round(x - wPix);
  const oy = Math.round(y - hPix / 2);
  ctx.fillStyle = ink;
  let cx = ox;
  for (const ch of text) {
    const g = font.glyph(ch);
    for (let r = 0; r < font.rows; r++) {
      const row = g[r]!;
      for (let c = 0; c < font.w; c++) if (row[c] === "#") ctx.fillRect(cx + c * sc, oy + r * sc, sc, sc);
    }
    cx += (font.w + font.gap) * sc;
  }
}

export function drawMascot(
  ctx: CanvasRenderingContext2D, spec: MascotSpec, x: number, y: number, cardW: number,
  anim: ScreenAnim, look: number,
): void {
  const px = spec.kind === "gameover" ? MASCOT_GO : MASCOT_PAUSE;
  const h = px * 32 / 28;
  const mood = spec.kind === "gameover"
    ? gameOverMood(anim.elapsed, spec.variant)
    : pauseMood(anim.now, look);
  // bob léger (réplique pg-gameover-face-bob / respiration)
  const bob = spec.kind === "gameover" ? Math.sin(anim.now * (Math.PI * 2 / 3.6)) * 2 : 0;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(centerX(x, cardW), y + h / 2 + bob);
  ctx.scale(px / 28, px / 28);
  eagleFace(ctx, 0, 0, mood);
  ctx.restore();
}

export function drawTitle(
  ctx: CanvasRenderingContext2D, text: string, glow: "lost" | "pause",
  x: number, y: number, cardW: number, anim: ScreenAnim,
): void {
  const cx = centerX(x, cardW);
  const ty = y + lineH(SC.title) / 2 + 2;
  const color = glow === "lost" ? C.red : C.greenHi;
  // glow pulsant 1.3s (lost) — fill translucide derrière
  if (glow === "lost") {
    const pulse = 0.4 + 0.4 * Math.sin(anim.now * (Math.PI * 2 / 1.3));
    ctx.save();
    ctx.globalAlpha = pulse;
    pegInk(ctx, text, cx, ty, SC.title, "center", FONT_BIG, alpha(C.red, 0.6));
    ctx.restore();
  }
  pegText(ctx, text, cx, ty, SC.title, "center", FONT_BIG, color);
}

export function drawScore(
  ctx: CanvasRenderingContext2D, label: string, value: string,
  x: number, y: number, cardW: number,
): void {
  const cx = centerX(x, cardW);
  pegText(ctx, label, cx, y + lineH(SC.scoreLabel) / 2, SC.scoreLabel, "center", FONT_BIG, C.textMuted);
  const vy = y + lineH(SC.scoreLabel) + 4 + lineH(SC.score) / 2;
  // ombre noire en couches
  pegInk(ctx, value, cx, vy + 3, SC.score, "center", FONT_BIG, "rgba(0,0,0,0.9)");
  pegText(ctx, value, cx, vy, SC.score, "center", FONT_BIG, C.cream);
}

export function drawRecord(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, cardW: number, anim: ScreenAnim,
): void {
  const pulse = 0.7 + 0.3 * Math.sin(anim.now * (Math.PI * 2 / 1.0));
  ctx.save();
  ctx.globalAlpha = pulse;
  pegText(ctx, text, centerX(x, cardW), y + lineH(SC.record) / 2, SC.record, "center", FONT_BIG, C.gold);
  ctx.restore();
}

export function drawSep(ctx: CanvasRenderingContext2D, x: number, y: number, cardW: number): void {
  const cx = centerX(x, cardW);
  const w = 48;
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, "rgba(46,82,32,0)");
  g.addColorStop(0.5, C.sep);
  g.addColorStop(1, "rgba(46,82,32,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, y + 6, w, 1);
}

export function drawTip(
  ctx: CanvasRenderingContext2D, label: string, text: string, go: boolean,
  x: number, y: number, cardW: number,
): void {
  const maxW = Math.min(260, Math.round(cardW * 0.84)) - 24;
  const lines = wrapPixel(text, SC.tipBody, maxW, true);
  const textW = Math.max(...lines.map((l) => pegTextWidth(l, SC.tipBody, FONT_EXT)), pegTextWidth(label, SC.tipLabel, FONT_BIG));
  const boxW = textW + 24;
  const boxH = lineH(SC.tipLabel) + 3 + lines.length * (lineH(SC.tipBody) + 2) - 2 + 14;
  const bx = centerX(x, cardW) - boxW / 2;
  ctx.fillStyle = C.tipBg; ctx.fillRect(bx, y, boxW, boxH);
  ctx.strokeStyle = go ? C.tipBorderGo : C.tipBorder; ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, y + 0.5, boxW - 1, boxH - 1);
  const cx = centerX(x, cardW);
  pegText(ctx, label, cx, y + 7 + lineH(SC.tipLabel) / 2, SC.tipLabel, "center", FONT_BIG, C.gold);
  let ty = y + 7 + lineH(SC.tipLabel) + 3 + lineH(SC.tipBody) / 2;
  for (const ln of lines) {
    pegText(ctx, ln, cx, ty, SC.tipBody, "center", FONT_EXT, C.text);
    ty += lineH(SC.tipBody) + 2;
  }
}

// ── Boutons : dessine la pile, enregistre les hit-rects + leur onClick ─────────────
export function drawButtons(
  ctx: CanvasRenderingContext2D, items: ScreenButtonDef[], caption: string | undefined,
  x: number, y: number, cardW: number, anim: ScreenAnim,
  springs: PegAnim[], baseIdx: number, hits: ButtonHit[],
): void {
  const cx = centerX(x, cardW);
  const w = btnWidth(cardW);
  let cy = y;
  if (caption) {
    pegText(ctx, caption, cx, cy + lineH(SC.tipLabel) / 2, SC.tipLabel, "center", FONT_BIG, ROLE.purpleHi);
    cy += lineH(SC.tipLabel) + 4;
  }
  items.forEach((b, i) => {
    const idx = baseIdx + i;
    const h = b.variant === "play" ? PLAY_H : SEC_H;
    if (i > 0) cy += BTN_GAP;
    const rect: PegRect = { x: Math.round(cx - w / 2), y: Math.round(cy), w, h };
    // stagger d'entrée
    const local = Math.max(0, Math.min(1, (anim.elapsed - 0.16 - idx * 0.05) / 0.28));
    ctx.save();
    ctx.globalAlpha = local;
    ctx.translate(0, (1 - local) * 12);
    drawPegButton(ctx, rect, b.label, {
      variant: b.variant,
      anim: springs[idx],
      textScale: b.variant === "play" ? 2.6 : 1.7,
      shadowOff: 4,
      lift: true,
    });
    ctx.restore();
    hits.push({ rect, onClick: b.onClick });
    cy += h;
  });
}

export function drawRanking(
  ctx: CanvasRenderingContext2D, model: RankingModel, x: number, y: number, cardW: number,
): void {
  if (model.kind === "empty") return;
  const panelW = Math.min(248, Math.round(cardW * 0.84));
  const px = centerX(x, cardW) - panelW / 2;
  const h = measureRanking(model);
  // panneau dégradé
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, C.rankBg0); g.addColorStop(1, C.rankBg1);
  ctx.fillStyle = g; ctx.fillRect(px, y, panelW, h);

  if (model.kind === "loading") {
    pegText(ctx, "READING THE REGISTRY...", centerX(x, cardW), y + h / 2, SC.hint, "center", FONT_BIG, C.textMuted);
    return;
  }

  const pad = 10;
  let cy = y + 8;
  pegText(ctx, "HUNTERS' SKY", centerX(x, cardW), cy + lineH(SC.rankLabel) / 2, SC.rankLabel, "center", FONT_BIG, C.rankLabel);
  cy += lineH(SC.rankLabel) + 5;

  const innerX = px + pad, innerW = panelW - pad * 2;
  const badgeW = 18, gap = 8;
  const scoreColW = 70;
  const nameX = innerX + badgeW + gap;
  const nameMaxW = innerW - badgeW - gap - scoreColW - gap;

  model.rows.forEach((row, i) => {
    if (model.gapBeforeLast && i === model.rows.length - 1) {
      // marqueur ⋮ centré avant la dernière ligne
      pegText(ctx, "⋮", centerX(x, cardW), cy + 4, SC.rankName, "center", FONT_EXT, C.textMuted);
      cy += 8;
    }
    const rowY = cy, rowH = 18;
    if (row.me) {
      ctx.fillStyle = C.meBg; ctx.fillRect(innerX - 2, rowY - 1, innerW + 4, rowH + 2);
      ctx.strokeStyle = C.meRing; ctx.lineWidth = 1;
      ctx.strokeRect(innerX - 1.5, rowY - 0.5, innerW + 3, rowH + 1);
    }
    // badge
    drawBadge(ctx, innerX, rowY, badgeW, row.rank);
    // nom (+ suffixe), tronqué
    const fullName = row.name + (row.suffix ?? "");
    const name = truncate(fullName, SC.rankName, nameMaxW);
    pegText(ctx, name, nameX, rowY + rowH / 2, SC.rankName, "left", FONT_EXT,
      row.me ? C.greenHi : C.text);
    // score à droite
    pegText(ctx, row.score.toLocaleString(), innerX + innerW, rowY + rowH / 2, SC.rankScore, "right", FONT_BIG, C.cream);
    cy += rowH + 2;
  });

  if (model.hint) {
    pegText(ctx, model.hint.toUpperCase(), centerX(x, cardW), cy + lineH(SC.hint) / 2 + 2, SC.hint, "center", FONT_BIG, C.textMuted);
  }
}

function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rank: number | "—"): void {
  const kind = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "plain";
  const b = BADGE[kind]!;
  const g = ctx.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, b.top); g.addColorStop(0.45, b.top); g.addColorStop(1, b.bot);
  ctx.fillStyle = g; ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = b.border; ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  const label = rank === "—" ? "-" : String(rank);
  pegInk(ctx, label, x + size / 2, y + size / 2, 1, "center", FONT_BIG as typeof FONT_EXT, b.ink);
}

// Tronque un texte pixel à `maxW` px, ajoute « … » si coupé.
function truncate(text: string, sc: number, maxW: number): string {
  if (pegTextWidth(text, sc, FONT_EXT) <= maxW) return text;
  const chars = [...text];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const next = out + chars[i] + "…";
    if (pegTextWidth(next, sc, FONT_EXT) > maxW) break;
    out += chars[i];
  }
  return out + "…";
}

// ─────────────────────────────────────────────────────────────────────────────────
// MASCOTTE — moods portés depuis GameCanvas (PauseMascot / GameOverMascot)
// ─────────────────────────────────────────────────────────────────────────────────

export function pauseMood(t: number, look: number): FaceMood {
  return {
    blink: (t % 4.2) < 0.12 ? "both" : "none",
    open: 0, brow: "flat", eyeRed: false, wide: false,
    look, pop: 0, starEyes: false, tears: false, drowsyEyes: false, recoil: 0,
  };
}

export function gameOverMood(t: number, variant: 0 | 1 | 2): FaceMood {
  const crying = t < 2.2;
  let brow: FaceMood["brow"];
  let eyeRed = false, wide = false, tears = false, look: number;
  if (variant === 0) { brow = "angry"; eyeRed = true; wide = true; look = Math.sin(t * 9) * 0.6; }
  else if (variant === 1) { brow = "angry"; look = 0.65 + 0.55 * Math.sin(t * 0.38); }
  else { brow = "up"; tears = true; look = Math.sin(t * 0.5) * 0.5; }

  const blinkT = t % 6.4;
  const blink: FaceMood["blink"] = (!crying && blinkT < 0.13) ? "both" : "none";
  const cryAmp = variant === 0 ? 1.0 : variant === 2 ? 0.72 : 0.9;

  let open: number;
  if (crying) {
    const atk = Math.min(1, t / 0.06);
    const rel = Math.min(1, (2.2 - t) / 0.3);
    const flutter = 0.85 + 0.15 * Math.sin(t * (variant === 0 ? 34 : 26));
    open = Math.max(0, Math.min(1, atk * rel * flutter)) * cryAmp;
  } else if (variant === 0) {
    const c = t % 1.6; open = c < 0.18 ? 0.5 * Math.sin((c / 0.18) * Math.PI) : 0;
  } else if (variant === 1) {
    const c = t % 7.0; open = c > 4.2 && c < 5.1 ? 0.32 * Math.sin(((c - 4.2) / 0.9) * Math.PI) : 0;
  } else {
    open = Math.max(0, 0.1 + 0.1 * Math.sin(t * 5.5));
  }

  return { blink, open, brow, eyeRed, wide, look, pop: 0, starEyes: false, tears, drowsyEyes: false, recoil: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────────
// Helpers de comptage (boutons) pour le composant React
// ─────────────────────────────────────────────────────────────────────────────────

// Nb total de boutons dans une liste de blocs (pour dimensionner les ressorts).
export function countButtons(blocks: ScreenBlock[]): number {
  return blocks.reduce((n, b) => n + (b.kind === "buttons" ? b.items.length : 0), 0);
}

export { hitPeg };
