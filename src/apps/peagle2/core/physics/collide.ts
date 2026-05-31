// ─── Peagle — collision primitives (pure) ────────────────────────────────────
// v1 only needs circle↔circle (egg↔peg) and circle↔wall. New colliders later
// implement the same shape of result and plug in here — physics stays small.

import type { Ball, Peg, Vec } from "../types";
import { FIELD } from "../../content/config";
import { reflect } from "./vec";

/**
 * Resolve egg vs peg. Mutates the ball (position pushed out + velocity
 * reflected) and returns true on contact. Pure w.r.t. the peg.
 */
export function circleCollide(ball: Ball, peg: Peg, restitution: number): boolean {
  const dx = ball.pos.x - peg.pos.x;
  const dy = ball.pos.y - peg.pos.y;
  const min = ball.r + peg.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;

  const dist = Math.sqrt(d2) || 0.0001;
  const nx = dx / dist;
  const ny = dy / dist;

  // push the egg out of the peg so it can't tunnel/stick
  ball.pos.x = peg.pos.x + nx * min;
  ball.pos.y = peg.pos.y + ny * min;

  const reflected = reflect(ball.vel, { x: nx, y: ny }, restitution);
  ball.vel.x = reflected.x;
  ball.vel.y = reflected.y;
  return true;
}

export type WallSide = "left" | "right" | "top";

/**
 * Resolve egg vs side/top walls. Mutates the ball and returns the side hit
 * (or null). The bottom is intentionally open (eggs fall out / into bucket).
 */
export function wallCollide(ball: Ball, wallBounce: number): WallSide | null {
  const r = ball.r;
  if (ball.pos.x - r < 0) {
    ball.pos.x = r;
    ball.vel.x = -ball.vel.x * wallBounce;
    return "left";
  }
  if (ball.pos.x + r > FIELD.w) {
    ball.pos.x = FIELD.w - r;
    ball.vel.x = -ball.vel.x * wallBounce;
    return "right";
  }
  if (ball.pos.y - r < 0) {
    ball.pos.y = r;
    ball.vel.y = -ball.vel.y * wallBounce;
    return "top";
  }
  return null;
}

/** A peg is reachable by the ball this substep — cheap broad-phase. */
export function near(ball: Ball, peg: Peg, slack: number): boolean {
  const dx = ball.pos.x - peg.pos.x;
  const dy = ball.pos.y - peg.pos.y;
  const reach = ball.r + peg.r + slack;
  return dx * dx + dy * dy <= reach * reach;
}

export const center = (b: { pos: Vec }): Vec => ({ x: b.pos.x, y: b.pos.y });
