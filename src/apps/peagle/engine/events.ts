export type SoundId = "bip" | "pop" | "victory" | "delete";

export type GameEvent =
  | { kind: "sound"; id: SoundId }
  | { kind: "level-won" }
  | { kind: "level-lost"; score: number }
  | { kind: "best-score"; score: number }
  | { kind: "score-submit"; score: number; won: boolean };
