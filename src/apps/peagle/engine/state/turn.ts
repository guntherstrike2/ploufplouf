import { W, H } from "../constants";
import { BALANCE } from "../balance";
import { isTarget } from "../peg-kinds";
import type { GameState } from "../types";
import type { GameEvent } from "../events";
import { spawnParticles, spawnImpactRing } from "./effects";

export function endOfTurn(s: GameState, events: GameEvent[]): void {
  // Disparition juicy : les pegs touchés ce tour-ci éclatent vraiment (gerbe de
  // particules + onde de choc) au moment où ils quittent le tableau, au lieu de
  // s'effacer silencieusement. C'est LE moment « pop » satisfaisant.
  const cleared = s.pegs.filter(p => p.hit);
  for (const p of cleared) {
    const orange = p.kind === "orange";
    spawnParticles(s, p.x, p.y, orange, orange ? 12 : 7);
    spawnImpactRing(s, p.x, p.y, orange ? "#ffbb44" : "#9fb8ff", orange ? 0.7 : 0.32);
  }
  if (cleared.length > 0) {
    s.trauma = Math.min(1, s.trauma + Math.min(0.35, cleared.length * 0.03));
  }

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
    if (cleared.length > 0) events.push({ kind: "sound", id: "pop" });
  }
}
