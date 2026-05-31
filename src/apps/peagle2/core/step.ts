// ─── Peagle — the loop orchestrator ──────────────────────────────────────────
// step(state, input, dt) → { state, events }. A THIN coordinator: it calls the
// systems in a fixed order and aggregates events. No game rule lives here.
// The whole core is pure — no React, no canvas — so a game can run headlessly.

import { FIELD } from "../content/config";
import { integrateBall, pushTrail } from "./physics/ball";
import { bucketCatches, updateBucket } from "./systems/bucket";
import { clampAim } from "./systems/aim";
import { animatePops } from "./systems/pegs";
import { shoot } from "./systems/shoot";
import { endOfTurn } from "./systems/turn";
import { updateParticles } from "./fx";
import type { GameEvent } from "./events";
import type { Ball, GameState, Input, StepResult } from "./types";

/** Adaptive substeps: fast eggs are split so they can't skip past a peg. */
function substepsFor(balls: Ball[], pegR: number): number {
  let maxSpeed = 0;
  for (const b of balls) maxSpeed = Math.max(maxSpeed, Math.hypot(b.vel.x, b.vel.y));
  return Math.max(1, Math.ceil(maxSpeed / (pegR * 0.8)));
}

export function step(state: GameState, input: Input, dtRaw: number): StepResult {
  const s = state;
  const events: GameEvent[] = [];
  const dt = Math.min(2, Math.max(0, dtRaw)); // clamp to stay stable on lag

  // ── input ──────────────────────────────────────────────────────────────
  if (input.kind === "aim") s.aimAngle = clampAim(input.angle);
  else if (input.kind === "shoot") shoot(s, events);

  // bucket always slides
  updateBucket(s, dt);

  // ── flight ──────────────────────────────────────────────────────────────
  if (s.phase === "firing") {
    const sub = substepsFor(s.balls, s.config.pegR);
    const sdt = dt / sub;
    for (let i = 0; i < sub; i++) {
      for (const ball of s.balls) integrateBall(s, ball, sdt, events);
    }

    // resolve eggs that fell out of the bottom
    const survivors: Ball[] = [];
    for (const ball of s.balls) {
      pushTrail(ball);
      if (ball.pos.y - ball.r > FIELD.h) {
        if (bucketCatches(s, ball.pos.x)) {
          s.ballsLeft += 1;
          events.push({ type: "bucketCatch", pos: { ...ball.pos } });
        } else {
          events.push({ type: "ballLost" });
        }
      } else {
        survivors.push(ball);
      }
    }
    s.balls = survivors;

    animatePops(s, dt);

    if (s.balls.length === 0) endOfTurn(s, events);
  }

  // ── feel decay ───────────────────────────────────────────────────────────
  s.fx.shake = Math.max(0, s.fx.shake - 0.6 * dt);
  s.fx.flash = Math.max(0, s.fx.flash - 0.08 * dt);
  updateParticles(s, dt);

  return { state: s, events };
}
