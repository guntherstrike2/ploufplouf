import { W, H } from "../engine/constants";
import { TEXT_FX } from "../engine/palette";
import type { GameState } from "../engine/types";
import type { GameTheme } from "../engine/game-theme";
import { pgUiFont } from "./fonts";
import { drawBitmapText, bitmapTextWidth, PX_HYPE } from "./text-bitmap";
import { roundGlowRect, roundStrokeRect } from "./helpers";

// fontSize (px, hérité de l'ère ctx.font) → scale de dot bitmap. La cellule fait
// PX_HYPE.rows dots de haut ; on vise ~fontSize px de haut, arrondi à l'entier le plus
// proche (≥1) pour des dots NETS. Ex (cellule 8) : fontSize 13 → 2 (16px), 11 → 1 (8px).
function scaleForFont(fontSize: number): number {
  return Math.max(1, Math.round(fontSize / PX_HYPE.rows));
}

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
  for (let i = 0; i < n; i++) {
    const r = s.impactRings[i]!;
    ctx.fillStyle = r.color;

    const prog = 1 - r.life;   // 0 (impact) → 1 (dissipée)

    // ① Flash blanc d'impact — pic sur les ~18 premiers % de vie, en additif.
    // Le cerveau enregistre le COUP avant d'en voir la conséquence (juice n°1).
    const flash = Math.max(0, 1 - prog / 0.18);
    if (flash > 0.01) {
      // Rayon serré au peg touché (PEG_R = 4 → ~8px de diamètre). L'ancien rayon
      // (6 + intensity·10 ≈ 16px = 4 pegs de large) débordait sur les voisins et
      // les faisait scintiller en blanc. Ici on reste ≈ 1 peg, l'intensité ne
      // joue plus que sur l'OPACITÉ du flash, pas sur sa taille.
      const fr = Math.round(5 + Math.min(r.intensity, 1) * 3);
      ctx.globalAlpha = flash * flash * 0.16;
      ctx.fillStyle = "#ffffff";
      roundGlowRect(ctx, r.x - fr, r.y - fr, fr * 2);
      ctx.fillStyle = r.color;
    }

    // ② Bloom : plus vif à l'instant de l'impact, se résorbe vite. Quelques
    // carrés concentriques pleins → halo de lumière doux dans le décor.
    const bloom = r.life * r.life;
    if (bloom > 0.02) {
      const bloomR = (5 + r.intensity * 13) * (0.55 + 0.45 * r.life);
      const b1 = Math.round(bloomR);
      const b2 = Math.round(bloomR * 1.8);
      ctx.globalAlpha = bloom * 0.45;
      roundGlowRect(ctx, Math.round(r.x - b1), Math.round(r.y - b1), b1 * 2);
      ctx.globalAlpha = bloom * 0.18;
      roundGlowRect(ctx, Math.round(r.x - b2), Math.round(r.y - b2), b2 * 2);
    }

    // ③ Anneau principal qui se propage (easeOut → départ rapide puis ralentit).
    // Coins ébréchés (pixel-art) + épaisseur dégressive 3px→1px : une onde qui
    // voyage s'affine en s'élargissant → lecture « énergie qui se propage ».
    const ease = 1 - (1 - prog) * (1 - prog);
    const radius = Math.round(r.maxRadius * ease);
    if (radius >= 1) {
      const alpha = r.life * r.life * 0.6;
      const lw = 1 + Math.round((1 - prog) * 2);   // 3px à l'impact → 1px en fin
      ctx.globalAlpha = alpha;
      roundStrokeRect(ctx, Math.round(r.x - radius), Math.round(r.y - radius), radius * 2, lw);

      // ④ Anneau secondaire : décalé et plus loin → propagation à deux temps.
      const ease2 = Math.max(0, ease - 0.22);
      const r2 = Math.round(r.maxRadius * ease2);
      if (r2 > 4) {
        ctx.globalAlpha = alpha * 0.45;
        roundStrokeRect(ctx, Math.round(r.x - r2), Math.round(r.y - r2), r2 * 2, 1);
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
    const isBadge = t.combo && fontSize >= 13;

    // ── Score discret (B2) : le juice (pop/squash/glow) est réservé aux
    // expressions hype et aux événements. Ici, simple scale-in + fondu + contour
    // léger pour que les +N s'effacent visuellement derrière l'action. ──
    if (!t.exclaim && !isBadge) {
      const appear = Math.min(1, age / 0.12);
      const popScale = 0.72 + appear * 0.28;   // 0.72 → 1.0, sans overshoot
      ctx.save();
      ctx.globalAlpha = lifeRatio * 0.9;
      ctx.translate(t.x, t.y);
      ctx.scale(popScale, popScale);
      ctx.font = pgUiFont(fontSize + 2); // VT323 lit petit → +2px pour l'aplomb
      ctx.textAlign = "center";
      drawScoreText(ctx, t.text, t.color);
      ctx.restore();
      continue;
    }

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
      // Inclinaison + battement + dérive latérale organique (flottement dans l'air)
      const wobble = Math.sin(age * 18 + (t.spin ?? 0) * 3) * 0.07 * t.life;
      ctx.rotate((t.spin ?? 0) * 0.05 + wobble);
      popScale *= 1 + Math.sin(age * 22) * 0.065 * t.life;
      const sway = Math.sin(age * 4.5 + (t.spin ?? 0) * 2.0) * 3.0 * t.life;
      ctx.translate(sway, 0);
    }

    ctx.scale(popScale * scaleX, popScale * scaleY);
    ctx.textAlign = "center";
    // Le hype (exclaim) est désormais bitmap → pas de ctx.font. Le badge (else)
    // garde VT323 (pgUiFont) pour son texte de bannière.
    if (!t.exclaim) ctx.font = pgUiFont(fontSize + 2);

    if (t.exclaim) {
      // Étoile pixel burst : 8 rayons au spawn (remplace l'aberration chromatique)
      const burstI = Math.max(0, 1 - age * t.maxLife * 1.8);
      if (burstI > 0.02) {
        ctx.save();
        ctx.globalAlpha = lifeRatio * burstI * 0.52;
        ctx.strokeStyle = t.color;
        ctx.lineWidth = Math.max(1, Math.round(burstI * 2));
        ctx.lineCap = "square";
        const r0 = fontSize * 0.22;
        const r1 = fontSize * (0.8 + burstI * 0.3);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.restore();
      }
      drawExclaimText(ctx, t.text, t.color, fontSize, lifeRatio);
    } else {
      // Badge banner (jackpot/série/bonus…) : fond sombre + bandes colorées
      // top/bottom → plus jeu, moins UI. Les scores +N passent par drawScoreText.
      const tw = ctx.measureText(t.text).width;
      const ph = 8, pv = 4;
      const bx = -tw / 2 - ph;
      const by = -fontSize - pv;
      const bw = tw + ph * 2;
      const bh = fontSize + pv * 2;
      const stripeH = 2;

      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(bx, by + stripeH, bw, bh - stripeH * 2);
      ctx.fillStyle = t.color;
      ctx.fillRect(bx, by, bw, stripeH);
      ctx.fillRect(bx, by + bh - stripeH, bw, stripeH);

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(t.text, 1, 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
    }

    ctx.restore();
  }
}

// Score +N discret (B2) : contour léger 4 directions (moins d'encre que les
// exclamations) + corps coloré, le ×N de combo démarqué en doré. Suppose
// textAlign="center" et la police déjà posés par l'appelant.
function drawScoreText(ctx: CanvasRenderingContext2D, text: string, color: string): void {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText(text, 1, 0); ctx.fillText(text, -1, 0);
  ctx.fillText(text, 0, 1); ctx.fillText(text, 0, -1);

  const multAt = text.indexOf(" ×");
  if (multAt >= 0) {
    const numPart = text.slice(0, multAt);
    const mulPart = text.slice(multAt);
    const totW = ctx.measureText(text).width;
    const numW = ctx.measureText(numPart).width;
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.fillText(numPart, -totW / 2, 0);
    ctx.fillStyle = "#ffd050";
    ctx.fillText(mulPart, -totW / 2 + numW, 0);
    ctx.textAlign = "center";
  } else {
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
  }
}

// Expressions de combo dessinées À CÔTÉ du peg éclaté (h.x, h.y), décalées en
// diagonale puis envolées. Réserve tout le « gras » (glow, burst pixel, pop
// élastique, squash & stretch) à ces mots — élément hero de la lisibilité. Un
// width-fit garantit qu'aucun mot ne déborde du cadre quel que soit l'ancrage.
export function drawHypeTexts(ctx: CanvasRenderingContext2D, s: GameState): void {
  const hs = s.hypeTexts;
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i]!;
    const isNewest = i === hs.length - 1;
    const age = 1 - h.life;
    const fade = Math.min(1, h.life * 2.2);

    // Palier « FOU » (tier ≥ 5) : la couleur clignote vert↔orange. On alterne sur
    // l'âge du mot (~10 Hz) → clignotement net et lisible le temps qu'il s'affiche.
    const color = h.tier >= 5
      ? (Math.floor(age * 30) % 2 === 0 ? TEXT_FX.hypeCrazyA : TEXT_FX.hypeCrazyB)
      : h.color;

    // Les GROS paliers (tier ≥ 3) reçoivent le traitement « impact » : hit-stop,
    // punch-in, ombre portée, onde de choc. Les petits combos restent légers.
    const isBig = h.tier >= 3;

    // Hit-stop : le mot apparaît figé à pleine échelle ~0.05s avant que le pop
    // démarre. Le « stop net » se lit comme un coup encaissé (game-feel n°1).
    const HIT_STOP = isBig ? 0.05 : 0;
    const animAge = Math.max(0, age - HIT_STOP);
    const frozen = age < HIT_STOP;

    // Pop élastique + squash & stretch, même recette dramatique que les exclamations.
    const appearDur = 0.22;
    const appear = Math.min(1, animAge / appearDur);
    // Punch-in : overshoot d'échelle plus violent sur les gros mots → ils jaillissent
    // à ~1.5× puis retombent au lieu de grandir doucement.
    const eb = easeOutBack(appear, isBig ? 6.5 : 4.5);
    const ebC = Math.min(1, eb);
    const sqFac = 1 - ebC;
    const scaleX = 1 + sqFac * 0.15;
    const scaleY = 1 - sqFac * 0.18;
    // Pendant le hit-stop : verrouillé à pleine échelle (1.0). Sinon : pop normal,
    // ou punch-in (départ plus haut + overshoot marqué) pour les gros mots.
    let popScale = frozen ? 1 : isBig ? 0.55 + eb * 0.62 : 0.4 + eb * 0.72;
    const settleAge = Math.max(0, animAge - appearDur);
    popScale *= 1 + Math.sin(settleAge * 32) * 0.05 * Math.exp(-settleAge * 14);

    // Wobble gelé pendant le hit-stop (indexé sur animAge) pour un freeze net.
    const wobble = Math.sin(animAge * 16 + h.spin * 3) * 0.05 * h.life;

    // Jitter d'impact (sub-pixel) : micro-tremblement sur les ~5 premières frames
    // des GROS mots seulement (tier ≥ 3). Panaché par `spin` → tous les spawns ne
    // tremblent pas pareil, et un mot sur deux ne tremble pas du tout. Donne la
    // sensation d'un coup encaissé sans rendre l'écran épileptique.
    // (les FX de spawn claquent à la SORTIE du hit-stop → on les indexe sur animAge)
    const spawnPunch = Math.max(0, 1 - animAge / 0.1);   // 1 au spawn → 0 à ~0.1
    let jx = 0, jy = 0;
    if (isBig && h.spin > 0 && spawnPunch > 0.01) {
      const amp = spawnPunch * (1.4 + h.tier * 0.4);
      // Pseudo-bruit déterministe à partir de l'âge + graine spin (pas de rng ici).
      jx = (Math.sin(animAge * 140 + h.spin * 9) ) * amp;
      jy = (Math.cos(animAge * 122 + h.spin * 7) ) * amp * 0.7;
    }

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(h.x + jx, h.y + jy);
    ctx.rotate(h.spin * 0.05 + wobble);
    ctx.textAlign = "center";   // hype = bitmap → plus de ctx.font

    // Onde de choc : un anneau pixel-art jaillit du mot au spawn et se propage en
    // s'estompant → le texte « sort » d'une explosion. Dessiné AVANT le scale du
    // texte (repère écran, taille indépendante de l'échelle du mot). Gros mots only.
    if (isBig && isNewest) {
      const sw = Math.max(0, 1 - animAge / 0.4);   // vie de l'onde : ~0.4
      if (sw > 0.01) {
        const ease = 1 - sw * sw;                  // easeOut : part vite, ralentit
        const rad = Math.round((10 + h.fontSize * 1.6) * ease);
        if (rad >= 2) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = fade * sw * sw * 0.55;
          ctx.fillStyle = color;
          roundStrokeRect(ctx, -rad, -rad, rad * 2, 1 + Math.round(sw * 2));
          ctx.restore();
        }
      }
    }

    // Width-fit : rétrécit si le mot dépasserait l'espace dispo jusqu'au bord.
    const tw = bitmapTextWidth(h.text, scaleForFont(h.fontSize)) || 1;
    const maxW = 2 * Math.max(40, Math.min(h.x - 6, W - 6 - h.x));
    const fit = Math.min(1, maxW / tw);
    ctx.scale(popScale * scaleX * fit, popScale * scaleY * fit);

    // Étoile pixel burst au spawn (réservée au mot le plus récent).
    const burstI = Math.max(0, 1 - age * h.maxLife * 1.8);
    if (isNewest && burstI > 0.02) {
      ctx.save();
      ctx.globalAlpha = fade * burstI * 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.round(burstI * 2));
      ctx.lineCap = "square";
      const r0 = h.fontSize * 0.3;
      const r1 = h.fontSize * (0.9 + burstI * 0.4);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Ombre portée : profondeur sur les gros mots (en px-monde, atténuée par le scale).
    // (Le dégradé métal et l'aberration chromatique ont disparu avec le passage bitmap.)
    const shadow = isBig ? 4 : 0;
    drawExclaimText(ctx, h.text, color, h.fontSize, fade, { shadow });
    ctx.restore();
  }
}

// Options de juice ponctuelles du texte hype. Depuis le passage en bitmap, seule
// l'ombre portée subsiste (le dégradé métal et l'aberration chromatique, qui
// reposaient sur le rendu vectoriel de fillText, ont été retirés).
interface ExclaimFx {
  shadow?: number;   // décalage de l'ombre portée en px (0 = off)
}

// Exclamation hype : glow doux + contour pixel noir + corps coloré.
// Le pixel burst est rendu par l'appelant avant cet appel.
//
// ── Rendu BITMAP (font-pixel.ts) ─────────────────────────────────────────────
// Plus de ctx.font/fillText : le texte est blitté en dots (drawBitmapText), comme le
// HUD. Le `scale` (taille d'un dot) est dérivé de fontSize pour garder ~la même taille
// à l'écran, arrondi à l'entier le plus proche pour des dots NETS. Les effets riches
// vectoriels (dégradé métal, aberration chromatique, highlight clippé) sont abandonnés
// — non reproductibles proprement en bitmap sans canvas offscreen ; on garde le trio
// ombre + glow + contour, qui suffit à faire « claquer » le mot.
function drawExclaimText(
  ctx: CanvasRenderingContext2D, text: string, color: string, fontSize: number, lifeRatio: number,
  fx?: ExclaimFx,
): void {
  const scale = scaleForFont(fontSize);
  // L'ancien fillText posait la baseline à y=0 (corps au-dessus). On reproduit ce
  // cadrage en centrant le bloc bitmap un peu au-dessus de 0.
  const cy = -fontSize * 0.35;

  // ⓪ Ombre portée : copie noire décalée bas-droite → le mot décolle du décor.
  if (fx?.shadow && fx.shadow > 0.2) {
    const o = fx.shadow;
    ctx.save();
    ctx.globalAlpha = lifeRatio * 0.5;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    drawBitmapText(ctx, text, o, cy + o, scale);
    ctx.restore();
  }

  // ① Glow additif doux (le burst fait l'essentiel du travail).
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = lifeRatio * 0.22;
  ctx.fillStyle = color;
  drawBitmapText(ctx, text, 0, cy, scale);
  drawBitmapText(ctx, text, 0, cy, scale);
  ctx.restore();

  // ② Contour pixel noir (8 directions, décalage = 1 dot pour rester net).
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx || dy) drawBitmapText(ctx, text, dx * scale, cy + dy * scale, scale);
    }
  }

  // ③ Corps coloré (aplat — plus de dégradé métal).
  ctx.fillStyle = color;
  drawBitmapText(ctx, text, 0, cy, scale);
}

// Overlay de ralenti : teinte bleue glacée + vignette froide qui respire.
// L'intensité suit la profondeur du slow-mo (0..1) → le rendu se fige
// visuellement pile quand le temps se fige, surtout près du panier.
// (Les scanlines sont gérées globalement par `CrtOverlay`, plus ici.)
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

// L'effet « Pixel » est désormais une grille CSS rendue par l'overlay DOM global
// `CrtOverlay`, plus aucun post-process canvas ici.

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
