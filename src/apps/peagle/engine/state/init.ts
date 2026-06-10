import {
  BALL_R, CLUTCH_THRESHOLD, AIM_LINE_STEPS, PEG_BOUNCE,
  W, BUCKET_W, BUCKET_SPEED, START_BALLS, STAR_COUNT, LAUNCHER_X,
  PEG_REVEAL_START, PEG_REVEAL_STRIDE, PEG_REVEAL_ANIM_DUR,
} from "../constants";
import { buildLevel } from "../levels";
import { isTarget } from "../peg-kinds";
import { mulberry32, hashSeed, type Rng } from "../rng";
import { pickRevealOrder } from "../reveal-patterns";
import type { GameState, Peg, Star } from "../types";
import type { RunState } from "../roguelite";

function makeStars(rng: Rng): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: rng() * W,
    y: rng() * 640,
    layer: Math.floor(rng() * 3) as 0 | 1 | 2,
    size: 0.4 + rng() * 1.4,
    phase: rng() * Math.PI * 2,
  }));
}

export function makeInitialState(
  level: number,
  runState: RunState,
  keepScore: boolean,
  prevScore: number,
): GameState {
  const { upgrades } = runState;

  // RNG de simulation, déterministe et distinct par niveau. Re-rejouer le même
  // niveau (même seed) redonne exactement la même partie.
  const rng = mulberry32(hashSeed(runState.seed, level));

  const baseBalls = START_BALLS + (upgrades.includes("extra_ball") ? 1 : 0);
  const effectiveBallR = BALL_R * (upgrades.includes("bigger_ball") ? 1.3 : 1);
  const effectiveAimSteps = Math.round(AIM_LINE_STEPS * (upgrades.includes("sharp_aim") ? 1.6 : 1));
  const effectivePegBounce = PEG_BOUNCE * (upgrades.includes("heavy_ball") ? 1.3 : 1);

  const pegs: Peg[] = buildLevel(level, runState.seed);
  const orangeLeft = pegs.filter(isTarget).length;

  // Vague d'apparition : les pegs popent un par un selon un pattern tiré au hasard
  // (diagonal, haut→bas, spirale, centre→extérieur, confettis…). L'ordre vient du
  // rng seedé du niveau (déterministe pour un même seed, sans impact sur le gameplay
  // ni le leaderboard).
  const order = pickRevealOrder(pegs, rng);
  for (let i = 0; i < order.length; i++) {
    pegs[order[i]!]!.revealT = PEG_REVEAL_START + i * PEG_REVEAL_STRIDE;
  }
  const introEndT = PEG_REVEAL_START + (pegs.length - 1) * PEG_REVEAL_STRIDE + PEG_REVEAL_ANIM_DUR;

  return {
    pegs,
    ball: null,
    balls: baseBalls,
    score: keepScore ? prevScore : 0,
    phase: "intro",
    introEndT,
    bucket: W / 2 - BUCKET_W / 2,
    bucketDir: BUCKET_SPEED,
    bucketFlash: 0,
    message: "",
    combo: 0,
    bumperChainShot: 0,
    bucketStreak: 0,
    particles: [],
    floatingTexts: [],
    hypeTexts: [],
    impactRings: [],
    clutchPulse: 0,
    animClock: 0,
    trauma: 0,
    shakeX: 0,
    shakeY: 0,
    flashWhite: 0,
    slowMoFrames: 0,
    timeWarp: 1,
    level,
    hitFreezeFrames: 0,

    launcherX: LAUNCHER_X,
    launcherTargetX: LAUNCHER_X,
    launcherVx: 0,
    launcherDragging: false,
    launcherGrab: 0,
    launcherHovered: false,

    stars: makeStars(rng),
    birds: [],
    turnScoreStart: 0,
    orangeLeft,
    turnBluePts: 0,
    turnOrangeCount: 0,
    orangeLostThisTurn: false,
    lastPayout: null,
    payoutAt: 0,
    pendingJackpot: 0,
    pendingJackpotBalls: 0,
    pendingStreakBonus: 0,

    startBalls: baseBalls,
    duskProgress: 0,
    runUpgrades: [...upgrades],
    effectiveBallR,
    effectiveClutchThreshold: CLUTCH_THRESHOLD,
    effectiveAimSteps,
    effectivePegBounce,

    lastTurnHitCount: -1,
    aimStartClock: 0,
    lastRevealSfxT: -999,

    lastHitClock: -999,
    lastHitWasOrange: false,
    fireStartClock: 0,
    whiffAt: 0,

    forestSeed: (runState.seed ^ 0xf0e5741b) >>> 0,
    levelWonAt: 0,
    lostAt: 0,

    rng,
  };
}
