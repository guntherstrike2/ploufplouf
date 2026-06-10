import { W, H } from "../constants";
import { BALANCE } from "../balance";
import { isTarget, PEG_KINDS } from "../peg-kinds";
import type { GameState } from "../types";
import type { GameEvent } from "../events";
import type { PayoutLine } from "../payout";
import { spawnParticles, spawnImpactRing } from "./effects";
import { TEXT_FX } from "../palette";

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

  // ── PAYOUT « bleu × orange », bonus AJOUTÉS AU BLEU AVANT le calcul ──────────
  // RÈGLE SIMPLE : score d'un tour = (points bleus + bonus) × (1 + nbOrange). Les
  // BONUS (série de paniers, et en fin de niveau : jackpot, œufs restants, tableau
  // vide) viennent grossir l'assiette BLEUE, puis tout est multiplié par le compteur
  // orange accumulé (turnOrangeCount, conservé via le panier — cf. ball.ts).
  //
  // `lines` (PayoutLine) sert UNIQUEMENT à l'affichage DMD (le verre montre les bonus
  // en or au versement) ; le total réellement crédité est calculé ici et passé à
  // commitPayout. La ligne `base` montre le bleu, les `bonus` montrent leur montant brut.
  const lines: PayoutLine[] = [];
  let bonusBlue = 0;   // bonus qui grossissent l'assiette bleue AVANT le × orange

  // Multiplicateur orange du tour : 1 + nbOrange accumulés (plafonné). turnOrangeCount
  // n'est PAS reset ici — il persiste tant qu'on rattrape l'œuf (géré ball.ts/useGameLoop).
  const orangeMult = Math.min(
    BALANCE.score.orangeMultMax,
    1 + s.turnOrangeCount * BALANCE.score.orangeMultStep,
  );

  // Série de paniers : bonus encaissé en live, ajouté au bleu (donc multiplié aussi).
  if (s.pendingStreakBonus > 0) {
    bonusBlue += s.pendingStreakBonus;
    lines.push({ kind: "bonus", label: "STREAK", amount: s.pendingStreakBonus });
    s.pendingStreakBonus = 0;
  }
  if (s.pendingJackpotBalls > 0) {
    s.balls += s.pendingJackpotBalls;
    s.pendingJackpotBalls = 0;
  }

  s.combo = 0;
  s.bumperChainShot = 0;

  const remainingOrange = s.pegs.filter(isTarget).length;
  const levelEnd = remainingOrange === 0;

  if (levelEnd) {
    // JACKPOT (œuf rattrapé après la dernière proie) : ajouté au bleu avant le × orange.
    if (s.pendingJackpot > 0) {
      bonusBlue += s.pendingJackpot;
      lines.push({ kind: "bonus", label: "JACKPOT", amount: s.pendingJackpot });
      s.pendingJackpot = 0;
    }

    // TABLEAU VIDE : tous les pegs destructibles sont partis (oranges + bleus).
    const allDestructiblesGone = !s.pegs.some(p => PEG_KINDS[p.kind].destructible);
    if (allDestructiblesGone) {
      const clearBonus = BALANCE.score.clearBoardBonus * s.level;
      bonusBlue += clearBonus;
      lines.push({ kind: "bonus", label: "BOARD", amount: clearBonus });
      s.flashWhite = 1;
      s.trauma = Math.min(1, s.trauma + 0.9);
      // Salve de particules répartie sur toute la surface du tableau
      for (let i = 0; i < 8; i++) {
        const px = (W * 0.1) + (W * 0.8 * i) / 7;
        const py = H * 0.15 + Math.sin(i * 1.2) * H * 0.18;
        spawnParticles(s, px, py, true, 18);
        spawnImpactRing(s, px, py, TEXT_FX.clear, Math.min(1, 0.6 + i * 0.05));
      }
      s.floatingTexts.push({ x: W / 2, y: H / 2 - 60, text: "CLEAR BOARD!", life: 1, maxLife: 3.5, color: TEXT_FX.clear, combo: true, exclaim: true, fontSize: 28, spin: 0 });
      s.floatingTexts.push({ x: W / 2, y: H / 2 - 18, text: `+${clearBonus.toLocaleString()}`, life: 1, maxLife: 3, color: TEXT_FX.gold, combo: true, fontSize: 18 });
      events.push({ kind: "sound", id: "clear-board" });
    }

    // Niveau gagné : bonus pour les œufs restants, ajouté au bleu avant le × orange.
    const ballBonus = s.balls * BALANCE.score.ballBonus;
    if (ballBonus > 0) {
      bonusBlue += ballBonus;
      lines.push({ kind: "bonus", label: "EGGS", amount: ballBonus });
      s.floatingTexts.push({ x: W / 2, y: H / 2, text: `+${ballBonus.toLocaleString()} BONUS EGGS!`, life: 1, maxLife: 3, color: TEXT_FX.boon, combo: true, fontSize: 16 });
    }
  }

  // ── CALCUL FINAL : (bleu + bonus) × orange ──────────────────────────────────
  const blueTotal = s.turnBluePts + bonusBlue;
  const total = Math.round(blueTotal * orangeMult);
  // Ligne `base` informative : le bleu de base (hors bonus), avec son multiplicateur.
  if (s.turnBluePts > 0) lines.unshift({ kind: "base", label: "SCORE", amount: Math.round(s.turnBluePts * orangeMult) });
  s.turnBluePts = 0;

  commitPayout(s, lines, total);

  // Œuf perdu hors écran ce tour-ci : le mult vient d'être appliqué au versement ci-dessus,
  // on l'affiche maintenant comme perdu et on remet le compteur à 0 pour le tour suivant.
  // (Le reset ne peut PAS se faire dans la physique sans annuler la multiplication — cf. ball.ts.)
  if (s.orangeLostThisTurn) {
    if (s.turnOrangeCount > 0) {
      s.floatingTexts.push({ x: W / 2, y: H - 80, text: `MULT ×${1 + s.turnOrangeCount} LOST`, life: 1, maxLife: 1.6, color: TEXT_FX.score, combo: true, fontSize: 14 });
    }
    s.turnOrangeCount = 0;
    s.orangeLostThisTurn = false;
  }

  if (levelEnd) {
    // Score candidat en fin de niveau : le moteur reste une sim pure, c'est la couche
    // React (hôte) qui compare au record et persiste dans localStorage.
    events.push({ kind: "best-score", score: s.score });
    s.phase = "won";
    s.levelWonAt = s.animClock;
    s.message = `LEVEL ${s.level} COMPLETE!`;
    events.push({ kind: "sound", id: "level-clear" });
    events.push({ kind: "level-won" });

  } else if (s.balls <= 0) {
    // Plus d'œufs : game over. On a quand même versé la base du dernier tour ci-dessus.
    events.push({ kind: "best-score", score: s.score });
    s.phase = "lost";
    s.lostAt = s.animClock;
    s.message = "GAME OVER";
    events.push({ kind: "sound", id: "game-over" });
    events.push({ kind: "level-lost", score: s.score });

  } else {
    // Tour ordinaire.
    s.phase = "aim";
    s.aimStartClock = s.animClock;
    if (cleared.length > 0) events.push({ kind: "sound", id: "peg-clear" });
  }
}

// Crédite le `total` calculé au score et publie le breakdown pour le HUD (`lines` sert
// à l'affichage des bonus en or au versement). `total` est calculé en amont — (bleu +
// bonus) × orange — et fait foi. Un versement nul (tour raté → 0 point) ne publie rien.
function commitPayout(s: GameState, lines: PayoutLine[], total: number): void {
  s.score += total;
  if (total <= 0) return;
  s.lastPayout = { lines, total };
  s.payoutAt = s.animClock;
}
