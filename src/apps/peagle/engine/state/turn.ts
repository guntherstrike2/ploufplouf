import { W, H } from "../constants";
import { BALANCE } from "../balance";
import { isTarget, PEG_KINDS } from "../peg-kinds";
import type { GameState } from "../types";
import type { GameEvent } from "../events";
import { spawnParticles, spawnImpactRing } from "./effects";

export function endOfTurn(s: GameState, events: GameEvent[]): void {
  // Disparition juicy : les pegs touchés ce tour-ci éclatent vraiment (gerbe de
  // particules + onde de choc) au moment où ils quittent le tableau, au lieu de
  // s'effacer silencieusement. C'est LE moment « pop » satisfaisant.
  const cleared = s.pegs.filter(p => p.hit);
  s.lastTurnHitCount = cleared.length;

  // Tour totalement raté (œuf perdu sans toucher un seul peg) → cri agacé de
  // l'aigle pendant ~1s (face.ts lit whiffAt). On exclut les fins de partie où
  // le cri de défaite/victoire prime déjà.
  if (cleared.length === 0) s.whiffAt = s.animClock;
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
  s.bumperChainShot = 0;
  s.scoreMultiplier = 1;

  const remainingOrange = s.pegs.filter(isTarget).length;

  if (remainingOrange === 0) {
    // TABLEAU VIDE : tous les pegs destructibles sont partis (oranges + bleus).
    // Récompense spéciale > jackpot car c'est plus rare et demande plus de skill.
    const allDestructiblesGone = !s.pegs.some(p => PEG_KINDS[p.kind].destructible);
    if (allDestructiblesGone) {
      const clearBonus = BALANCE.score.clearBoardBonus * s.level;
      s.score += clearBonus;
      s.flashWhite = 1;
      s.trauma = Math.min(1, s.trauma + 0.9);
      // Salve de particules répartie sur toute la surface du tableau
      for (let i = 0; i < 8; i++) {
        const px = (W * 0.1) + (W * 0.8 * i) / 7;
        const py = H * 0.15 + Math.sin(i * 1.2) * H * 0.18;
        spawnParticles(s, px, py, true, 18);
        spawnImpactRing(s, px, py, "#ffffff", Math.min(1, 0.6 + i * 0.05));
      }
      s.floatingTexts.push({
        x: W / 2, y: H / 2 - 60,
        text: "TABLEAU VIDE !",
        life: 1, maxLife: 3.5,
        color: "#ffffff",
        combo: true, exclaim: true,
        fontSize: 28, spin: 0,
      });
      s.floatingTexts.push({
        x: W / 2, y: H / 2 - 18,
        text: `+${clearBonus.toLocaleString()}`,
        life: 1, maxLife: 3,
        color: "#ffd700",
        combo: true,
        fontSize: 18,
      });
      events.push({ kind: "sound", id: "clear-board" });
    }

    // Niveau gagné : bonus pour les œufs restants
    const ballBonus = s.balls * BALANCE.score.ballBonus;
    s.score += ballBonus;
    if (ballBonus > 0) {
      s.floatingTexts.push({ x: W / 2, y: H / 2, text: `+${ballBonus.toLocaleString()} BONUS OEUFS!`, life: 1, maxLife: 3, color: "#00ffcc", combo: true, fontSize: 16 });
    }

    // Score candidat en fin de niveau : le moteur reste une sim pure, c'est la
    // couche React (hôte) qui compare au record et persiste dans localStorage.
    events.push({ kind: "best-score", score: s.score });

    s.phase = "won";
    s.levelWonAt = s.animClock;
    s.message = `NIVEAU ${s.level} TERMINÉ !`;
    events.push({ kind: "sound", id: "level-clear" });
    events.push({ kind: "level-won" });

  } else if (s.balls <= 0) {
    // Plus d'œufs : game over
    events.push({ kind: "best-score", score: s.score });
    s.phase = "lost";
    s.lostAt = s.animClock;
    s.message = "GAME OVER";
    events.push({ kind: "sound", id: "game-over" });
    events.push({ kind: "level-lost", score: s.score });

  } else {
    s.phase = "aim";
    s.aimStartClock = s.animClock;
    if (cleared.length > 0) events.push({ kind: "sound", id: "peg-clear" });
  }
}
