import { W, H } from "../engine/constants";
import { FACE, HI, DARK } from "./theme";
import type { GameState } from "../engine/types";
import type { GameTheme } from "../engine/game-theme";

export function drawParticles(ctx: CanvasRenderingContext2D, s: GameState): void {
  const count = s.particles.length;
  if (count === 0) return;
  for (let i = 0; i < count; i++) {
    const p = s.particles[i]!;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    const psz = p.size * Math.max(0, p.life);
    if (p.size <= 2.5) {
      ctx.fillRect(p.x - psz / 2, p.y - psz / 2, psz, psz);
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, psz, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Feedback localisé d'impact : une lueur (bloom) qui illumine le décor autour
// du point de contact + un anneau carré pixel-art qui se propage en s'estompant.
// Tout est en blend additif et confiné autour de l'impact — pas de flash écran.
export function drawImpactRings(ctx: CanvasRenderingContext2D, s: GameState): void {
  const n = s.impactRings.length;
  if (n === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const r = s.impactRings[i]!;
    ctx.fillStyle = r.color;
    ctx.strokeStyle = r.color;

    // ① Bloom : plus vif à l'instant de l'impact, se résorbe vite. Quelques
    // carrés concentriques pleins → halo de lumière doux dans le décor.
    const bloom = r.life * r.life;
    if (bloom > 0.02) {
      const bloomR = (5 + r.intensity * 13) * (0.55 + 0.45 * r.life);
      const b1 = Math.round(bloomR);
      const b2 = Math.round(bloomR * 1.8);
      ctx.globalAlpha = bloom * 0.45;
      ctx.fillRect(Math.round(r.x - b1), Math.round(r.y - b1), b1 * 2, b1 * 2);
      ctx.globalAlpha = bloom * 0.18;
      ctx.fillRect(Math.round(r.x - b2), Math.round(r.y - b2), b2 * 2, b2 * 2);
    }

    // ② Anneau qui se propage (easeOut → départ rapide puis ralentit)
    const prog = 1 - r.life;
    const ease = 1 - (1 - prog) * (1 - prog);
    const radius = Math.round(r.maxRadius * ease);
    if (radius >= 1) {
      const alpha = r.life * r.life * 0.55;
      const rs = radius * 2;
      ctx.globalAlpha = alpha;
      ctx.strokeRect(Math.round(r.x - radius), Math.round(r.y - radius), rs, rs);
      if (radius > 4) {
        const r2 = radius - 3;
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeRect(Math.round(r.x - r2), Math.round(r.y - r2), r2 * 2, r2 * 2);
      }
    }
  }
  ctx.restore();
}

// easeOutBack — dépassement élastique paramétrable. c1 contrôle l'amplitude du
// rebond : 3.0 = doux (22% overshoot), 4.5 = dramatique (44% overshoot).
function easeOutBack(x: number, c1 = 3.0): number {
  const c3 = c1 + 1;
  const p = x - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}

export function drawFloatingTexts(ctx: CanvasRenderingContext2D, s: GameState): void {
  for (const t of s.floatingTexts) {
    if (t.y < -20 || t.y > H + 20) continue;
    const age = 1 - t.life;
    const lifeRatio = Math.min(1, t.life * 2);
    const fontSize = t.fontSize ?? (t.combo ? 13 : 11);

    // Overshoot calibré par type : exclaim = dramatique, combo = moyen, score = doux.
    const appearDur = t.exclaim ? 0.24 : 0.18;
    const appear = Math.min(1, age / appearDur);
    const c1 = t.exclaim ? 4.5 : t.combo ? 3.5 : 3.0;
    const eb = easeOutBack(appear, c1);

    // Squash & stretch : eb clamped → pas de rebond sur les axes, seulement sur popScale.
    // Spawn = large+court (encre qui claque), settle = normal, overshoot sur la scale globale.
    const ebC = Math.min(1, eb);
    const sqFac = 1 - ebC;                              // 1 au spawn → 0 quand calé
    const scaleX = 1 + sqFac * (t.exclaim ? 0.15 : 0.22);
    const scaleY = 1 - sqFac * (t.exclaim ? 0.18 : 0.27);

    let popScale = t.exclaim ? 0.35 + eb * 0.78 : 0.6 + eb * 0.45;

    // Micro-rebond amorti après le pop initial — oscillation rapide qui s'estompe en ~0.3s.
    const settleAge = Math.max(0, age - appearDur);
    popScale *= 1 + Math.sin(settleAge * 32) * 0.055 * Math.exp(-settleAge * 14);

    ctx.save();
    ctx.globalAlpha = lifeRatio;
    ctx.translate(t.x, t.y);

    if (t.exclaim) {
      // Inclinaison + battement cardiaque — amplitude renforcée
      const wobble = Math.sin(age * 18 + (t.spin ?? 0) * 3) * 0.07 * t.life;
      ctx.rotate((t.spin ?? 0) * 0.05 + wobble);
      popScale *= 1 + Math.sin(age * 22) * 0.065 * t.life;
    }

    ctx.scale(popScale * scaleX, popScale * scaleY);
    ctx.font = `bold ${fontSize}px "MS Sans Serif", monospace`;
    ctx.textAlign = "center";

    if (t.exclaim) {
      // Aberration chromatique : split R/B additif au spawn, fondu sur ~20 frames.
      const caI = Math.max(0, 1 - age * t.maxLife * 2.5);
      if (caI > 0.02) {
        const caOff = Math.round(caI * 3.5);
        ctx.save();
        ctx.globalAlpha = lifeRatio * caI * 0.65;
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "#ff1830";
        ctx.fillText(t.text, -caOff, 0);
        ctx.fillStyle = "#00e5ff";
        ctx.fillText(t.text, caOff, 0);
        ctx.restore();
      }
      drawExclaimText(ctx, t.text, t.color, fontSize, lifeRatio);
    } else if (t.combo && fontSize >= 13) {
      const tw = ctx.measureText(t.text).width;
      const ph = 6, pv = 3;
      const bx = -tw / 2 - ph;
      const by = -fontSize - pv;
      const bw = tw + ph * 2;
      const bh = fontSize + pv * 2;

      ctx.fillStyle = "rgba(0,0,0,0.48)";
      ctx.fillRect(bx + 2, by + 2, bw, bh);
      ctx.fillStyle = FACE;
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = HI;
      ctx.fillRect(bx, by, bw, 1);
      ctx.fillRect(bx, by, 1, bh);
      ctx.fillStyle = DARK;
      ctx.fillRect(bx, by + bh - 1, bw, 1);
      ctx.fillRect(bx + bw - 1, by, 1, bh);

      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
    } else {
      // Contour pixel 8 directions : lisible sur n'importe quel fond, même dense.
      ctx.fillStyle = "rgba(0,0,0,0.88)";
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx || dy) ctx.fillText(t.text, dx, dy);
        }
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
    }

    ctx.restore();
  }
}

// Exclamation hype : glow additif + contour pixel noir + corps coloré + reflet
// blanc sur la moitié haute. Le texte respire grâce au pop/wobble de l'appelant.
function drawExclaimText(
  ctx: CanvasRenderingContext2D, text: string, color: string, fontSize: number, lifeRatio: number,
): void {
  // ① Glow additif derrière (deux passes pour intensifier)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = lifeRatio * 0.32;
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.restore();

  // ② Contour pixel noir (8 directions)
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx || dy) ctx.fillText(text, dx, dy);
    }
  }

  // ③ Corps coloré
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);

  // ④ Reflet blanc clippé sur la moitié supérieure
  ctx.save();
  ctx.beginPath();
  ctx.rect(-300, -fontSize, 600, fontSize * 0.58);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Overlay de ralenti : teinte bleue glacée + vignette froide qui respire +
// scanlines lentes. L'intensité suit la profondeur du slow-mo (0..1) → le rendu
// se fige visuellement pile quand le temps se fige, surtout près du panier.
let _smGradient: CanvasGradient | null = null;
let _smGradientAlpha = -1;

export function drawSlowMoOverlay(ctx: CanvasRenderingContext2D, s: GameState, intensity: number): void {
  if (intensity <= 0.02) return;
  const a = Math.min(1, intensity);
  // Respiration lente pour que l'écran "vibre" doucement pendant le ralenti.
  const pulse = 0.85 + 0.15 * Math.sin(s.animClock * 2.4);

  ctx.save();

  // ① Teinte bleue froide sur tout le plateau.
  ctx.globalAlpha = a * 0.13 * pulse;
  ctx.fillStyle = "#3a5cff";
  ctx.fillRect(0, 0, W, H);

  // ② Vignette froide qui assombrit les bords (gradient caché par alpha arrondi).
  const vigA = Math.round(a * pulse * 20) / 20;
  if (_smGradient === null || vigA !== _smGradientAlpha) {
    _smGradient = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.8);
    _smGradient.addColorStop(0, "transparent");
    _smGradient.addColorStop(1, `rgba(0,4,40,${vigA * 0.5})`);
    _smGradientAlpha = vigA;
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = _smGradient;
  ctx.fillRect(0, 0, W, H);

  // ③ Scanlines lentes qui défilent → sensation de temps étiré.
  ctx.globalAlpha = a * 0.1;
  ctx.fillStyle = "#000018";
  const off = Math.floor(s.animClock * 14) % 4;
  for (let y = off; y < H; y += 4) ctx.fillRect(0, y, W, 1);

  ctx.restore();
}

export function drawScreenFlash(ctx: CanvasRenderingContext2D, s: GameState, inClutch: boolean, theme: GameTheme): void {
  if (s.flashWhite <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, s.flashWhite * 0.36);
  ctx.fillStyle = inClutch ? theme.flash.clutch : theme.flash.normal;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// createRadialGradient is expensive — cache it, rebuild only when alpha changes noticeably
export function drawBezel(ctx: CanvasRenderingContext2D): void {
  const W_canvas = 480;
  const H_canvas = 640;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath(); ctx.moveTo(0, H_canvas); ctx.lineTo(0, 0); ctx.lineTo(W_canvas, 0); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.moveTo(1, H_canvas - 1); ctx.lineTo(1, 1); ctx.lineTo(W_canvas - 1, 1); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath(); ctx.moveTo(0, H_canvas); ctx.lineTo(W_canvas, H_canvas); ctx.moveTo(W_canvas, 0); ctx.lineTo(W_canvas, H_canvas); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath(); ctx.moveTo(1, H_canvas - 1); ctx.lineTo(W_canvas - 1, H_canvas - 1); ctx.moveTo(W_canvas - 1, 1); ctx.lineTo(W_canvas - 1, H_canvas - 1); ctx.stroke();
  ctx.restore();
}
