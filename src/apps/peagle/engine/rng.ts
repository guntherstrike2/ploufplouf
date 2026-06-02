// ─── RNG seedé déterministe ──────────────────────────────────────────────────
// mulberry32 : générateur pseudo-aléatoire rapide, 32-bit, de bonne qualité pour
// du gameplay. Même seed → même suite → même niveau. Indispensable pour la
// génération de niveaux reproductible (debug, fair-play leaderboard, partage de
// seed). N'utilise JAMAIS Math.random() dans la génération de niveaux : passe
// toujours par un Rng issu d'ici.

export type Rng = () => number;

/** Crée un générateur déterministe à partir d'un seed entier. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange deux entiers en un seed bien dispersé (hash type xmix). */
export function hashSeed(a: number, b = 0): number {
  let h = (a >>> 0) ^ Math.imul(b >>> 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Flottant uniforme dans [lo, hi). */
export const randRange = (r: Rng, lo: number, hi: number): number => lo + r() * (hi - lo);

/** Entier uniforme dans [lo, hi] (bornes incluses). */
export const randInt = (r: Rng, lo: number, hi: number): number =>
  Math.min(hi, Math.floor(lo + r() * (hi - lo + 1)));

/** Élément au hasard d'un tableau non vide. */
export const pick = <T>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!;

/** true avec probabilité p. */
export const chance = (r: Rng, p: number): boolean => r() < p;

/** Mélange Fisher-Yates en place (déterministe). Retourne le tableau. */
export function shuffle<T>(r: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
