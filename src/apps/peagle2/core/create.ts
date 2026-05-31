// ─── Peagle — initial state factory ──────────────────────────────────────────
// Builds a fresh GameState for a level from a (already resolved) config. The
// rogue-lite resolves the config beforehand; the core just consumes it.

import { FIELD, LAUNCHER, type ResolvedConfig } from "../content/config";
import { levelFor } from "../content/levels";
import { countOrange } from "./systems/pegs";
import type { GameState, Peg } from "./types";

export function createGame(config: ResolvedConfig, level: number, startScore = 0): GameState {
  const def = levelFor(level);

  let id = 1;
  const pegs: Peg[] = def.build().map((spec) => ({
    id: id++,
    pos: { x: spec.pos.x, y: spec.pos.y },
    r: config.pegR,
    type: spec.type,
    hit: false,
    pop: 0,
  }));

  const state: GameState = {
    phase: "aim",
    level,
    pegs,
    balls: [],
    ballsLeft: config.startBalls,
    aimAngle: 0,
    launcher: { ...LAUNCHER },
    bucket: { x: FIELD.w / 2, dir: 1, w: config.bucketW },
    score: startScore,
    combo: 0,
    orangeLeft: 0,
    fx: { shake: 0, flash: 0 },
    particles: [],
    floatingTexts: [],
    config,
    nextId: id,
  };

  state.orangeLeft = countOrange(state);
  return state;
}
