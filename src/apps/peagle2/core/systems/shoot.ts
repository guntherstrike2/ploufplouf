// ─── Peagle — firing an egg ──────────────────────────────────────────────────

import { TRAIL_LEN } from "../../content/config";
import type { GameEvent } from "../events";
import type { Ball, GameState, Vec } from "../types";

/** Convert an aim angle (0 = straight down) + speed into a velocity vector. */
export function aimToVelocity(angle: number, speed: number): Vec {
  return { x: Math.sin(angle) * speed, y: Math.cos(angle) * speed };
}

/**
 * Consume one egg and launch it. Only valid in the aim phase with an egg in
 * reserve. Transitions phase → firing and emits a shoot event.
 */
export function shoot(s: GameState, events: GameEvent[]): void {
  if (s.phase !== "aim" || s.ballsLeft <= 0) return;

  s.ballsLeft -= 1;
  s.combo = 0;

  const ball: Ball = {
    id: s.nextId++,
    r: s.config.ballR,
    pos: { ...s.launcher },
    vel: aimToVelocity(s.aimAngle, s.config.launchSpeed),
    trail: new Array(TRAIL_LEN).fill(null).map(() => ({ ...s.launcher })),
  };
  s.balls.push(ball);
  s.phase = "firing";
  events.push({ type: "shoot", pos: { ...s.launcher } });
}
