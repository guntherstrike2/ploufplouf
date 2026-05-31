// ─── Peagle — end-of-turn resolution ─────────────────────────────────────────
// Called once all in-flight eggs have left the field. Removes hit pegs, then
// decides the next phase: won / lost / back to aim.

import type { GameEvent } from "../events";
import { countOrange } from "./pegs";
import type { GameState } from "../types";

export function endOfTurn(s: GameState, events: GameEvent[]): void {
  // remove pegs hit during the flight
  s.pegs = s.pegs.filter((p) => !p.hit);
  s.orangeLeft = countOrange(s);
  s.combo = 0;

  events.push({ type: "turnEnd" });

  if (s.orangeLeft === 0) {
    s.phase = "won";
    events.push({ type: "levelWon", level: s.level, score: s.score });
    return;
  }

  if (s.ballsLeft <= 0) {
    s.phase = "lost";
    events.push({ type: "gameOver", score: s.score });
    return;
  }

  s.phase = "aim";
}
