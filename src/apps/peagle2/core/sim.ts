// ─── Peagle — headless simulation (proves the core runs without React/canvas) ─
// Run: pnpm exec tsx src/apps/peagle2/core/sim.ts
// Drives a full game purely in memory: aims, shoots, steps frames until eggs
// settle, and reports score / pegs cleared / phase. A lightweight safety net in
// the absence of a formal test suite.

import { BASE_CONFIG } from "../content/config";
import { createGame } from "./create";
import { step } from "./step";
import type { GameEvent } from "./events";
import type { GameState, Input } from "./types";

function runTurn(s: GameState, angle: number): { state: GameState; events: GameEvent[] } {
  const all: GameEvent[] = [];
  // aim then shoot
  step(s, { kind: "aim", angle }, 1);
  const shot = step(s, { kind: "shoot" }, 1);
  all.push(...shot.events);
  // step until the turn resolves back to aim/won/lost
  let guard = 0;
  while (s.phase === "firing" && guard++ < 6000) {
    const r = step(s, { kind: "none" } as Input, 1);
    all.push(...r.events);
  }
  return { state: s, events: all };
}

function main() {
  let game = createGame({ ...BASE_CONFIG }, 1);
  console.log(`level ${game.level} — pegs: ${game.pegs.length}, orange: ${game.orangeLeft}, balls: ${game.ballsLeft}`);

  let turns = 0;
  while (game.phase === "aim" && turns < 40) {
    turns++;
    const angle = -0.6 + Math.random() * 1.2; // sweep across the field
    const { events } = runTurn(game, angle);
    const hits = events.filter((e) => e.type === "pegHit").length;
    const caught = events.some((e) => e.type === "bucketCatch");
    console.log(
      `turn ${turns}: angle=${angle.toFixed(2)} hits=${hits}${caught ? " 🪣catch" : ""} ` +
        `score=${game.score} orange=${game.orangeLeft} balls=${game.ballsLeft} phase=${game.phase}`,
    );
  }

  console.log("─".repeat(40));
  console.log(`FINAL: phase=${game.phase} score=${game.score} orangeLeft=${game.orangeLeft} after ${turns} turns`);

  // sanity assertions
  const ok =
    game.score >= 0 &&
    (game.phase === "won" || game.phase === "lost" || game.phase === "aim") &&
    game.pegs.every((p) => p.r > 0);
  console.log(ok ? "✅ core sim OK" : "❌ core sim FAILED");
  if (!ok) process.exit(1);
}

main();
