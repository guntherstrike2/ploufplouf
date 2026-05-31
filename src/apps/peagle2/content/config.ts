// ─── Peagle — physics & balance constants (data, no logic) ───────────────────
// All gameplay works in INTERNAL coordinates (never screen pixels).
// Velocities are expressed in internal-units per frame (1 frame = 1/60 s).
// The game loop feeds a `dt` in "frames" (clamped) to keep things stable.

/** Internal play-field dimensions. Renderer scales these to the canvas. */
export const FIELD = { w: 480, h: 640 } as const;

/** A fully-resolved configuration, after rogue-lite upgrades are applied. */
export interface ResolvedConfig {
  /** Egg (ball) radius. */
  ballR: number;
  /** Peg radius. */
  pegR: number;
  /** Downward acceleration per frame². */
  gravity: number;
  /** Velocity multiplier applied each frame (air drag, <1). */
  friction: number;
  /** Initial egg speed when fired. */
  launchSpeed: number;
  /** Restitution against the side/top walls. */
  wallBounce: number;
  /** Restitution against pegs. */
  pegBounce: number;
  /** Number of eggs the run starts a level with. */
  startBalls: number;
  /** How many segments the aim preview simulates. */
  aimSteps: number;
  /** Horizontal bucket speed (units per frame). */
  bucketSpeed: number;
  /** Bucket catch width. */
  bucketW: number;
}

/** Base config before any upgrade. Upgrades return a modified copy. */
export const BASE_CONFIG: ResolvedConfig = {
  ballR: 7,
  pegR: 9,
  gravity: 0.18,
  friction: 0.999,
  launchSpeed: 9,
  wallBounce: 0.72,
  pegBounce: 0.7,
  startBalls: 5,
  aimSteps: 120,
  bucketSpeed: 2.2,
  bucketW: 70,
};

/** Launcher anchor (top-centre of the field). */
export const LAUNCHER = { x: FIELD.w / 2, y: 28 } as const;

/** Max length of the per-ball render trail (bounded ring buffer). */
export const TRAIL_LEN = 16;

/** Aim angle clamp (radians from straight-down), keeps shots sane. */
export const AIM_CLAMP = (75 * Math.PI) / 180;
