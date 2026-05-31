// ─── Peagle — peg type registry (data-driven) ────────────────────────────────
// A peg is just a circle. Its *behaviour* (points, is it a goal) is data here.
// Later: "bomb", "green", "warp"… are added as entries, not as ifs in physics.

import type { PegTypeId } from "../core/types";

export interface PegTypeDef {
  /** Must be destroyed to clear the level. */
  isGoal: boolean;
  /** Base points awarded on hit (before combo multiplier). */
  points: number;
  /** Render colours (main / highlight / shadow) for the bevel look. */
  color: string;
  hi: string;
  dark: string;
}

export const PEG_TYPES: Record<PegTypeId, PegTypeDef> = {
  blue: { isGoal: false, points: 10, color: "#2a4cd0", hi: "#6f8cff", dark: "#0d1b66" },
  orange: { isGoal: true, points: 100, color: "#ff6a00", hi: "#ffc24d", dark: "#8a3200" },
};

export const pegDef = (id: PegTypeId): PegTypeDef => PEG_TYPES[id];
