export type SoundId =
  | "bip" | "pop" | "victory" | "delete"   // legacy — gardés pour compat
  | "wall-bounce"                            // rebond mur
  | "peg-hit"                               // peg normal touché
  | "orange-hit"                            // orange peg touché
  | "bumper-hit"                            // bumper touché
  | "peg-clear"                             // pegs effacés fin de tour
  | "level-clear"                           // niveau gagné
  | "jackpot"                               // dernière orange + bucket
  | "clear-board"                           // tous les pegs destructibles effacés
  | "game-over";                            // plus d'œufs

export type GameEvent =
  | { kind: "sound"; id: SoundId; x?: number }  // x=position canvas pour pitch spatial
  | { kind: "level-won" }
  | { kind: "level-lost"; score: number }
  | { kind: "best-score"; score: number }
  | { kind: "score-submit"; score: number; won: boolean };
