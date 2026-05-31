import type { GameState } from "../engine/types";
import type { GameTheme } from "../engine/game-theme";
import { PEG_R } from "../engine/constants";
import { drawBackground } from "./background";
import { drawPegs } from "./pegs";
import { drawAimLine, drawLauncher, drawBuckets } from "./ui";
import { drawBall } from "./ball";
import { drawParticles, drawFloatingTexts, drawScreenFlash, drawVignette, drawBezel } from "./effects";

export interface RenderOpts {
  theme:        GameTheme;
  showHitboxes?: boolean;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  aimAngle: number,
  orangeLeft: number,
  opts: RenderOpts,
): void {
  const { theme, showHitboxes = false } = opts;
  const inFever = orangeLeft <= s.effectiveFeverThreshold && orangeLeft > 0;
  const feverIntensity = inFever ? 1 : 0;
  const inSlowMo = s.slowMoFrames > 0;
  const hasZoom = s.zoomLevel > 1.01 && s.ball?.active;

  ctx.save();

  // Caméra : zoom suit l'œuf en slow-mo, sinon juste le screen shake
  if (hasZoom && s.ball) {
    const W = 480, H = 640;
    ctx.translate(s.shakeX * 0.4, s.shakeY * 0.4);
    ctx.translate(W / 2, H / 2);
    ctx.scale(s.zoomLevel, s.zoomLevel);
    ctx.translate(-s.ball.x, -s.ball.y);
  } else {
    ctx.translate(s.shakeX, s.shakeY);
  }

  drawBackground(ctx, s, feverIntensity, theme);
  drawAimLine(ctx, s, aimAngle);
  drawPegs(ctx, s, inFever, feverIntensity, theme);
  drawParticles(ctx, s);

  if (s.ball?.active) drawBall(ctx, s.ball, inSlowMo);

  drawFloatingTexts(ctx, s);
  drawLauncher(ctx, s, aimAngle);
  drawBuckets(ctx, s);

  ctx.restore(); // fin transform caméra

  drawBezel(ctx);
  drawScreenFlash(ctx, s, inFever, theme);
  drawVignette(ctx, s);

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
