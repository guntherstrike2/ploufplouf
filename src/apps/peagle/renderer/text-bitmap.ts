// ─── Texte bitmap pour le canvas de jeu ──────────────────────────────────────
// Primitive de dessin de texte en police bitmap (font-pixel.ts, « Press Start 2P »
// rastérisée), pensée comme un remplacement de `ctx.fillText` pour les textes hype/
// combos/badges du playfield. ZÉRO `ctx.font` → plus de dépendance au moteur de texte
// du navigateur, et portable Lua/natif tel quel (comme le HUD).
//
// API calquée sur fillText : `drawBitmapText(ctx, text, cx, cy, scale)` dessine le
// texte CENTRÉ sur (cx, cy) en utilisant le `ctx.fillStyle` COURANT — exactement comme
// fillText. Les effets multi-passes (ombre/glow/contour) se font donc en rappelant la
// fonction avec un fillStyle/offset différent, comme l'ancien code le faisait.

import { pxGlyph, pxTextCols, PX_GLYPH_ROWS, PX_GLYPH_W, PX_GLYPH_GAP } from "./dmd/font-pixel";

// Métriques de la police hype exposées aux appelants (dérivation de scale, layout).
export const PX_HYPE = { rows: PX_GLYPH_ROWS, w: PX_GLYPH_W, gap: PX_GLYPH_GAP } as const;

// Largeur d'un texte en PIXELS au scale donné (équivalent de measureText().width).
export function bitmapTextWidth(text: string, scale: number): number {
  return pxTextCols(text) * scale;
}

// Hauteur d'un texte en pixels (constante : la cellule de glyphe).
export function bitmapTextHeight(scale: number): number {
  return PX_GLYPH_ROWS * scale;
}

// Dessine `text` centré sur (cx, cy) au scale donné, dans la couleur `ctx.fillStyle`.
// `scale` = taille d'un dot en px (idéalement entier pour rester net). Aucun lissage :
// chaque dot allumé est un fillRect. Respecte la transform/alpha/compositing courants.
export function drawBitmapText(
  ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, scale: number,
): void {
  const wPix = bitmapTextWidth(text, scale);
  const hPix = bitmapTextHeight(scale);
  const ox = Math.round(cx - wPix / 2);
  const oy = Math.round(cy - hPix / 2);
  let gx = ox;
  for (const ch of text) {
    const g = pxGlyph(ch);
    for (let r = 0; r < PX_GLYPH_ROWS; r++) {
      const row = g[r]!;
      for (let c = 0; c < PX_GLYPH_W; c++) {
        if (row[c] === "#") ctx.fillRect(gx + c * scale, oy + r * scale, scale, scale);
      }
    }
    gx += (PX_GLYPH_W + PX_GLYPH_GAP) * scale;
  }
}

// Variante alignée à GAUCHE sur (x, cy) — pour composer des segments de couleurs
// différentes (ex : « +120 ×3 » avec le ×3 doré). Renvoie la largeur dessinée en px.
export function drawBitmapTextLeft(
  ctx: CanvasRenderingContext2D, text: string, x: number, cy: number, scale: number,
): number {
  const hPix = bitmapTextHeight(scale);
  const oy = Math.round(cy - hPix / 2);
  let gx = Math.round(x);
  for (const ch of text) {
    const g = pxGlyph(ch);
    for (let r = 0; r < PX_GLYPH_ROWS; r++) {
      const row = g[r]!;
      for (let c = 0; c < PX_GLYPH_W; c++) {
        if (row[c] === "#") ctx.fillRect(gx + c * scale, oy + r * scale, scale, scale);
      }
    }
    gx += (PX_GLYPH_W + PX_GLYPH_GAP) * scale;
  }
  return bitmapTextWidth(text, scale);
}
