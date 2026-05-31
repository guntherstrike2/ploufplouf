// ─── Peagle — vector maths (pure) ────────────────────────────────────────────

import type { Vec } from "../types";

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);

export function norm(a: Vec): Vec {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
}

/** Reflect velocity `vel` about surface normal `n` (unit), with restitution. */
export function reflect(vel: Vec, n: Vec, restitution: number): Vec {
  const d = dot(vel, n);
  return {
    x: (vel.x - 2 * d * n.x) * restitution,
    y: (vel.y - 2 * d * n.y) * restitution,
  };
}
