// ─── Peagle — combo multiplier ───────────────────────────────────────────────
// Pure mapping from the in-flight hit count to a score multiplier. Tunable in
// one place. Combo resets at end of turn (see turn.ts).

/** Multiplier tiers: more consecutive hits in one flight → bigger payoff. */
export function comboMultiplier(combo: number): number {
  if (combo >= 15) return 10;
  if (combo >= 10) return 5;
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}
