// ─── DMD · Bandes persistantes (idle / score) ────────────────────────────────
//
// Pour le contenu ALIGNÉ SUR LA GRILLE qui bouge frame à frame HORS scène (aigle au
// repos qui cligne, score qui tickerise, compteurs qui poppent), on veut l'afterglow
// « comète » d'un vrai plasma : un dot éteint décroît sur ~3 frames. Ces helpers
// stampent dans un buffer PERSISTANT identifié par une clé de bande, puis composent
// avec rémanence. Distinct des scènes (qui rendent net) : ici l'écran « vit ».
//
//   const band = beginBand("eagle", geom, cols);  // clé stable, unique par bande
//   bandMatrix(band, eagleDots(face), col, row, value);
//   bandText(band, "PEAGLE", col, value);
//   endBand(ctx, band, ink, intensity, glow, phase);

import {
  DotBuffer, DmdGeom, DmdInk, getBuffer, composite, markComposited, stampMatrix,
} from "./raster";
import { stampText } from "./scene";

export interface Band {
  buf: DotBuffer;
  geom: DmdGeom;
  cols: number;
  rows: number;
}

// Ouvre une bande persistante. `key` doit être stable et unique (ex. "eagle", "score").
// Préfixe "dmd:" → exemptée du decay-on-skip tant qu'on la compose.
export function beginBand(key: string, geom: DmdGeom, cols: number, rows: number): Band {
  const fullKey = `dmd:${key}`;
  markComposited(fullKey);
  return { buf: getBuffer(fullKey, cols, rows), geom, cols, rows };
}

export function bandText(band: Band, text: string, col0: number, row0 = 0, value = 1): void {
  stampText(band.buf, text, Math.round(col0), Math.round(row0), value);
}

export function bandMatrix(
  band: Band, matrix: readonly string[], col0: number, row0 = 0, value = 1,
): void {
  stampMatrix(band.buf, matrix, Math.round(col0), Math.round(row0), value);
}

// Compose la bande (afterglow + bruit + dessin). Une fois tout le contenu stampé.
export function endBand(
  ctx: CanvasRenderingContext2D, band: Band, ink: DmdInk,
  intensity: number, glow: boolean, phase: number,
): void {
  composite(ctx, band.buf, band.geom, ink, intensity, glow, phase, true);
}
