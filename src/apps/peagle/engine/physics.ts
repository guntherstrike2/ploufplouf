import { BALL_R, PEG_R, PEG_BOUNCE, GRAVITY, FRICTION, WALL_BOUNCE, LAUNCH_SPEED, AIM_LINE_STEPS, W, H, MAX_BALL_SPEED } from "./constants";
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

  const minDist = ballR + PEG_R;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < steps; i++) {
    // Même subdivision que la physique réelle pour éviter de rater les pegs à haute vitesse.
    const speed = Math.sqrt(vx * vx + vy * vy);
    const substeps = Math.max(1, Math.ceil(speed / (PEG_R * 0.8)));
    const dt = 1 / substeps;
    const frictionDt = Math.pow(FRICTION, dt);

    for (let sub = 0; sub < substeps; sub++) {
      x += vx * dt;
      y += vy * dt;
      vy += GRAVITY * dt;
      vx *= frictionDt;

      if (x - ballR < 0) { vx = Math.abs(vx) * WALL_BOUNCE; x = ballR; }
      if (x + ballR > W) { vx = -Math.abs(vx) * WALL_BOUNCE; x = W - ballR; }

      if (y > H + 20) { points.push({ x, y }); return points; }

      // Skip pegs détruits ET pegs en cooldown (bumpers transparents pendant recharge).
      for (const p of pegs) {
        if (p.hit || p.cooldown > 0) continue;
        const dx = x - p.x, dy = y - p.y;
        if (dx * dx + dy * dy < minDistSq) {
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / dist, ny = dy / dist;
          const dot = vx * nx + vy * ny;
          if (dot < 0) {
            points.push({ x: p.x + nx * minDist, y: p.y + ny * minDist });
          }
          return points;
        }
      }
    }

    // Vitesse bornée pour cohérence avec la physique réelle.
    const spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > MAX_BALL_SPEED) { const s = MAX_BALL_SPEED / spd; vx *= s; vy *= s; }

    points.push({ x, y });
  }
  return points;
}
