// ─── Peagle — audio (event → sound) ──────────────────────────────────────────
// Maps core events to GunthOS SFX. A pure consumer of events; it never reads or
// mutates game state. Pass in the sound functions from useSoundContext().

import type { GameEvent } from "../core/events";

export interface SfxPlayers {
  playClick: () => void;
  playPop: () => void;
  playBip: () => void;
  playVictory: () => void;
  playDelete: () => void;
}

export function playForEvents(events: GameEvent[], sfx: SfxPlayers): void {
  for (const e of events) {
    switch (e.type) {
      case "shoot":
        sfx.playClick();
        break;
      case "pegHit":
        if (e.pegType === "orange") sfx.playBip();
        else sfx.playPop();
        break;
      case "bucketCatch":
        sfx.playBip();
        break;
      case "levelWon":
        sfx.playVictory();
        break;
      case "gameOver":
        sfx.playDelete();
        break;
    }
  }
}
