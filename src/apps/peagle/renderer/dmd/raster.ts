// ─── DMD · Raster (DotBuffer + compositor) ───────────────────────────────────
//
// La COUCHE 1 du moteur DMD : un afficheur à points façon flipper plasma 90s.
// Tout le contenu allumé du verre (texte, sprites, scènes) est composé dans un
// `DotBuffer` — une grille d'intensités 0..1 — puis rendu en UNE passe : afterglow
// plasma + bloom + micro-scintillement. Plus aucune scène ne dessine d'arc : elles
// stampent des dots, et le compositor s'occupe du look.
//
// Avantages de ce point de passage unique :
//   • afterglow « comète » : un dot éteint décroît sur ~3 frames au lieu de claquer ;
//   • bruit plasma stable (pas de Math.random) appliqué une fois au composite ;
//   • un seul endroit où régler/optimiser le rendu des dots.
//
// Modèle : UNE grille couvre tout le verre. Les « bandes » de l'afficheur multi-
// lignes sont de simples RÉGIONS (offset de lignes) dans cette même grille — ce qui
// rend les scènes plein-écran et les transitions triviales.

import { ROLE, RAMP } from "../../engine/palette";
import { alpha } from "../helpers";

// ── Encre du DMD ─────────────────────────────────────────────────────────────
// Quatre teintes : corps du dot allumé, surbrillance (centre), trame éteinte
// (toujours visible) et halo bloom. Dérivées de la palette « Bosquet » → re-thémables.
export interface DmdInk {
  on: string;    // point allumé (corps)
  onHi: string;  // surbrillance du point allumé (centre)
  off: string;   // point éteint (grille de fond, toujours visible)
  glow: string;  // halo bloom autour des points allumés
}

export const DMD_AMBER: DmdInk = {  // encre de BASE du DMD (score, total, démo au repos) — blanc pur LED,
  // sobre : laisse la couleur aux events (compteur pegs vert, cibles orange, fever rouge).
  on: "#ffffff", onHi: "#ffffff", off: alpha(RAMP.green[800], 0.32), glow: "rgba(255,255,255,0.42)",
};
export const DMD_HOT: DmdInk = {   // fever : rouge-orange chaud
  on: ROLE.orange, onHi: ROLE.gold, off: alpha(ROLE.red, 0.32), glow: alpha(ROLE.red, 0.55),
};
export const DMD_BLUE: DmdInk = {  // compteur des pegs « normaux » — suit leur couleur (vert forêt)
  on: RAMP.green[400], onHi: RAMP.green[200], off: alpha(RAMP.green[400], 0.26), glow: alpha(RAMP.green[300], 0.7),
};
export const DMD_ORANGE: DmdInk = {  // compteur « cibles oranges »
  on: ROLE.orange, onHi: ROLE.gold, off: alpha(ROLE.orange, 0.26), glow: alpha(ROLE.orangeGlow, 0.7),
};
export const DMD_GOLD: DmdInk = {  // éclat de victoire (record, jackpot final)
  on: RAMP.gold[300], onHi: RAMP.gold[100], off: alpha(ROLE.goldDark, 0.28), glow: alpha(RAMP.gold[100], 0.7),
};

// ── DotBuffer ────────────────────────────────────────────────────────────────
// Grille d'intensités. `cur` = ce qui est stampé CETTE frame (remis à 0 par clear).
// `glow` = la rémanence (afterglow) qui survit entre les frames : à chaque composite,
// glow ← max(cur, glow*decay). C'est `glow` qui porte la traînée plasma. Un buffer est
// identifié par une CLÉ stable (ex. "verre") pour que sa rémanence persiste.
export interface DotBuffer {
  cols: number;
  rows: number;
  cur: Float32Array;
  glow: Float32Array;
}

const DECAY = 0.7;   // décroissance de l'afterglow par frame (~3 frames de traînée)

const _buffers = new Map<string, DotBuffer>();
const _touched = new Set<string>();   // buffers composés cette frame (decay-on-skip)

// Récupère (ou (ré)alloue) un DotBuffer pour une clé+géométrie. La rémanence persiste
// tant que cols×rows ne change pas. On efface `cur` (frame stampée vierge), pas `glow`.
export function getBuffer(key: string, cols: number, rows: number): DotBuffer {
  const b = _buffers.get(key);
  if (b && b.cols === cols && b.rows === rows) {
    b.cur.fill(0);
    return b;
  }
  const fresh: DotBuffer = {
    cols, rows, cur: new Float32Array(cols * rows), glow: new Float32Array(cols * rows),
  };
  _buffers.set(key, fresh);
  return fresh;
}

// ── Stamping (écriture dans le buffer) ───────────────────────────────────────
// `value` 0..1 ; on prend le MAX pour que deux stamps qui se chevauchent ne s'effacent
// pas. Bornes sûres. `c`/`r` peuvent être négatifs (clippés) → scroll/slide gratuits.
export function stampDot(buf: DotBuffer, c: number, r: number, value: number): void {
  if (c < 0 || c >= buf.cols || r < 0 || r >= buf.rows) return;
  const i = r * buf.cols + c;
  if (value > buf.cur[i]!) buf.cur[i] = value;
}

// Stamp une MATRICE de dots ("#"=allumé, autre=éteint) à l'offset (c0,r0).
export function stampMatrix(
  buf: DotBuffer, matrix: readonly string[], c0: number, r0: number, value = 1,
): void {
  for (let r = 0; r < matrix.length; r++) {
    const line = matrix[r]!;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === "#") stampDot(buf, c0 + c, r0 + r, value);
    }
  }
}

// ── Decay-on-skip ────────────────────────────────────────────────────────────
// Un buffer persistant non composé pendant N frames garderait sa rémanence figée →
// « ghost flash » au retour. On appelle ceci UNE FOIS par frame, après tout le rendu :
// tout buffer persistant (clé "dmd:*") non touché cette frame voit sa rémanence
// décroître comme s'il avait été composé vide.
export function decayUntouched(): void {
  for (const [key, b] of _buffers) {
    if (!key.startsWith("dmd:") || _touched.has(key)) continue;
    const g = b.glow;
    for (let i = 0; i < g.length; i++) g[i] = g[i]! * DECAY;
  }
  _touched.clear();
}

// ── Bruit plasma ─────────────────────────────────────────────────────────────
// Micro-variation de brillance par cellule, stable (pas de Math.random : un
// scintillement aléatoire est désagréable). Ondule lentement via `phase`.
function dotNoise(c: number, r: number, phase: number): number {
  const h = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
  const frac = h - Math.floor(h);
  return 1 + 0.06 * Math.sin(phase + frac * Math.PI * 2);
}

// Carré à coins LÉGÈREMENT arrondis, centré sur (cx,cy), demi-côté `half`. C'est la
// forme de base d'un dot/peg du DMD : vraiment carré, juste adouci aux angles.
function roundSquare(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, half: number, radiusFrac = 0.28,
): void {
  const rad = half * radiusFrac;
  ctx.beginPath();
  ctx.roundRect(cx - half, cy - half, half * 2, half * 2, rad);
}

// ── Corps + surbrillance d'un dot allumé (passe nette, SANS halo) ─────────────
// `lvl` 0..1 module la brillance (afterglow, pulse, fade). Le corps est un carré à
// coins doux (look « peg carré » demandé) avec un centre quasi-blanc → brille de
// l'intérieur. Le halo n'est PAS dessiné ici : il est rendu en amont en UNE passe de
// silhouette floutée (voir `composite`) qui épouse la forme du texte sans payer un
// `shadowBlur` par-dot (trop coûteux).
function drawDotBody(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  ink: DmdInk, lvl: number,
): void {
  ctx.globalAlpha = lvl;
  ctx.fillStyle = ink.on;
  roundSquare(ctx, cx, cy, r * 1.04); ctx.fill();
  ctx.globalAlpha = 0.95 * lvl;
  ctx.fillStyle = ink.onHi;
  roundSquare(ctx, cx - r * 0.24, cy - r * 0.24, r * 0.42); ctx.fill();
}

// ── Canvas offscreen réutilisable pour la silhouette de halo ──────────────────
// On peint la silhouette des dots allumés ici (sans ombre), puis on blit ce canvas
// UNE seule fois avec `shadowBlur` → le flou s'applique au pourtour de la silhouette
// entière (la forme du texte), pas peg par peg. Un seul buffer recyclé entre frames,
// redimensionné à la demande (les DMD changent rarement de taille).
let _haloCv: HTMLCanvasElement | OffscreenCanvas | null = null;
let _haloCtx: CanvasRenderingContext2D | null = null;
function haloCanvas(w: number, h: number): [typeof _haloCv, CanvasRenderingContext2D] {
  if (!_haloCv || _haloCv.width !== w || _haloCv.height !== h) {
    _haloCv = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
    _haloCtx = _haloCv.getContext("2d") as CanvasRenderingContext2D;
  }
  return [_haloCv, _haloCtx!];
}

// ── Géométrie de rendu d'un buffer ───────────────────────────────────────────
export interface DmdGeom {
  x: number;      // coin haut-gauche de la grille (px canvas)
  y: number;
  pitch: number;  // pas de la grille (distance entre centres de dots)
  dotR: number;   // rayon d'un dot
}

// ── Compositor ───────────────────────────────────────────────────────────────
// Lit le buffer, applique l'afterglow + le bruit plasma, dessine chaque dot allumé.
// `intensity` 0..1 = brillance globale (pulse/fade). `glow` = bloom. `phase` = phase
// de bruit (≈ animClock). `persist` active la rémanence (off pour du contenu net).
export function composite(
  ctx: CanvasRenderingContext2D, buf: DotBuffer, geom: DmdGeom,
  ink: DmdInk, intensity: number, glow: boolean, phase = 0, persist = true,
): void {
  ctx.save();
  const { cols, rows, cur, glow: gl } = buf;
  const { x, y, pitch, dotR } = geom;
  const cx = (c: number) => x + c * pitch + pitch / 2;
  const cy = (r: number) => y + r * pitch + pitch / 2;

  // Niveau d'allumage par cellule, calculé une fois (afterglow + intensité + bruit).
  // Réutilisé par les deux passes. < 0.02 ⇒ dot considéré éteint (sauté). On suit
  // aussi le plus haut niveau de la frame → opacité globale du blit de halo.
  const lvls = new Float32Array(cols * rows);
  let maxLvl = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let v = cur[i]!;
      if (persist) {
        const decayed = gl[i]! * DECAY;
        if (decayed > v) v = decayed;   // afterglow : on garde la traîne
      }
      gl[i] = v;
      const lvl = v <= 0.02 ? 0 : Math.min(1, v * intensity * dotNoise(c, r, phase));
      lvls[i] = lvl;
      if (lvl > maxLvl) maxLvl = lvl;
    }
  }

  // (La trame éteinte — grille de fond — est blittée à part par `blitGrid`.)

  // ── PASSE 1 · halo de SILHOUETTE (un seul blit flouté) ──────────────────────
  // On peint la silhouette des dots allumés sur le canvas offscreen (sans ombre),
  // puis on blit ce canvas UNE fois avec `shadowBlur`. Le flou ne touche donc que le
  // POURTOUR de la silhouette entière → un halo qui épouse la forme du texte, pour le
  // coût d'un seul `fill` flouté/frame (au lieu d'un par dot).
  if (glow && maxLvl > 0) {
    const hw = Math.max(1, Math.ceil(cols * pitch));
    const hh = Math.max(1, Math.ceil(rows * pitch));
    const [hcv, hctx] = haloCanvas(hw, hh);
    hctx.clearRect(0, 0, hw, hh);
    hctx.fillStyle = ink.glow;
    hctx.globalAlpha = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (lvls[r * cols + c]! <= 0) continue;
        // coords LOCALES au canvas halo (origine en 0,0, pas x/y).
        roundSquare(hctx, c * pitch + pitch / 2, r * pitch + pitch / 2, dotR); hctx.fill();
      }
    }
    ctx.save();
    ctx.shadowColor = ink.glow;
    ctx.shadowBlur = pitch * 0.9;
    ctx.globalAlpha = 0.55 * maxLvl;
    ctx.drawImage(hcv as CanvasImageSource, x, y);
    ctx.restore();
  }

  // ── PASSE 2 · corps nets ────────────────────────────────────────────────────
  // Par-dessus le halo : corps + surbrillance, sans ombre. Les caractères restent
  // nets et le halo ne « remplit » plus leur intérieur.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lvl = lvls[r * cols + c]!;
      if (lvl <= 0) continue;
      drawDotBody(ctx, cx(c), cy(r), dotR, ink, lvl);
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// Marque un buffer persistant comme composé cette frame (exempte du decay-on-skip).
export function markComposited(key: string): void {
  _touched.add(key);
}

// ── Grille éteinte pré-rendue (perf) ─────────────────────────────────────────
// La trame plasma (dots éteints) est statique pour un (cols,rows,pitch,dotR,off)
// donné → on la rend une fois dans un canvas offscreen caché, puis on la blit chaque
// frame. Élimine ~350 arc()/frame sur un grand DMD.
const _gridSprites = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

function gridSprite(
  cols: number, rows: number, pitch: number, dotR: number, ink: DmdInk,
): HTMLCanvasElement | OffscreenCanvas {
  const key = `sq:${cols}x${rows}@${pitch.toFixed(2)}:${ink.off}`;   // « sq » = dots carrés
  const cached = _gridSprites.get(key);
  if (cached) return cached;
  const w = Math.max(1, Math.ceil(cols * pitch)), h = Math.max(1, Math.ceil(rows * pitch));
  const cv: HTMLCanvasElement | OffscreenCanvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const c = cv.getContext("2d") as CanvasRenderingContext2D;
  c.imageSmoothingEnabled = false;
  c.fillStyle = ink.off;
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < cols; col++) {
      roundSquare(c, col * pitch + pitch / 2, r * pitch + pitch / 2, dotR * 0.8);
      c.fill();
    }
  _gridSprites.set(key, cv);
  return cv;
}

// Blit la trame éteinte (le « fond » toujours visible du verre) à (x,y).
export function blitGrid(
  ctx: CanvasRenderingContext2D, geom: DmdGeom, cols: number, rows: number, ink: DmdInk,
): void {
  ctx.drawImage(gridSprite(cols, rows, geom.pitch, geom.dotR, ink), Math.round(geom.x), Math.round(geom.y));
}
