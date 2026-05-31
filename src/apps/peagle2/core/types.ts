// ─── Peagle — core data model ────────────────────────────────────────────────
// Everything here is plain serialisable data (no functions, no refs) so a whole
// game can be snapshotted, debugged, and simulated headlessly (no React/canvas).

import type { ResolvedConfig } from "../content/config";

export interface Vec {
  x: number;
  y: number;
}

/** Identifier of a peg "kind". Behaviour/points live in content/pegTypes.ts. */
export type PegTypeId = "blue" | "orange";

/** Phase = explicit state machine for the current level. */
export type Phase = "aim" | "firing" | "won" | "lost";

export interface Peg {
  id: number;
  pos: Vec;
  r: number;
  type: PegTypeId;
  /** Hit during the current flight — removed at end of turn. */
  hit: boolean;
  /** 0 = idle, →1 = pop animation progress (purely visual). */
  pop: number;
}

export interface Ball {
  id: number;
  pos: Vec;
  vel: Vec;
  r: number;
  /** Bounded ring buffer of recent positions for the render trail. */
  trail: Vec[];
}

export interface Particle {
  pos: Vec;
  vel: Vec;
  life: number; // 1 → 0
  color: string;
  size: number;
}

export interface FloatingText {
  pos: Vec;
  text: string;
  life: number; // 1 → 0
  color: string;
}

export interface Bucket {
  x: number;
  dir: 1 | -1;
  w: number;
}

export interface GameState {
  phase: Phase;
  level: number;

  pegs: Peg[];
  balls: Ball[]; // in-flight eggs (≥1 while firing; multiball-ready)
  ballsLeft: number; // reserve of eggs

  aimAngle: number; // radians, 0 = straight down
  launcher: Vec;

  bucket: Bucket;

  score: number;
  combo: number; // pegs hit during the current flight
  orangeLeft: number; // cached count of orange pegs still present

  // game-feel hooks: written from event reactions, read by the renderer
  fx: { shake: number; flash: number };

  particles: Particle[];
  floatingTexts: FloatingText[];

  // frozen at creation from base config + rogue-lite upgrades
  config: ResolvedConfig;

  // monotonic id source for spawned entities
  nextId: number;
}

/** Player input pushed by React each frame; consumed by step(). */
export type Input =
  | { kind: "aim"; angle: number }
  | { kind: "shoot" }
  | { kind: "none" };

export interface StepResult {
  state: GameState;
  events: import("./events").GameEvent[];
}
