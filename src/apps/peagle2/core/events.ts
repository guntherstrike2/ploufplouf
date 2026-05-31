// ─── Peagle — game events ────────────────────────────────────────────────────
// Events are the CONTRACT between the pure core and the outside world
// (renderer / audio / React). The core EMITS them; it never imports a consumer.
// Adding a new feel/effect = adding a consumer of an event, not touching physics.

import type { PegTypeId, Vec } from "./types";

export type GameEvent =
  | { type: "pegHit"; pegId: number; pegType: PegTypeId; combo: number; pos: Vec }
  | { type: "wallBounce"; pos: Vec }
  | { type: "comboUp"; combo: number }
  | { type: "shoot"; pos: Vec }
  | { type: "bucketCatch"; pos: Vec }
  | { type: "ballLost" }
  | { type: "turnEnd" }
  | { type: "levelWon"; level: number; score: number }
  | { type: "gameOver"; score: number };

export type EventSink = GameEvent[];
