import { PEG_R, PEG_REVEAL_ANIM_DUR } from "../engine/constants";
import type { GameState, Peg } from "../engine/types";
import { getPegType } from "../engine/types";
import type { GameTheme, PegTheme } from "../engine/game-theme";

function easeOutBack(t: number): number {
  const c1 = 2.2, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Faux glow pixel — 3 rects concentriques semi-transparents au lieu de ctx.shadowBlur
// (shadowBlur déclenche une passe gaussienne GPU par draw call ; ceci est ~10× moins cher).
function pixelGlow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, glowColor: string, glowBlur: number): void {
  const g1 = Math.ceil(glowBlur * 0.3) | 0;
  const g2 = Math.ceil(glowBlur * 0.6) | 0;
  const g3 = Math.ceil(glowBlur) | 0;
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = 0.28;
  ctx.fillRect(x - g1, y - g1, s + g1 * 2, s + g1 * 2);
  ctx.globalAlpha = 0.13;
  ctx.fillRect(x - g2, y - g2, s + g2 * 2, s + g2 * 2);
  ctx.globalAlpha = 0.06;
  ctx.fillRect(x - g3, y - g3, s + g3 * 2, s + g3 * 2);
  ctx.globalAlpha = 1;
}

// Peg carré pixel-art avec bevel 1px
function pixelSquare(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  fill: string, hiColor: string, darkColor: string,
  glowColor?: string, glowBlur?: number,
): void {
  const s = Math.round(r * 2);
  const x = Math.round(cx - r);
  const y = Math.round(cy - r);

  if (glowColor && glowBlur) pixelGlow(ctx, x, y, s, glowColor, glowBlur);

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, s, s);

  ctx.fillStyle = hiColor;
  ctx.fillRect(x, y, s, 1);       // top
  ctx.fillRect(x, y, 1, s);       // left
  ctx.fillStyle = darkColor;
  ctx.fillRect(x, y + s - 1, s, 1); // bottom
  ctx.fillRect(x + s - 1, y, 1, s); // right

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(x + 1, y + 1, 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, 2);
}

// Peg "hit" — plus sombre, sans bevel
function pixelSquareHit(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string): void {
  const s = Math.round(r * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(cx - r), Math.round(cy - r), s, s);
}

// hexAlpha cache — évite une alloc de string par peg par frame
const _hexAlphaCache = new Map<string, string>();
function hexAlpha(hex: string, a: number): string {
  const key = `${hex}:${a}`;
  let v = _hexAlphaCache.get(key);
  if (!v) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    v = `rgba(${r},${g},${b},${a.toFixed(2)})`;
    _hexAlphaCache.set(key, v);
  }
  return v;
}

function drawOrangePeg(ctx: CanvasRenderingContext2D, p: Peg, r: number, inFever: boolean, feverIntensity: number, t: PegTheme): void {
  if (!p.hit) {
    if (inFever) {
      pixelSquare(ctx, p.x, p.y, r, t.orangeFever, t.orangeGlow, t.orangeDark, t.orangeGlow, 14 + feverIntensity * 14);
    } else {
      pixelSquare(ctx, p.x, p.y, r, t.orange, t.orangeHi, t.orangeDark, hexAlpha(t.orange, 0.4), 5);
    }
  } else {
    pixelSquareHit(ctx, p.x, p.y, r, t.orangeDark);
  }
}

function drawNormalPeg(ctx: CanvasRenderingContext2D, p: Peg, r: number, t: PegTheme): void {
  if (!p.hit) {
    pixelSquare(ctx, p.x, p.y, r, t.normal, t.normalHi, t.normalDark);
  } else {
    pixelSquareHit(ctx, p.x, p.y, r, t.normalDark);
  }
}

// Bumper : obstacle permanent, légèrement plus gros, qui flashe quand on le
// percute (p.bump 0..1). Jamais "hit" → toujours dessiné plein.
function drawBumperPeg(ctx: CanvasRenderingContext2D, p: Peg, r: number, t: PegTheme): void {
  const fill = p.bump > 0.4 ? (t.bumperHi ?? "#fff0a0") : (t.bumper ?? "#ffcc22");
  const hi = t.bumperHi ?? "#fff0a0";
  const dark = t.bumperDark ?? "#aa6600";
  const glow = t.bumperGlow ?? "#ffee66";
  pixelSquare(ctx, p.x, p.y, r * 1.18, fill, hi, dark, glow, 5 + p.bump * 18);
  // Plot central (cible du bumper)
  const cx = Math.round(p.x), cy = Math.round(p.y);
  ctx.fillStyle = p.bump > 0.3 ? "#ffffff" : dark;
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
}

export function drawPegs(ctx: CanvasRenderingContext2D, s: GameState, inFever: boolean, feverIntensity: number, theme: GameTheme): void {
  const t = theme.peg;
  ctx.imageSmoothingEnabled = false;

  for (const p of s.pegs) {
    const raw = s.animClock - p.revealT;
    if (raw < 0) continue; // pas encore révélé

    const revT = Math.min(1, raw / PEG_REVEAL_ANIM_DUR);
    const inReveal = revT < 1;

    if (inReveal) {
      const spring = easeOutBack(revT);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(spring, spring);
      ctx.translate(-p.x, -p.y);

      // Halo flash à l'apparition — pic brillant sur les 25 premières %
      const flash = Math.max(0, 1 - revT / 0.25) * 0.75;
      if (flash > 0.01) {
        const glowR = PEG_R * (3.5 + flash * 4.5);
        const glowColor = p.kind === "orange" ? "#ffbb44" : p.kind === "bumper" ? "#ffee55" : "#9fb8ff";
        ctx.globalAlpha = flash * 0.55;
        ctx.fillStyle = glowColor;
        ctx.fillRect(Math.round(p.x - glowR), Math.round(p.y - glowR), Math.round(glowR * 2), Math.round(glowR * 2));
        ctx.globalAlpha = 1;
      }
    }

    const pulseExtra = inFever && p.kind === "orange" && !p.hit ? Math.sin(s.feverPulse * 2) * 1.5 : 0;
    const r = (PEG_R + pulseExtra) * p.scale;

    if (p.popping) ctx.globalAlpha = p.popAlpha;

    if (p.kind === "orange") drawOrangePeg(ctx, p, r, inFever, feverIntensity, t);
    else if (p.kind === "bumper") drawBumperPeg(ctx, p, r, t);
    else drawNormalPeg(ctx, p, r, t);

    if (p.popping) {
      const ringR = PEG_R + (1 - p.popAlpha) * 18;
      const rs = Math.round(ringR * 2);
      ctx.globalAlpha = p.popAlpha * 0.8;
      ctx.strokeStyle = t.popRing[getPegType(p)];
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(p.x - ringR), Math.round(p.y - ringR), rs, rs);
      ctx.globalAlpha = 1;
    }

    if (inReveal) ctx.restore();
  }
}
