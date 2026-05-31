// ─── Courbe de difficulté du run ─────────────────────────────────────────────
// Source unique de la montée en difficulté au fil des niveaux. La génération
// (levels.ts) lit ces paramètres ; tu n'as PAS à recâbler chaque valeur dans le
// builder. Tweake la courbe ici pour régler le feeling de progression.
//
// Principe : tout est une fonction de `level` (1, 2, 3, …), avec des paliers
// doux et plafonnés (clamp) pour éviter les niveaux injouables en fin de run.

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export interface DifficultyParams {
  /** Nombre de pegs visé sur le tableau (avant dedup/validation). */
  pegBudget: number;
  /** Proportion de cibles oranges parmi les pegs (0..1). */
  orangePct: number;
  /** Nombre de bumpers (obstacles permanents). 0 = aucun. */
  bumperCount: number;
  /** Densité du remplissage Poisson : espacement min entre pegs (px). Plus petit = plus dense. */
  fillSpacing: number;
  /** Nombre de motifs structurels combinés (1 = épuré, 2 = plus chargé). */
  motifCount: number;
  /** Jitter aléatoire appliqué aux motifs (px). Monte → niveaux moins « propres ». */
  jitter: number;
}

/** Paramètres de difficulté pour un niveau donné. */
export function difficultyFor(level: number): DifficultyParams {
  const L = Math.max(1, level);

  // Densité de pegs : 40 au niveau 1 → ~95 plafonné.
  const pegBudget = Math.round(clamp(40 + (L - 1) * 6, 40, 95));

  // % d'oranges : 22% → 42%, croissance douce.
  const orangePct = clamp(0.22 + (L - 1) * 0.025, 0.22, 0.42);

  // Bumpers : apparaissent au niveau 3, +1 tous les 2 niveaux, plafonnés à 6.
  const bumperCount = L < 3 ? 0 : clamp(Math.floor((L - 1) / 2), 1, 6);

  // Remplissage de plus en plus serré : 46px → 30px.
  const fillSpacing = clamp(46 - (L - 1) * 1.4, 30, 46);

  // Plus de niveaux → plus de structures superposées.
  const motifCount = L >= 5 ? 2 : 1;

  // Jitter croissant pour casser la régularité en fin de run.
  const jitter = clamp((L - 1) * 0.8, 0, 12);

  return { pegBudget, orangePct, bumperCount, fillSpacing, motifCount, jitter };
}
