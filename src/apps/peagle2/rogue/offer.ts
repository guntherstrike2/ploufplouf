// ─── Peagle — upgrade offer generation ───────────────────────────────────────
// Picks N distinct upgrades to present after a level win. Deterministic given a
// seed so it can be tested. Weighted by rarity (commons more likely).

import { ALL_UPGRADE_IDS, UPGRADES, type UpgradeId } from "./upgrades";

const WEIGHT = { common: 4, rare: 2, epic: 1 } as const;

/** Mulberry32 — tiny deterministic PRNG. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateOffer(count = 3, seed = Date.now()): UpgradeId[] {
  const rand = rng(seed);
  const pool = [...ALL_UPGRADE_IDS];
  const chosen: UpgradeId[] = [];

  while (chosen.length < count && pool.length > 0) {
    const weights = pool.map((id) => WEIGHT[UPGRADES[id].rarity]);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= weights[idx]!;
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    const pick = pool[idx];
    if (pick === undefined) break;
    chosen.push(pick);
    pool.splice(idx, 1);
  }

  // If fewer distinct upgrades exist than `count`, allow repeats so the picker
  // always has `count` cards (v1 only has 2 upgrades).
  while (chosen.length < count && ALL_UPGRADE_IDS.length > 0) {
    const pick = ALL_UPGRADE_IDS[Math.floor(rand() * ALL_UPGRADE_IDS.length)];
    if (pick !== undefined) chosen.push(pick);
  }
  return chosen;
}
