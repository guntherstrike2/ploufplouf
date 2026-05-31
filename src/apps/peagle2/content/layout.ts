// ─── Peagle — pure level layout DSL ──────────────────────────────────────────
// Small, side-effect-free helpers that produce raw peg specs. A level's `build`
// composes these. No ids/state here — create.ts finalises them into Peg[].

import type { PegTypeId, Vec } from "../core/types";
import { FIELD } from "./config";

export interface PegSpec {
  pos: Vec;
  type: PegTypeId;
}

export interface LayoutCtx {
  field: typeof FIELD;
  line(opts: LineOpts): PegSpec[];
  grid(opts: GridOpts): PegSpec[];
  arc(opts: ArcOpts): PegSpec[];
}

interface LineOpts {
  from: Vec;
  to: Vec;
  count: number;
  type?: PegTypeId;
}
interface GridOpts {
  rows: number;
  cols: number;
  top?: number;
  bottom?: number;
  marginX?: number;
  type?: PegTypeId;
}
interface ArcOpts {
  cx: number;
  cy: number;
  r: number;
  from: number; // radians
  to: number;
  count: number;
  type?: PegTypeId;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export const LAYOUT: LayoutCtx = {
  field: FIELD,

  line({ from, to, count, type = "blue" }) {
    const out: PegSpec[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      out.push({ pos: { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) }, type });
    }
    return out;
  },

  grid({ rows, cols, top = 140, bottom = 440, marginX = 50, type = "blue" }) {
    const out: PegSpec[] = [];
    const w = FIELD.w - marginX * 2;
    for (let r = 0; r < rows; r++) {
      const y = rows === 1 ? top : lerp(top, bottom, r / (rows - 1));
      // brick offset on odd rows for a denser, bouncier feel
      const offset = r % 2 === 0 ? 0 : w / cols / 2;
      for (let c = 0; c < cols; c++) {
        const x = marginX + offset + (cols === 1 ? w / 2 : (c * w) / (cols - 1)) * ((cols - 1) / cols);
        if (x < marginX || x > FIELD.w - marginX) continue;
        out.push({ pos: { x, y }, type });
      }
    }
    return out;
  },

  arc({ cx, cy, r, from, to, count, type = "blue" }) {
    const out: PegSpec[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const a = lerp(from, to, t);
      out.push({ pos: { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }, type });
    }
    return out;
  },
};

/** Remove pegs that overlap (keeps layouts clean). */
export function dedup(specs: PegSpec[], minDist = 22): PegSpec[] {
  const out: PegSpec[] = [];
  for (const s of specs) {
    if (out.every((o) => Math.hypot(o.pos.x - s.pos.x, o.pos.y - s.pos.y) >= minDist)) {
      out.push(s);
    }
  }
  return out;
}

/** Mark a fraction of the given specs as orange (the goal pegs). Deterministic. */
export function markOrange(specs: PegSpec[], fraction: number, seed = 1): PegSpec[] {
  const n = specs.length;
  const target = Math.max(1, Math.round(n * fraction));
  // simple deterministic spread so orange pegs aren't clustered
  const stride = Math.max(1, Math.floor(n / target));
  let placed = 0;
  return specs.map((s, i) => {
    if (placed < target && i % stride === (seed % stride)) {
      placed++;
      return { ...s, type: "orange" as PegTypeId };
    }
    return s;
  });
}
