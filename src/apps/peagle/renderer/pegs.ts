import { PEG_R, PEG_REVEAL_ANIM_DUR } from "../engine/constants";
import type { GameState, Peg } from "../engine/types";
import type { GameTheme, PegTheme } from "../engine/game-theme";
import { roundGlowRect, pixelGlow3, cornerHighlightL } from "./helpers";

// Rebond d'apparition — overshoot marqué (c1 élevé) : le peg jaillit franchement
// au-delà de sa taille puis se replace. Plus le c1 est grand, plus le "pop" claque.
function easeOutBack(t: number): number {
  const c1 = 3.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Faux glow pixel d'un peg (carré s×s) — délègue à pixelGlow3 (cf. helpers.ts), qui
// empile 3 roundGlowRect au lieu d'un ctx.shadowBlur (~10× moins cher, et coins ébréchés
// pour ne pas redonner une silhouette carrée au halo, surtout intense en clutch).
function pixelGlow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, glowColor: string, glowBlur: number): void {
  pixelGlow3(ctx, x, y, s, s, glowColor, glowBlur);
}

// Corps « peg arrondi » pixel-art : carré dont on a retiré 1px à chaque coin.
// L'union d'un rect vertical (privé de ses lignes haut/bas) et d'un rect horizontal
// (privé de ses colonnes gauche/droite) = carré ébréché 1px — même langage que le
// border-radius des boutons, sans casser le rendu pixel (aucun anti-aliasing).
function pixelRoundBody(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillRect(x + 1, y, s - 2, s);     // colonne centrale (pleine hauteur)
  ctx.fillRect(x, y + 1, s, s - 2);     // ligne centrale (pleine largeur)
}

// Peg arrondi pixel-art avec bevel 1px
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
  pixelRoundBody(ctx, x, y, s);

  // Bevel : arêtes claires haut/gauche, sombres bas/droite — rognées de 1px aux
  // extrémités pour épouser les coins ébréchés (l'arête ne dépasse pas du coin).
  ctx.fillStyle = hiColor;
  ctx.fillRect(x + 1, y, s - 2, 1);       // top
  ctx.fillRect(x, y + 1, 1, s - 2);       // left
  ctx.fillStyle = darkColor;
  ctx.fillRect(x + 1, y + s - 1, s - 2, 1); // bottom
  ctx.fillRect(x + s - 1, y + 1, 1, s - 2); // right

  cornerHighlightL(ctx, x, y);
}

// Peg "hit" — plus sombre, sans bevel (mêmes coins ébréchés que le peg plein)
function pixelSquareHit(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string): void {
  const s = Math.round(r * 2);
  const x = Math.round(cx - r);
  const y = Math.round(cy - r);
  ctx.fillStyle = fill;
  pixelRoundBody(ctx, x, y, s);
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

function drawOrangePeg(ctx: CanvasRenderingContext2D, p: Peg, r: number, inClutch: boolean, clutchIntensity: number, t: PegTheme): void {
  if (!p.hit) {
    if (inClutch) {
      // Clutch : peg cible et halo en orange (le rose est désactivé), juste un glow
      // plus intense que le repos pour garder le punch de la fièvre.
      pixelSquare(ctx, p.x, p.y, r, t.orange, t.orangeHi, t.orangeDark, hexAlpha(t.orange, 0.5), 14 + clutchIntensity * 14);
    } else {
      pixelSquare(ctx, p.x, p.y, r, t.orange, t.orangeHi, t.orangeDark, hexAlpha(t.orange, 0.4), 5);
    }
  } else {
    pixelSquareHit(ctx, p.x, p.y, r, t.orangeDark);
  }
}

function drawNormalPeg(ctx: CanvasRenderingContext2D, p: Peg, r: number, t: PegTheme): void {
  if (!p.hit) {
    // Halo vert « flou » discret façon glow des boutons OPTIONS (même langage que
    // le glow doux du peg orange au repos), pour que le vert vif respire sur le ciel.
    const glow = t.normalGlow ?? t.normalHi;
    pixelSquare(ctx, p.x, p.y, r, t.normal, t.normalHi, t.normalDark, hexAlpha(glow, 0.4), 5);
  } else {
    pixelSquareHit(ctx, p.x, p.y, r, t.normalDark);
  }
}

// Bumper : obstacle permanent — beaucoup plus gros et visuellement distinct
// des pegs normaux. Forme diamant (carré tourné 45°) + croix centrale + glow
// permanent pulsé même au repos.
function drawBumperPeg(
  ctx: CanvasRenderingContext2D,
  p: Peg, r: number, t: PegTheme,
  animClock: number,
): void {
  const fill = p.bump > 0.4 ? (t.bumperHi ?? "#fff0a0") : (t.bumper ?? "#ffcc22");
  const hi = t.bumperHi ?? "#fff0a0";
  const dark = t.bumperDark ?? "#aa6600";
  const glow = t.bumperGlow ?? "#ffee66";

  // Glow pulsé même au repos (idle) — clairement différent d'un peg normal.
  const idlePulse = (Math.sin(animClock * 2.8 + p.x * 0.05) * 0.5 + 0.5); // 0..1
  const glowBlur = p.bump > 0 ? 8 + p.bump * 28 : 5 + idlePulse * 7;

  const br = r * 1.5; // bumper rayon — nettement plus gros qu'un peg normal
  const cx = Math.round(p.x), cy = Math.round(p.y);

  // ── Forme diamant : carré tourné 45° ──
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);

  // Glow externe — alphas un cran plus vifs que le peg standard (bumper = obstacle marquant).
  const s = Math.round(br * 2);
  const hx = Math.round(-br), hy = Math.round(-br);
  pixelGlow3(ctx, hx, hy, s, s, glow, glowBlur, [0.30, 0.14, 0.07]);

  // Corps principal
  ctx.fillStyle = fill;
  ctx.fillRect(hx, hy, s, s);

  // Bevel raised (Win98 style)
  ctx.fillStyle = hi;
  ctx.fillRect(hx, hy, s, 1);     // top
  ctx.fillRect(hx, hy, 1, s);     // left
  ctx.fillStyle = dark;
  ctx.fillRect(hx, hy + s - 1, s, 1); // bottom
  ctx.fillRect(hx + s - 1, hy, 1, s); // right

  // Reflet coin (pixel-art)
  cornerHighlightL(ctx, hx, hy, 0.75);

  ctx.restore();

  // ── Croix centrale (cible de bumper — style pinball) ──
  const crossColor = p.bump > 0.3 ? "#ffffff" : dark;
  ctx.fillStyle = crossColor;
  ctx.fillRect(cx - 3, cy - 1, 6, 2); // barre horizontale
  ctx.fillRect(cx - 1, cy - 3, 2, 6); // barre verticale
}

export function drawPegs(ctx: CanvasRenderingContext2D, s: GameState, inClutch: boolean, clutchIntensity: number, theme: GameTheme): void {
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

      // Halo flash à l'apparition — un seul glow coloré net et discret, qui
      // s'évanouit vite (30 % du reveal). Pas de cœur blanc : on garde l'éclat
      // sobre, c'est le rebond élastique qui porte le punch.
      const flash = Math.max(0, 1 - revT / 0.3);
      if (flash > 0.01) {
        const glowColor = p.kind === "orange" ? "#ffbb44" : p.kind === "bumper" ? "#ffee55" : "#b4ec6a";
        const glowR = PEG_R * (2.5 + flash * 3.5);
        ctx.globalAlpha = flash * 0.5;
        ctx.fillStyle = glowColor;
        roundGlowRect(ctx, Math.round(p.x - glowR), Math.round(p.y - glowR), Math.round(glowR * 2));
        ctx.globalAlpha = 1;
      }
    }

    const pulseExtra = inClutch && p.kind === "orange" && !p.hit ? Math.sin(s.clutchPulse * 2) * 1.5 : 0;
    const r = (PEG_R + pulseExtra) * p.scale;

    const popping = p.popping;
    if (popping) ctx.globalAlpha = p.popAlpha;

    if (p.kind === "orange") drawOrangePeg(ctx, p, r, inClutch, clutchIntensity, t);
    else if (p.kind === "bumper") drawBumperPeg(ctx, p, r, t, s.animClock);
    else drawNormalPeg(ctx, p, r, t);

    // Remet l'alpha à 1 : un peg sans glow (peg normal) ne passe pas par
    // pixelGlow3 (qui restaurait l'alpha), donc un popAlpha < 1 fuirait sur tous
    // les pegs dessinés ensuite — ils clignotaient à chaque pop.
    if (popping) ctx.globalAlpha = 1;

    if (inReveal) ctx.restore();
  }
}
