import { W, PEG_R } from "./constants";
import type { Peg } from "./types";
import { tHexGrid, tCircle, tGrid, dedup } from "./tableau";

// ─── Layouts ──────────────────────────────────────────────────────────────────
// POINT D'EXTENSION : ajoute tes propres tableaux ici, puis référence-les dans
// la liste LAYOUTS. Chaque builder renvoie un simple tableau de pegs.

function layoutGrid(cx: number): Peg[] {
  // Champ hexagonal classique
  return tHexGrid(28, 130, 15, 9, 28).map(p => ({ ...p, x: p.x + (cx - W / 2) }));
}

function layoutDiamond(cx: number): Peg[] {
  // Losange de pegs
  const pegs: Peg[] = [];
  const rows = 13;
  for (let row = 0; row < rows; row++) {
    const y = 120 + row * 30;
    const half = (rows - 1) / 2;
    const count = row <= half ? row + 1 : rows - row;
    const spacing = 30;
    for (let col = 0; col < count; col++) {
      pegs.push({
        x: cx - (count - 1) * spacing * 0.5 + col * spacing,
        y,
        hit: false, orange: false, popping: false, popAlpha: 1, scale: 1,
      });
    }
  }
  return pegs;
}

function layoutColumns(cx: number): Peg[] {
  // Colonnes verticales + un cercle central
  return dedup([
    ...tGrid(cx - 168, 120, 7, 12, 56, 34),
    ...tCircle(cx, 360, 70, 14),
  ]);
}

const LAYOUTS = [layoutGrid, layoutDiamond, layoutColumns];

// ─── Builder principal ─────────────────────────────────────────────────────────

export function buildLevel(level: number): Peg[] {
  const cx = W / 2;
  const builder = LAYOUTS[(level - 1) % LAYOUTS.length] ?? layoutGrid;
  const pegs = dedup(builder(cx), PEG_R * 2.8);

  // Pourcentage d'oranges croissant avec le niveau (25% → 40%)
  const orangePct = Math.min(0.40, 0.25 + (level - 1) * 0.03);
  const orangeCount = Math.max(1, Math.floor(pegs.length * orangePct));
  const order = [...pegs.keys()].sort(() => Math.random() - 0.5);
  for (let i = 0; i < orangeCount; i++) {
    const idx = order[i];
    if (idx !== undefined && pegs[idx]) pegs[idx]!.orange = true;
  }

  return pegs;
}
