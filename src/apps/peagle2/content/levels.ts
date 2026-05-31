// ─── Peagle — level definitions (data-driven) ────────────────────────────────
// A level is data + a pure `build` that returns peg specs. Adding a level = one
// entry. Levels loop/scale for the rogue-lite once we run out of hand-made ones.

import { LAYOUT, dedup, markOrange, type PegSpec } from "./layout";

export interface LevelDef {
  id: number;
  name: string;
  build: () => PegSpec[];
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Le Nid",
    build: () =>
      dedup(
        markOrange(
          LAYOUT.grid({ rows: 5, cols: 8, top: 150, bottom: 430 }),
          0.28,
        ),
      ),
  },
  {
    id: 2,
    name: "L'Arche",
    build: () =>
      dedup(
        markOrange(
          [
            ...LAYOUT.arc({ cx: 240, cy: 230, r: 150, from: Math.PI, to: 0, count: 14 }),
            ...LAYOUT.grid({ rows: 3, cols: 7, top: 330, bottom: 440 }),
          ],
          0.3,
        ),
      ),
  },
  {
    id: 3,
    name: "La Volée",
    build: () =>
      dedup(
        markOrange(
          [
            ...LAYOUT.line({ from: { x: 60, y: 180 }, to: { x: 420, y: 320 }, count: 10 }),
            ...LAYOUT.line({ from: { x: 60, y: 320 }, to: { x: 420, y: 180 }, count: 10 }),
            ...LAYOUT.grid({ rows: 2, cols: 6, top: 400, bottom: 450 }),
          ],
          0.32,
        ),
      ),
  },
];

/**
 * Resolve the layout for a given 1-based level number. Beyond the hand-made
 * levels it cycles through them (placeholder until procedural gen lands).
 */
export function levelFor(level: number): LevelDef {
  const idx = (Math.max(1, level) - 1) % LEVELS.length;
  return LEVELS[idx] ?? LEVELS[0]!;
}
