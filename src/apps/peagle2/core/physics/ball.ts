// ─── Peagle — single-ball integration (one substep) ──────────────────────────
// Integrates ONE egg for a fraction of a frame: gravity, drag, walls, pegs.
// Kept deliberately small; substep count is decided by the orchestrator so fast
// eggs never tunnel through pegs.

import { TRAIL_LEN } from "../../content/config";
import type { GameEvent } from "../events";
import { registerHit } from "../systems/pegs";
import type { Ball, GameState } from "../types";
import { circleCollide, near, wallCollide } from "./collide";

export function integrateBall(s: GameState, ball: Ball, dt: number, events: GameEvent[]): void {
  const cfg = s.config;

  // forces
  ball.vel.y += cfg.gravity * dt;
  ball.vel.x *= Math.pow(cfg.friction, dt);
  ball.vel.y *= Math.pow(cfg.friction, dt);

  // integrate
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;

  // walls
  const wall = wallCollide(ball, cfg.wallBounce);
  if (wall) events.push({ type: "wallBounce", pos: { ...ball.pos } });

  // pegs (broad-phase then resolve)
  for (const peg of s.pegs) {
    if (peg.hit) continue;
    if (near(ball, peg, 2) && circleCollide(ball, peg, cfg.pegBounce)) {
      registerHit(s, peg, events);
    }
  }
}

/** Push the current position into the ball's bounded trail ring buffer. */
export function pushTrail(ball: Ball): void {
  ball.trail.push({ x: ball.pos.x, y: ball.pos.y });
  if (ball.trail.length > TRAIL_LEN) ball.trail.shift();
}
