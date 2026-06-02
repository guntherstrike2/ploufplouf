import type { Peg, PegKind } from "./types";
import { PEG_R } from "./constants";

// ─── Peg factory ─────────────────────────────────────────────────────────────

export function makePeg(x: number, y: number, kind: PegKind = "normal"): Peg {
  return { x, y, kind, hit: false, popping: false, popAlpha: 1, scale: 1, cooldown: 0, bump: 0, revealT: 0 };
}

type PegOverride = Partial<Pick<Peg, "kind">>;

function applyOv(p: Peg, ov?: PegOverride): Peg {
  return ov ? { ...p, ...ov } : p;
}

// ─── Layout helpers — la boîte à outils pour dessiner des niveaux ─────────────

/** Pegs régulièrement espacés sur une ligne droite (x1,y1) → (x2,y2). */
export function tLine(
  x1: number, y1: number, x2: number, y2: number,
  spacing: number, ov?: PegOverride,
): Peg[] {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const count = Math.max(2, Math.round(dist / spacing));
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    return applyOv(makePeg(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t), ov);
  });
}

/** Pegs le long d'un arc (cercle partiel). */
export function tArc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number, count: number,
  ov?: PegOverride,
): Peg[] {
  return Array.from({ length: count }, (_, i) => {
    const a = count === 1 ? startAngle : startAngle + (endAngle - startAngle) * (i / (count - 1));
    return applyOv(makePeg(cx + Math.cos(a) * r, cy + Math.sin(a) * r), ov);
  });
}

/** Cercle complet de pegs. */
export function tCircle(
  cx: number, cy: number, r: number, count: number,
  ov?: PegOverride,
): Peg[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return applyOv(makePeg(cx + Math.cos(a) * r, cy + Math.sin(a) * r), ov);
  });
}

/** Grille hexagonale (lignes impaires décalées d'un demi-pas). */
export function tHexGrid(
  originX: number, originY: number,
  cols: number, rows: number, spacing: number,
  ov?: PegOverride,
): Peg[] {
  const pegs: Peg[] = [];
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : spacing * 0.5;
    for (let col = 0; col < cols; col++) {
      pegs.push(applyOv(makePeg(
        originX + col * spacing + offset,
        originY + row * spacing * 0.866,
      ), ov));
    }
  }
  return pegs;
}

/** Grille rectangulaire. */
export function tGrid(
  originX: number, originY: number,
  cols: number, rows: number,
  spacingX: number, spacingY: number,
  ov?: PegOverride,
): Peg[] {
  const pegs: Peg[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      pegs.push(applyOv(makePeg(originX + col * spacingX, originY + row * spacingY), ov));
    }
  }
  return pegs;
}

/** Pixel-art : '1' = peg, tout autre caractère = vide. */
export function tPixelArt(
  pixels: string[],
  cellW: number, cellH: number,
  originX: number, originY: number,
  ov?: PegOverride,
): Peg[] {
  const pegs: Peg[] = [];
  for (let row = 0; row < pixels.length; row++) {
    const line = pixels[row]!;
    for (let col = 0; col < line.length; col++) {
      if (line[col] === "1") {
        pegs.push(applyOv(makePeg(originX + col * cellW, originY + row * cellH), ov));
      }
    }
  }
  return pegs;
}

/** Supprime les pegs trop proches d'un peg déjà placé (déduplication). */
export function dedup(pegs: Peg[], minDist = PEG_R * 2.8): Peg[] {
  return pegs.filter((p, i) => {
    for (let j = 0; j < i; j++) {
      if (Math.hypot(p.x - pegs[j]!.x, p.y - pegs[j]!.y) < minDist) return false;
    }
    return true;
  });
}
