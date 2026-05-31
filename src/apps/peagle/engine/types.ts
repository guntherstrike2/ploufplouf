import type { UpgradeId } from "./roguelite";
import type { PegKind } from "./peg-kinds";

export type { UpgradeId, PegKind };

// PegType = catégorie VISUELLE (couleur d'anneau d'explosion). Le bumper, non
// destructible, ne « pop » jamais : il est mappé sur "normal" par défaut.
// La catégorie GAMEPLAY d'un peg est son `kind` (voir peg-kinds.ts).
export type PegType = "orange" | "normal";

export function getPegType(p: { kind: PegKind }): PegType {
  return p.kind === "orange" ? "orange" : "normal";
}

export interface Peg {
  x: number;
  y: number;
  kind: PegKind;
  hit: boolean;
  popping: boolean;
  popAlpha: number;
  scale: number;
  // Obstacles permanents (bumper) : frames avant de pouvoir re-toucher + flash
  // d'impact (0..1) qui décroît chaque frame.
  cooldown: number;
  bump: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  trail: { x: number; y: number; speed: number }[];
  trailHead: number; // ring buffer write pointer (oldest slot)
  tint?: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  combo: boolean;
  fontSize?: number;
}

export interface Star {
  x: number;
  y: number;
  layer: 0 | 1 | 2;
  size: number;
  phase: number;
}

export interface GameState {
  pegs: Peg[];
  ball: Ball | null;
  balls: number;
  score: number;
  phase: "aim" | "firing" | "lost" | "won";
  bucket: number;
  bucketDir: number;
  bucketFlash: number;
  message: string;
  combo: number;
  scoreMultiplier: number;
  particles: Particle[];
  floatingTexts: FloatingText[];
  feverPulse: number;
  animClock: number;
  trauma: number;
  shakeX: number;
  shakeY: number;
  flashWhite: number;
  slowMoFrames: number;
  zoomLevel: number;
  level: number;
  hitFreezeFrames: number;

  // Lanceur (aigle) déplaçable horizontalement par drag
  launcherX: number;        // position rendue (où l'œuf apparaît)
  launcherTargetX: number;  // cible suivie par ressort (mise à jour au drag)
  launcherVx: number;       // vélocité du ressort → lean / squash juicy
  launcherDragging: boolean;
  launcherGrab: number;     // 0..1 anim de saisie (pop + lueur)

  stars: Star[];
  turnScoreStart: number;
  orangeLeft: number;

  // Run modifiers (dérivés des upgrades par makeInitialState)
  runUpgrades: UpgradeId[];
  effectiveBallR: number;
  effectiveFeverThreshold: number;
  effectiveAimSteps: number;
  effectivePegBounce: number;
}

export interface UiState {
  balls: number;
  score: number;
  orangeLeft: number;
  orangeTotal: number;
  phase: string;
  message: string;
  combo: number;
  level: number;
  stars: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string | null;
  displayUsername: string | null;
  name: string;
  score: number;
  won: boolean;
  createdAt: string;
}
