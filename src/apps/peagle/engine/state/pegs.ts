import type { GameState } from "../types";

export function updatePegAnimations(s: GameState): void {
  for (const p of s.pegs) {
    if (p.scale !== 1) {
      p.scale += (1 - p.scale) * 0.18;
      if (Math.abs(p.scale - 1) < 0.01) p.scale = 1;
    }
  }
}
