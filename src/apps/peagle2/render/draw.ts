// ─── Peagle — canvas renderer (reads a snapshot, never mutates) ───────────────
// Draws the GameState in INTERNAL coords (canvas is sized to FIELD). The React
// layer handles CSS scaling. Decoupled from physics: it only reads positions,
// flags and the fx state. Theme is pure data.

import { FIELD } from "../content/config";
import { pegDef } from "../content/pegTypes";
import type { Theme } from "../content/themes";
import type { GameState, Peg, Vec } from "../core/types";
import { computeAimLine } from "../core/systems/aim";

export function drawFrame(ctx: CanvasRenderingContext2D, s: GameState, theme: Theme): void {
  ctx.save();

  // camera shake
  if (s.fx.shake > 0.05) {
    ctx.translate((Math.random() - 0.5) * s.fx.shake, (Math.random() - 0.5) * s.fx.shake);
  }

  drawBackground(ctx, theme);
  drawPegs(ctx, s);
  if (s.phase === "aim") drawAim(ctx, s, theme);
  drawBalls(ctx, s, theme);
  drawParticles(ctx, s);
  drawFloatingTexts(ctx, s);
  drawBucket(ctx, s, theme);
  drawLauncher(ctx, s, theme);

  ctx.restore();

  // full-screen flash (outside shake transform)
  if (s.fx.flash > 0.01) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, s.fx.flash)})`;
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, theme: Theme): void {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.h);
  g.addColorStop(0, theme.skyTop);
  g.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, FIELD.h - 10, FIELD.w, 10);
}

function pegBox(ctx: CanvasRenderingContext2D, p: Peg): void {
  const def = pegDef(p.type);
  const scale = p.hit ? 1 + p.pop * 0.6 : 1;
  const alpha = p.hit ? 1 - p.pop : 1;
  const r = p.r * scale;
  ctx.globalAlpha = alpha;
  // pixel-art bevel square
  ctx.fillStyle = def.color;
  ctx.fillRect(p.pos.x - r, p.pos.y - r, r * 2, r * 2);
  ctx.fillStyle = def.hi;
  ctx.fillRect(p.pos.x - r, p.pos.y - r, r * 2, 2);
  ctx.fillRect(p.pos.x - r, p.pos.y - r, 2, r * 2);
  ctx.fillStyle = def.dark;
  ctx.fillRect(p.pos.x - r, p.pos.y + r - 2, r * 2, 2);
  ctx.fillRect(p.pos.x + r - 2, p.pos.y - r, 2, r * 2);
  ctx.globalAlpha = 1;
}

function drawPegs(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const p of s.pegs) pegBox(ctx, p);
}

function drawAim(ctx: CanvasRenderingContext2D, s: GameState, theme: Theme): void {
  const pts = computeAimLine(s);
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // target dot
  const end = pts[pts.length - 1];
  if (end) {
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEgg(ctx: CanvasRenderingContext2D, pos: Vec, r: number, theme: Theme): void {
  ctx.fillStyle = theme.egg;
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, r * 0.86, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.eggHi;
  ctx.beginPath();
  ctx.ellipse(pos.x - r * 0.25, pos.y - r * 0.3, r * 0.28, r * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBalls(ctx: CanvasRenderingContext2D, s: GameState, theme: Theme): void {
  for (const b of s.balls) {
    // trail
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 2;
    ctx.beginPath();
    b.trail.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawEgg(ctx, b.pos, b.r, theme);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.pos.x - p.size / 2, p.pos.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  for (const t of s.floatingTexts) {
    ctx.globalAlpha = Math.max(0, t.life);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.pos.x, t.pos.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

function drawBucket(ctx: CanvasRenderingContext2D, s: GameState, theme: Theme): void {
  const b = s.bucket;
  const y = FIELD.h - 22;
  const x = b.x - b.w / 2;
  ctx.fillStyle = theme.bucket;
  ctx.fillRect(x, y, b.w, 18);
  ctx.fillStyle = theme.bucketHi;
  ctx.fillRect(x, y, b.w, 3);
  // open-top rim
  ctx.fillStyle = theme.bucketHi;
  ctx.fillRect(x - 2, y - 3, 4, 6);
  ctx.fillRect(x + b.w - 2, y - 3, 4, 6);
}

function drawLauncher(ctx: CanvasRenderingContext2D, s: GameState, theme: Theme): void {
  const { x, y } = s.launcher;
  // aim direction cannon
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(s.aimAngle);
  ctx.fillStyle = theme.bucket;
  ctx.fillRect(-4, 0, 8, 20);
  ctx.fillStyle = theme.bucketHi;
  ctx.fillRect(-4, 0, 2, 20);
  ctx.restore();
  // bird body (placeholder — pixel-art bird comes in Phase 4)
  ctx.fillStyle = theme.eggHi;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.bucket;
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + 13, y - 2);
  ctx.lineTo(x + 6, y + 3);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(x + 3, y - 2, 1.6, 0, Math.PI * 2);
  ctx.fill();
}
