// ─── Peagle — peg hit resolution & pop animation ─────────────────────────────

import { pegDef } from "../../content/pegTypes";
import { comboMultiplier } from "./combo";
import type { GameEvent } from "../events";
import type { GameState, Peg } from "../types";

/**
 * Register a hit on a peg (first time this flight). Updates score/combo, marks
 * the peg for removal at end of turn, and emits feedback events.
 */
export function registerHit(s: GameState, peg: Peg, events: GameEvent[]): void {
  if (peg.hit) return;
  peg.hit = true;

  s.combo += 1;
  const def = pegDef(peg.type);
  const mult = comboMultiplier(s.combo);
  s.score += def.points * mult;

  events.push({ type: "pegHit", pegId: peg.id, pegType: peg.type, combo: s.combo, pos: { ...peg.pos } });
  if (mult > comboMultiplier(s.combo - 1)) {
    events.push({ type: "comboUp", combo: s.combo });
  }
}

/** Advance pop animations of already-hit pegs (purely visual). */
export function animatePops(s: GameState, dt: number): void {
  for (const peg of s.pegs) {
    if (peg.hit && peg.pop < 1) {
      peg.pop = Math.min(1, peg.pop + 0.12 * dt);
    }
  }
}

/** Recompute the cached count of orange (goal) pegs still present. */
export function countOrange(s: GameState): number {
  let n = 0;
  for (const peg of s.pegs) if (pegDef(peg.type).isGoal) n++;
  return n;
}
