import { W, H } from "../constants";
import { BALANCE } from "../balance";
import { isTarget } from "../peg-kinds";
import type { GameState } from "../types";
import type { GameEvent } from "../events";

export function endOfTurn(s: GameState, events: GameEvent[]): void {
  s.pegs = s.pegs.filter(p => !p.hit);
  s.combo = 0;
  s.scoreMultiplier = 1;

  const remainingOrange = s.pegs.filter(isTarget).length;

  if (remainingOrange === 0) {
    // Niveau gagné : bonus pour les œufs restants
    const ballBonus = s.balls * BALANCE.score.ballBonus;
    s.score += ballBonus;
    if (ballBonus > 0) {
      s.floatingTexts.push({ x: W / 2, y: H / 2, text: `+${ballBonus.toLocaleString()} BONUS ŒUFS!`, life: 1, maxLife: 3, color: "#00ffcc", combo: true, fontSize: 16 });
    }

    const saved = parseInt(localStorage.getItem("peagle98_best") ?? "0", 10);
    if (s.score > saved) {
      localStorage.setItem("peagle98_best", String(s.score));
      events.push({ kind: "best-score", score: s.score });
    }

    s.phase = "won";
    s.message = `NIVEAU ${s.level} TERMINÉ !`;
    events.push({ kind: "sound", id: "victory" });
    events.push({ kind: "level-won" });

  } else if (s.balls <= 0) {
    // Plus d'œufs : game over
    const saved = parseInt(localStorage.getItem("peagle98_best") ?? "0", 10);
    if (s.score > saved) {
      localStorage.setItem("peagle98_best", String(s.score));
      events.push({ kind: "best-score", score: s.score });
    }
    s.phase = "lost";
    s.message = "GAME OVER";
    events.push({ kind: "sound", id: "delete" });
    events.push({ kind: "level-lost", score: s.score });

  } else {
    s.phase = "aim";
  }
}
