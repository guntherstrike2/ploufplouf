import { BALL_R, PEG_R, PEG_BOUNCE, GRAVITY, FRICTION, WALL_BOUNCE, LAUNCH_SPEED, AIM_LINE_STEPS, W, H } from "./constants";
import type { Peg } from "./types";

/** Collision œuf ↔ peg (cercle/cercle) avec réflexion. */
export function circleCollide(
  bx: number, by: number, bvx: number, bvy: number, br: number,
  px: number, py: number, pr: number,
  pegBounce = PEG_BOUNCE,
): { vx: number; vy: number } | null {
  const dx = bx - px;
  const dy = by - py;
  const distSq = dx * dx + dy * dy;
  const minDist = br + pr;
  if (distSq > minDist * minDist) return null;
  const dist = Math.sqrt(distSq);
  if (dist < 0.001) return null;
  const nx = dx / dist;
  const ny = dy / dist;
  const dot = bvx * nx + bvy * ny;
  if (dot >= 0) return null;
  return {
    vx: bvx - (1 + pegBounce) * dot * nx,
    vy: bvy - (1 + pegBounce) * dot * ny,
  };
}

/** Simule la trajectoire de l'œuf avec rebonds (ligne de visée multi-bounce). */
export function computeAimLine(
  fromX: number, fromY: number, angle: number, pegs: Peg[],
  ballR = BALL_R, steps = AIM_LINE_STEPS,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [{ x: fromX, y: fromY }];
  let x = fromX, y = fromY;
  let vx = Math.cos(angle) * LAUNCH_SPEED;
  let vy = Math.sin(angle) * LAUNCH_SPEED;

  // Même seuil que la physique réelle — pas de fudge factor
  const minDist = ballR + PEG_R;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < steps; i++) {
    x += vx; y += vy;
    vy += GRAVITY; vx *= FRICTION;
    if (x - ballR < 0) { vx = Math.abs(vx) * WALL_BOUNCE; x = ballR; }
    if (x + ballR > W) { vx = -Math.abs(vx) * WALL_BOUNCE; x = W - ballR; }

    if (y > H + 20) { points.push({ x, y }); break; }

    let pegHit = false;
    for (const p of pegs) {
      if (p.hit) continue;
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy < minDistSq) {
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        const dot = vx * nx + vy * ny;
        if (dot < 0) {
          // Point de contact sur la surface du peg
          points.push({ x: p.x + nx * minDist, y: p.y + ny * minDist });
        }
        return points;
      }
    }

    if (!pegHit) points.push({ x, y });
  }
  return points;
}
