import type { GameState } from "../types";

export function updatePegAnimations(s: GameState): void {
  for (const p of s.pegs) {
    if (p.scale !== 1) {
      p.scale += (1 - p.scale) * 0.18;
      if (Math.abs(p.scale - 1) < 0.01) p.scale = 1;
    }
    // Obstacles permanents (bumper) : cooldown anti-spam + flash d'impact.
    if (p.cooldown > 0) p.cooldown--;
    if (p.bump > 0) {
      p.bump -= 0.08;
      if (p.bump < 0) p.bump = 0;
    }
  }
}
