// ─── Peagle — aim preview (pure trajectory simulation) ───────────────────────
// Simulates a lightweight egg from the launcher to draw the guide line. Shares
// the same collision primitives as real flight, so the preview never lies about
// the first bounces. Stops at the first peg contact or after `aimSteps`.

import { AIM_CLAMP } from "../../content/config";
import { circleCollide, near, wallCollide } from "../physics/collide";
import type { Ball, GameState, Vec } from "../types";
import { aimToVelocity } from "./shoot";

export function clampAim(angle: number): number {
  return Math.max(-AIM_CLAMP, Math.min(AIM_CLAMP, angle));
}

/** Returns the polyline of the predicted trajectory (internal coords). */
export function computeAimLine(s: GameState): Vec[] {
  const ghost: Ball = {
    id: -1,
    r: s.config.ballR,
    pos: { ...s.launcher },
    vel: aimToVelocity(s.aimAngle, s.config.launchSpeed),
    trail: [],
  };

  const pts: Vec[] = [{ ...ghost.pos }];
  for (let step = 0; step < s.config.aimSteps; step++) {
    ghost.vel.y += s.config.gravity;
    ghost.pos.x += ghost.vel.x;
    ghost.pos.y += ghost.vel.y;

    wallCollide(ghost, s.config.wallBounce);

    // stop the preview at the first peg so the player aims at a target
    let hit = false;
    for (const peg of s.pegs) {
      if (peg.hit) continue;
      if (near(ghost, peg, 2) && circleCollide(ghost, peg, s.config.pegBounce)) {
        hit = true;
        break;
      }
    }

    pts.push({ ...ghost.pos });
    if (hit || ghost.pos.y > 640) break;
  }
  return pts;
}
