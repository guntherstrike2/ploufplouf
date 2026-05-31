import {
  BALL_R, FEVER_THRESHOLD, AIM_LINE_STEPS, PEG_BOUNCE,
  W, BUCKET_W, BUCKET_SPEED, START_BALLS, STAR_COUNT, LAUNCHER_X,
} from "../constants";
import { buildLevel } from "../levels";
import { isTarget } from "../peg-kinds";
import type { GameState, Peg, Star } from "../types";
import type { RunState } from "../roguelite";

function makeStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * W,
    y: Math.random() * 640,
    layer: Math.floor(Math.random() * 3) as 0 | 1 | 2,
    size: 0.4 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
  }));
}

export function makeInitialState(
  level: number,
  runState: RunState,
  keepScore: boolean,
  prevScore: number,
): GameState {
  const { upgrades } = runState;

  const baseBalls = START_BALLS + (upgrades.includes("extra_ball") ? 1 : 0);
  const effectiveBallR = BALL_R * (upgrades.includes("bigger_ball") ? 1.3 : 1);
  const effectiveAimSteps = Math.round(AIM_LINE_STEPS * (upgrades.includes("sharp_aim") ? 1.6 : 1));
  const effectivePegBounce = PEG_BOUNCE * (upgrades.includes("heavy_ball") ? 1.3 : 1);

  const pegs: Peg[] = buildLevel(level);
  const orangeLeft = pegs.filter(isTarget).length;

  return {
    pegs,
    ball: null,
    balls: baseBalls,
    score: keepScore ? prevScore : 0,
    phase: "aim",
    bucket: W / 2 - BUCKET_W / 2,
    bucketDir: BUCKET_SPEED,
    bucketFlash: 0,
    message: "",
    combo: 0,
    scoreMultiplier: 1,
    particles: [],
    floatingTexts: [],
    feverPulse: 0,
    animClock: 0,
    trauma: 0,
    shakeX: 0,
    shakeY: 0,
    flashWhite: 0,
    slowMoFrames: 0,
    zoomLevel: 1,
    level,
    hitFreezeFrames: 0,

    launcherX: LAUNCHER_X,
    launcherTargetX: LAUNCHER_X,
    launcherVx: 0,
    launcherDragging: false,
    launcherGrab: 0,

    stars: makeStars(),
    turnScoreStart: 0,
    orangeLeft,

    runUpgrades: [...upgrades],
    effectiveBallR,
    effectiveFeverThreshold: FEVER_THRESHOLD,
    effectiveAimSteps,
    effectivePegBounce,
  };
}
