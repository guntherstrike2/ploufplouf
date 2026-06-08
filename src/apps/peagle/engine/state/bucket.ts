import { W, BUCKET_W } from "../constants";
import type { GameState } from "../types";

export function updateBucket(s: GameState, timeScale: number): void {
  s.bucket += s.bucketDir * timeScale;
  if (s.bucket <= 0) { s.bucket = 0; s.bucketDir = Math.abs(s.bucketDir); }
  if (s.bucket + BUCKET_W >= W) { s.bucket = W - BUCKET_W; s.bucketDir = -Math.abs(s.bucketDir); }

  // Décroissance 1 → 0 sur ~22 frames (~0.37 s) : assez long pour que le ressort
  // de capture (squash/stretch, renderer/ui.ts → drawBuckets) se déploie en entier.
  if (s.bucketFlash > 0) s.bucketFlash = Math.max(0, s.bucketFlash - 0.045 * timeScale);
}
