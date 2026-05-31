// ─── Peagle — run state & config resolution (rogue-lite core) ─────────────────
// The pure game core is agnostic of the rogue-lite. The rogue-lite acts in TWO
// well-defined places: (1) resolving config before a level, (2) the screen flow
// between levels (handled in React). This file owns (1).

import { BASE_CONFIG, type ResolvedConfig } from "../content/config";
import { UPGRADES, type UpgradeId } from "./upgrades";

export interface RunState {
  level: number; // 1-based current level
  upgrades: UpgradeId[]; // accumulated over the run
  score: number; // carried across levels
}

export function newRun(): RunState {
  return { level: 1, upgrades: [], score: 0 };
}

/** Apply all accumulated upgrades onto the base config (pure, order-stable). */
export function resolveConfig(run: RunState): ResolvedConfig {
  return run.upgrades.reduce<ResolvedConfig>(
    (cfg, id) => UPGRADES[id].apply(cfg),
    { ...BASE_CONFIG },
  );
}

export function advanceLevel(run: RunState, addedScore: number): RunState {
  return { ...run, level: run.level + 1, score: run.score + addedScore };
}
