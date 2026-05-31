import { BALL_R } from "../engine/constants";
import { getActiveBall } from "../engine/assets";
import type { Ball } from "../engine/types";

export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, inSlowMo: boolean): void {
  const style = getActiveBall();
  // Trail pixel art — ring buffer: trailHead is the oldest write slot (= visual start)
  const trailLen = ball.trail.length;
  if (trailLen > 0) {
    const trailColor = ball.tint ?? (inSlowMo ? "#88aaff" : "#555588");
    const head = ball.trailHead;
    ctx.fillStyle = trailColor;
    for (let i = 0; i < trailLen; i++) {
      const idx = (head + i) % trailLen;
      const tp = ball.trail[idx]; if (!tp) continue;
      const t = i / trailLen;
      const trailR = Math.round(Math.max(1, BALL_R * t * 0.7));
      ctx.globalAlpha = t * t * 0.35;
      ctx.fillRect(
        Math.round(tp.x - trailR),
        Math.round(tp.y - trailR),
        trailR * 2, trailR * 2,
      );
    }
    ctx.globalAlpha = 1;
  }

  const bx = Math.round(ball.x);
  const by = Math.round(ball.y);
  const br = BALL_R;

  ctx.save();

  // Fake pixel glow — cheaper than shadowBlur (no GPU Gaussian pass)
  const glowColor = inSlowMo ? "#88aaff" : (ball.tint ?? style.glow);
  const glowR = inSlowMo ? 8 : (ball.tint ? 6 : 4);
  const bsz = br * 2;
  const bx0 = bx - br;
  const by0 = by - br;
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = 0.22;
  ctx.fillRect(bx0 - 2, by0 - 2, bsz + 4, bsz + 4);
  if (glowR >= 6) {
    ctx.globalAlpha = 0.10;
    ctx.fillRect(bx0 - 4, by0 - 4, bsz + 8, bsz + 8);
  }
  if (glowR >= 8) {
    ctx.globalAlpha = 0.05;
    ctx.fillRect(bx0 - 6, by0 - 6, bsz + 12, bsz + 12);
  }
  ctx.globalAlpha = 1;

  // Corps principal pixel (carré arrondi — 3 rectangles superposés)
  const fill = inSlowMo ? "#aaccff" : (ball.tint ?? style.body);
  ctx.fillStyle = fill;
  ctx.fillRect(bx - br + 1, by - br, br * 2 - 2, br * 2);     // centre
  ctx.fillRect(bx - br, by - br + 1, br * 2, br * 2 - 2);     // côtés

  // Bevel pixel — top/left clairs, bottom/right sombres
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx - br + 1, by - br, br * 2 - 2, 1);  // top
  ctx.fillRect(bx - br, by - br + 1, 1, br * 2 - 2);  // left
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(bx - br + 1, by + br - 1, br * 2 - 2, 1); // bottom
  ctx.fillRect(bx + br - 1, by - br + 1, 1, br * 2 - 2); // right

  // Pixel highlight coin
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(bx - br + 1, by - br + 1, 2, 1);
  ctx.fillRect(bx - br + 1, by - br + 1, 1, 2);

  // Egg speckles — small pixel dots like a speckled egg
  ctx.fillStyle = inSlowMo ? "rgba(60,100,220,0.55)" : style.speckle;
  ctx.fillRect(bx - 1, by - br + 2, 2, 1);  // top speckle
  ctx.fillRect(bx + br - 3, by - 1, 1, 2);  // right speckle
  ctx.fillRect(bx - br + 2, by + 1, 1, 1);  // left speckle
  ctx.fillRect(bx, by + br - 3, 2, 1);      // bottom speckle

  ctx.restore();
}
