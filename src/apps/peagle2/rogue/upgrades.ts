// ─── Peagle — upgrade registry (rogue-lite extension point #1) ────────────────
// An upgrade is DATA with a pure `apply(config)`. Adding one = one entry, no
// changes anywhere else. v1 ships 2 examples to prove the wiring end-to-end.
// Later: a reactive variant (`onEvent`) handles per-event effects in step().

import type { ResolvedConfig } from "../content/config";

export type UpgradeId = "bigger_egg" | "extra_ball";
export type Rarity = "common" | "rare" | "epic";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  rarity: Rarity;
  /** Pure transform of the resolved config. */
  apply: (c: ResolvedConfig) => ResolvedConfig;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  bigger_egg: {
    id: "bigger_egg",
    name: "Gros Œuf",
    desc: "+30 % de rayon — touche plus de pegs.",
    rarity: "common",
    apply: (c) => ({ ...c, ballR: c.ballR * 1.3 }),
  },
  extra_ball: {
    id: "extra_ball",
    name: "Œuf Bonus",
    desc: "+1 œuf au départ de chaque niveau.",
    rarity: "common",
    apply: (c) => ({ ...c, startBalls: c.startBalls + 1 }),
  },
};

export const ALL_UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
