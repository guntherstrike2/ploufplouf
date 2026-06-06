import type { GameState } from "./types";

/**
 * Vrai si la partie est en mode « fièvre »/nuit : peu d'œufs restants à lancer.
 *
 * L'œuf EN VOL compte comme pas-encore-dépensé (même règle que `duskProgress`
 * dans le tick) : lancer le dernier œuf ne fait donc PAS tomber la nuit, et le
 * rattraper dans le panier la garde au jour. La bascule jour→nuit (coucher de
 * soleil / lever de lune) n'a lieu qu'à la perte RÉELLE de l'œuf.
 *
 * Source unique de vérité — partagée entre le moteur, le game loop et le
 * renderer pour que tous basculent sur le même seuil au même instant.
 */
export function isClutchActive(s: GameState): boolean {
  const ballsInFlight = s.ball?.active ? 1 : 0;
  const ballsRemaining = s.balls + ballsInFlight;
  return ballsRemaining > 0 && ballsRemaining <= s.effectiveClutchThreshold;
}
