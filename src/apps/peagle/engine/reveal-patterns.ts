// ─── Patterns d'apparition des pegs (rideau d'intro) ─────────────────────────
// Chaque pattern produit un ORDRE de révélation : la liste des index de pegs,
// triée selon un critère géométrique. init.ts en pioche un au hasard à chaque
// début de niveau et espace les `revealT` selon cet ordre.
//
// Tout est déterministe (issu du rng seedé du niveau) : aucun impact gameplay,
// purement visuel.

import { W, H } from "./constants";
import { shuffle, pick, type Rng } from "./rng";
import type { Peg } from "./types";

/** Une fonction qui renvoie l'ordre des index de pegs à révéler. */
type RevealPattern = (pegs: Peg[], keys: number[], rng: Rng) => number[];

const CX = W / 2;
const CY = H / 2;

/** Trie les index par clé croissante (clé calculée depuis le peg). */
const sortByKey = (keys: number[], pegs: Peg[], key: (p: Peg) => number): number[] =>
  [...keys].sort((a, b) => key(pegs[a]!) - key(pegs[b]!));

export const REVEAL_PATTERNS: { name: string; order: RevealPattern }[] = [
  // Balayage diagonal haut-gauche → bas-droit (l'ancien défaut).
  { name: "diagonal", order: (p, k) => sortByKey(k, p, (g) => g.y + g.x * 0.4) },
  // De haut en bas.
  { name: "top-down", order: (p, k) => sortByKey(k, p, (g) => g.y) },
  // De bas en haut.
  { name: "bottom-up", order: (p, k) => sortByKey(k, p, (g) => -g.y) },
  // De gauche à droite.
  { name: "left-right", order: (p, k) => sortByKey(k, p, (g) => g.x) },
  // De droite à gauche.
  { name: "right-left", order: (p, k) => sortByKey(k, p, (g) => -g.x) },
  // Explosion depuis le centre vers l'extérieur.
  { name: "center-out", order: (p, k) => sortByKey(k, p, (g) => Math.hypot(g.x - CX, g.y - CY)) },
  // Implosion depuis l'extérieur vers le centre.
  { name: "outside-in", order: (p, k) => sortByKey(k, p, (g) => -Math.hypot(g.x - CX, g.y - CY)) },
  // Spirale (angle + distance) autour du centre.
  {
    name: "spiral",
    order: (p, k) =>
      sortByKey(k, p, (g) => {
        const ang = Math.atan2(g.y - CY, g.x - CX); // -π..π
        const dist = Math.hypot(g.x - CX, g.y - CY);
        return ang + dist * 0.02;
      }),
  },
  // Vagues horizontales en zig-zag (boustrophédon) : rangée par rangée, mais on
  // alterne le sens gauche/droite d'une rangée à l'autre.
  {
    name: "snake",
    order: (p, k) =>
      sortByKey(k, p, (g) => {
        const row = Math.floor(g.y / 40);
        const dir = row % 2 === 0 ? g.x : W - g.x;
        return row * 1000 + dir;
      }),
  },
  // Depuis les deux côtés vers le milieu (volets qui se ferment).
  { name: "edges-in", order: (p, k) => sortByKey(k, p, (g) => -Math.abs(g.x - CX)) },
  // Depuis le milieu vers les deux côtés (volets qui s'ouvrent).
  { name: "split-out", order: (p, k) => sortByKey(k, p, (g) => Math.abs(g.x - CX)) },
  // Diagonale inverse haut-droit → bas-gauche.
  { name: "anti-diagonal", order: (p, k) => sortByKey(k, p, (g) => g.y - g.x * 0.4) },
  // Totalement aléatoire (confettis).
  { name: "scatter", order: (_p, k, rng) => shuffle(rng, [...k]) },
];

/** Pioche un pattern au hasard et renvoie l'ordre des index de pegs. */
export function pickRevealOrder(pegs: Peg[], rng: Rng): number[] {
  const keys = [...pegs.keys()];
  const pattern = pick(rng, REVEAL_PATTERNS);
  return pattern.order(pegs, keys, rng);
}
