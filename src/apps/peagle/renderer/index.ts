import type { GameState } from "../engine/types";
import type { GameTheme } from "../engine/game-theme";
import { PEG_R } from "../engine/constants";
import { drawBackground } from "./background";
import { drawPegs } from "./pegs";
import { drawAimLine, drawLauncher, drawBuckets } from "./ui";
import { drawBall } from "./ball";
import { drawParticles, drawFloatingTexts, drawScreenFlash, drawSlowMoOverlay, drawBezel, drawImpactRings } from "./effects";
import { drawHud } from "./hud";

export interface RenderOpts {
  theme:         GameTheme;
  showHitboxes?: boolean;
  bestScore?:    number;
  orangeTotal?:  number;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  aimAngle: number,
  orangeLeft: number,
  opts: RenderOpts,
): void {
  const { theme, showHitboxes = false, bestScore = 0, orangeTotal = 0 } = opts;
  const inFever = orangeLeft <= s.effectiveFeverThreshold && orangeLeft > 0;
  const feverIntensity = inFever ? 1 : 0;
  // Intensité visuelle du ralenti dérivée de la vitesse du temps lissée.
  const slowVis = Math.max(0, Math.min(1, (1 - s.timeWarp) / 0.85));
  const inSlowMo = slowVis > 0.08;

  ctx.save();

  // Caméra : plus de zoom en fin de niveau, juste le screen shake.
  ctx.translate(s.shakeX, s.shakeY);

  drawBackground(ctx, s, feverIntensity, theme);
  drawImpactRings(ctx, s);   // ondes de choc dans le décor, derrière les pegs
  drawAimLine(ctx, s, aimAngle);
  drawPegs(ctx, s, inFever, feverIntensity, theme);
  drawParticles(ctx, s);

  if (s.ball?.active) drawBall(ctx, s.ball, inSlowMo, orangeLeft === 0);

  drawFloatingTexts(ctx, s);
  drawLauncher(ctx, s, aimAngle);
  drawBuckets(ctx, s);

  ctx.restore(); // fin transform caméra

  drawSlowMoOverlay(ctx, s, slowVis);
  drawBezel(ctx);
  drawScreenFlash(ctx, s, inFever, theme);

  // HUD façon mobile : enseigne in-canvas, par-dessus tout sauf le flash écran
  if (s.phase !== "lost" && s.phase !== "won") {
    drawHud(ctx, s, orangeLeft, orangeTotal, bestScore, theme);
  }

  if (showHitboxes) drawDebugHitboxes(ctx, s);
}

function drawDebugHitboxes(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,0,0.5)";
  ctx.lineWidth = 1;
  for (const p of s.pegs) {
    if (p.hit) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PEG_R, 0, Math.PI * 2);
    ctx.stroke();
  }
  const ballR = s.effectiveBallR;
  if (s.ball?.active) {
    ctx.strokeStyle = "rgba(0,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(s.ball.x, s.ball.y, ballR, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
