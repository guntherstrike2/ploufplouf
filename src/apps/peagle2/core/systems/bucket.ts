// ─── Peagle — moving bucket ──────────────────────────────────────────────────

import { FIELD } from "../../content/config";
import type { GameState } from "../types";

/** Slide the bucket back and forth across the bottom each frame. */
export function updateBucket(s: GameState, dt: number): void {
  const b = s.bucket;
  b.x += b.dir * s.config.bucketSpeed * dt;
  const half = b.w / 2;
  if (b.x - half < 0) {
    b.x = half;
    b.dir = 1;
  } else if (b.x + half > FIELD.w) {
    b.x = FIELD.w - half;
    b.dir = -1;
  }
}

/** True if an x position falls within the bucket's catch span. */
export function bucketCatches(s: GameState, x: number): boolean {
  return Math.abs(x - s.bucket.x) <= s.bucket.w / 2;
}
