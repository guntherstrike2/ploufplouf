import type { UpgradeId } from "./roguelite";

export type { UpgradeId };

// Deux types de cibles seulement dans le squelette : orange (à détruire pour
// gagner) et normale (bonus de points). Ajoute tes propres types ici puis
// gère-les dans getPegType / le rendu / la physique.
export type PegType = "orange" | "normal";

export function getPegType(p: { orange: boolean }): PegType {
  return p.orange ? "orange" : "normal";
}

export interface Peg {
  x: number;
  y: number;
  hit: boolean;
  orange: boolean;
  popping: boolean;
  popAlpha: number;
  scale: number;
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
