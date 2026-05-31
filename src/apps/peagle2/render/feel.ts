// ─── Peagle — game feel (event → visuals) ────────────────────────────────────
// A pure consumer of core events that pushes "juice" into the (presentational)
// fx state: particles, screen shake, flash, floating score text. This keeps all
// feel OUT of the physics core — add an effect by reacting to an event here.

import { pegDef } from "../content/pegTypes";
import { spawnBurst, spawnText } from "../core/fx";
import type { GameEvent } from "../core/events";
import type { GameState } from "../core/types";

export function applyFeel(s: GameState, events: GameEvent[]): void {
  for (const e of events) {
    switch (e.type) {
      case "pegHit": {
        const def = pegDef(e.pegType);
        spawnBurst(s, e.pos, def.hi, e.pegType === "orange" ? 12 : 6);
        s.fx.shake = Math.min(6, s.fx.shake + (e.pegType === "orange" ? 2.5 : 1));
        if (e.combo >= 3) spawnText(s, e.pos, `x${comboLabel(e.combo)}`, def.hi);
        break;
      }
      case "wallBounce":
        s.fx.shake = Math.min(4, s.fx.shake + 0.4);
        break;
      case "bucketCatch":
        spawnBurst(s, e.pos, "#9fe0ff", 14);
        spawnText(s, e.pos, "+1 ŒUF", "#9fe0ff");
        s.fx.flash = Math.min(0.5, s.fx.flash + 0.3);
        break;
      case "levelWon":
        s.fx.flash = 0.8;
        break;
      case "gameOver":
        s.fx.shake = 8;
        break;
    }
  }
}

function comboLabel(combo: number): number {
  if (combo >= 15) return 10;
  if (combo >= 10) return 5;
  if (combo >= 6) return 3;
  return 2;
}
