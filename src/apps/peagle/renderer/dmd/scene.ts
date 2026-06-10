// ─── DMD · Scènes (modèle data + hooks) ──────────────────────────────────────
//
// Une SCÈNE déclare CE qu'elle affiche (layers), QUAND (timeline) et COMMENT
// (effects). Les moments créatifs irréductibles (un burst de particules, une pluie
// de dots) passent par un hook `custom(buf, api)`. Le `ScenePlayer` orchestre le
// cycle de vie : transition d'ENTRÉE → JEU → fondu de SORTIE → idle.
//
// Tout se compose dans UN buffer couvrant tout le verre ; les « bandes » de
// l'afficheur multi-lignes sont des RÉGIONS (offset de lignes) — cf. BANDS.

import { DotBuffer, stampMatrix, stampDot } from "./raster";
import { glyph, textCols, GLYPH_W, GLYPH_GAP, GLYPH_ROWS } from "./font";
import { Timeline } from "./tween";
import { applyEffects, type Effect, type EffectCtx } from "./effects";

// ── Régions (bandes) du verre ────────────────────────────────────────────────
// Le verre fait DMD_ROWS_TOTAL lignes. Deux bandes de GLYPH_ROWS + 1 gap. Une scène
// place ses layers via un nom de bande ; le player traduit en offset de ligne.
export const BAND_GAP = 1;
export const DMD_ROWS_TOTAL = GLYPH_ROWS * 2 + BAND_GAP;   // 15
export type Band = "top" | "bot" | "full";

export function bandRow0(band: Band): number {
  return band === "bot" ? GLYPH_ROWS + BAND_GAP : 0;
}
export function bandRows(band: Band): number {
  return band === "full" ? DMD_ROWS_TOTAL : GLYPH_ROWS;
}

// ── Layers ───────────────────────────────────────────────────────────────────
// Un layer = un élément visuel. Position en COLONNES/LIGNES de dots. `col`/`row` sont
// soit fixes, soit "center" (centré horizontalement dans le verre), soit liés à une
// piste de timeline (`colTrack`). `effects` module rendu/position. `value` 0..1 =
// intensité de base.
export interface BaseLayer {
  band?: Band;            // bande cible (def: "top")
  row?: number;           // ligne dans la bande (def: 0)
  col?: number | "center"; // colonne (def: "center")
  colTrack?: string;      // si défini, la colonne vient de cette piste (en colonnes)
  rowTrack?: string;      // idem pour la ligne
  effects?: Effect[];
  value?: number;         // intensité de base 0..1 (def: 1)
  ink?: InkName;          // surcharge d'encre (def: encre de la scène)
}

export interface TextLayer extends BaseLayer {
  kind: "text";
  text: string | ((tl: Timeline) => string);   // statique ou dérivé de la timeline
}
export interface SpriteLayer extends BaseLayer {
  kind: "sprite";
  // Matrice statique, ou fonction qui la dérive de la timeline (ex. frame d'œuf).
  matrix: readonly string[] | ((tl: Timeline) => readonly string[]);
  w?: number;   // largeur connue (pour le centrage) ; sinon = longueur 1re ligne
}
export type Layer = TextLayer | SpriteLayer;

// Noms d'encre symboliques (résolus côté player vers un DmdInk concret).
export type InkName = "base" | "hot" | "blue" | "orange" | "gold";

// ── Définition de scène ──────────────────────────────────────────────────────
export interface SceneApi {
  buf: DotBuffer;
  cols: number;          // largeur du verre en colonnes
  tl: Timeline;
  ctx: EffectCtx;
  value: number;         // intensité globale courante (pulse/fade de la scène)
  // Helper : stampe un dot dans la région d'une bande (coordonnées bande-locales).
  dot(band: Band, c: number, r: number, v: number): void;
}

export interface SceneDef {
  dur: number;                          // durée de JEU en frames
  transition?: TransitionKind;          // transition d'entrée (def: "wipe")
  ink?: InkName;                        // encre par défaut de la scène (def: "base")
  hot?: boolean;                        // force l'encre chaude (fever) sur toute la scène
  build?: (tl: Timeline) => void;       // déclare les pistes de la timeline
  layers?: Layer[];                     // layers déclaratifs
  custom?: (api: SceneApi) => void;     // hook créatif (burst, pluie…) — stampé APRÈS les layers
  fullTakeover?: boolean;               // scène plein-largeur (prend les 2 emplacements)
}

// ── Transitions d'entrée ─────────────────────────────────────────────────────
export type TransitionKind = "wipe" | "shutter" | "dissolve" | "iris" | "none";

// Pose le clip de révélation d'une transition. `p` 0..1 progression. La géométrie est
// donnée en COLONNES/LIGNES de dots → on convertit en px via pitch.
export interface ClipGeom {
  x: number; y: number; cols: number; rows: number; pitch: number;
}
export function applyTransitionClip(
  ctx: CanvasRenderingContext2D, kind: TransitionKind, p: number, g: ClipGeom,
): void {
  if (kind === "none") return;
  const wPix = g.cols * g.pitch, hPix = g.rows * g.pitch;
  ctx.beginPath();
  switch (kind) {
    case "wipe":
      ctx.rect(g.x, g.y, Math.floor(p * g.cols) * g.pitch, hPix);
      break;
    case "shutter": {
      const half = hPix / 2, open = p * half;
      ctx.rect(g.x, g.y + half - open, wPix, open * 2);
      break;
    }
    case "iris": {
      const cx = g.x + wPix / 2, cy = g.y + hPix / 2;
      const r = (p * Math.hypot(wPix, hPix)) / 2;
      ctx.arc(cx, cy, Math.max(0.01, r), 0, Math.PI * 2);
      break;
    }
    case "dissolve": {
      for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
          const h = Math.abs(Math.sin(c * 12.9898 + r * 78.233) * 43758.5453);
          if (h - Math.floor(h) < p) ctx.rect(g.x + c * g.pitch, g.y + r * g.pitch, g.pitch, g.pitch);
        }
      }
      break;
    }
  }
  ctx.clip();
}

// ── Stamping des layers ──────────────────────────────────────────────────────
// Stampe tous les layers d'une scène dans le buffer (région-relatif). Renvoie une
// liste d'« encres demandées » par layer pour que le compositor sache quelle teinte
// utiliser — mais comme un buffer = une encre, on regroupe : les layers non-"base"
// sont stampés dans des passes séparées côté player. Ici on ne stampe QUE les layers
// d'une encre donnée (filtre `inkFilter`).
export function stampLayers(
  buf: DotBuffer, layers: Layer[], cols: number, tl: Timeline, ctx: EffectCtx,
  globalValue: number, inkFilter: InkName,
): void {
  for (const layer of layers) {
    if ((layer.ink ?? "base") !== inkFilter) continue;
    const eff = applyEffects(layer.effects, ctx);
    if (!eff.visible) continue;

    const band = layer.band ?? "top";
    const r0 = bandRow0(band) + (layer.rowTrack ? tl.value(layer.rowTrack) : (layer.row ?? 0)) + eff.dy;

    if (layer.kind === "text") {
      const full = typeof layer.text === "function" ? layer.text(tl) : layer.text;
      const shown = eff.reveal >= 1 ? full : full.slice(0, Math.max(0, Math.round(full.length * eff.reveal)));
      const w = textCols(shown);
      const c0 = resolveCol(layer, cols, w, tl) + eff.dx;
      stampText(buf, shown, c0, Math.round(r0), (layer.value ?? 1) * globalValue * eff.mult);
    } else {
      const matrix = typeof layer.matrix === "function" ? layer.matrix(tl) : layer.matrix;
      const w = layer.w ?? (matrix[0]?.length ?? 0);
      const c0 = resolveCol(layer, cols, w, tl) + eff.dx;
      stampMatrix(buf, matrix, Math.round(c0), Math.round(r0), (layer.value ?? 1) * globalValue * eff.mult);
    }
  }
}

function resolveCol(layer: Layer, cols: number, w: number, tl: Timeline): number {
  if (layer.colTrack) return tl.value(layer.colTrack);
  if (layer.col === "center" || layer.col === undefined) return Math.floor((cols - w) / 2);
  return layer.col;
}

// Stamp du texte (police 5×7) à partir de la colonne `c0`, ligne `r0`.
export function stampText(buf: DotBuffer, text: string, c0: number, r0: number, value: number): void {
  let col = c0;
  for (const ch of text) {
    stampMatrix(buf, glyph(ch), col, r0, value);
    col += GLYPH_W + GLYPH_GAP;
  }
}

// Quelles encres une scène utilise-t-elle ? (pour les passes de composite par teinte).
export function sceneInks(def: SceneDef): InkName[] {
  const set = new Set<InkName>([def.ink ?? "base"]);
  for (const l of def.layers ?? []) set.add(l.ink ?? "base");
  return [...set];
}

// petit helper exporté pour les hooks custom.
export { stampDot };
