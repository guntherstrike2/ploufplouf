import {
  PEG_R, BUCKET_H, BUCKET_W, WALL_BOUNCE, GRAVITY, FRICTION,
  HIT_FREEZE_NORMAL, HIT_FREEZE_ORANGE, SLOW_MO_DURATION,
  W, H,
} from "../constants";
import { BALANCE } from "../balance";
import type { GameState, Ball } from "../types";
import type { GameEvent } from "../events";
import { circleCollide } from "../physics";
import { spawnParticles } from "./effects";

export function processBallPhysics(
  b: Ball,
  s: GameState,
  timeScale: number,
  events: GameEvent[],
): void {
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);

  // Ring buffer trail — évite Array.shift() O(n) et l'alloc d'objets par frame
  const TRAIL_MAX = 32;
  if (b.trail.length < TRAIL_MAX) {
    b.trail.push({ x: b.x, y: b.y, speed });
  } else {
    const slot = b.trail[b.trailHead]!;
    slot.x = b.x; slot.y = b.y; slot.speed = speed;
    b.trailHead = (b.trailHead + 1) % TRAIL_MAX;
  }

  const substeps = Math.max(1, Math.ceil(speed / (PEG_R * 0.8)));
  const dt = timeScale / substeps;
  const frictionDt = Math.pow(FRICTION, dt);

  for (let step = 0; step < substeps; step++) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vy += GRAVITY * dt;
    b.vx *= frictionDt;

    // Murs
    if (b.x - s.effectiveBallR < 0) {
      b.vx = Math.abs(b.vx) * WALL_BOUNCE;
      b.x = s.effectiveBallR;
      if (step === 0) { events.push({ kind: "sound", id: "bip" }); s.trauma = Math.min(1, s.trauma + BALANCE.wall.traumaPerHit); }
    }
    if (b.x + s.effectiveBallR > W) {
      b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
      b.x = W - s.effectiveBallR;
      if (step === 0) { events.push({ kind: "sound", id: "bip" }); s.trauma = Math.min(1, s.trauma + BALANCE.wall.traumaPerHit); }
    }

    // Pegs
    for (const p of s.pegs) {
      if (p.hit) continue;
      const result = circleCollide(b.x, b.y, b.vx, b.vy, s.effectiveBallR, p.x, p.y, PEG_R, s.effectivePegBounce);
      if (!result) continue;

      // Réflexion + correction de chevauchement
      b.vx = result.vx; b.vy = result.vy;
      const dx = b.x - p.x, dy = b.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const overlap = s.effectiveBallR + PEG_R - dist + 0.5;
      b.x += (dx / dist) * overlap;
      b.y += (dy / dist) * overlap;

      // Pop du peg
      p.hit = true; p.popping = true; p.popAlpha = BALANCE.peg.popStartAlpha; p.scale = BALANCE.peg.popStartScale;
      if (p.orange) s.orangeLeft = Math.max(0, s.orangeLeft - 1);
      s.combo += 1;

      // Score : base × multiplicateur de combo
      const comboMult = Math.max(1, Math.floor(s.combo / BALANCE.combo.interval));
      const totalMult = comboMult * s.scoreMultiplier;
      const basePoints = p.orange ? BALANCE.score.orangeBase : BALANCE.score.normalBase;
      const earned = Math.round(basePoints * totalMult);
      s.score += earned;

      // Feedback (freeze, shake, flash, particules)
      s.hitFreezeFrames = Math.max(s.hitFreezeFrames, p.orange ? HIT_FREEZE_ORANGE : HIT_FREEZE_NORMAL);
      if (p.orange) { s.trauma = Math.min(1, s.trauma + BALANCE.trauma.orangePeg); s.flashWhite = Math.max(s.flashWhite, BALANCE.flash.orangePeg); }
      else { s.trauma = Math.min(1, s.trauma + BALANCE.trauma.normalPeg); }
      spawnParticles(s, p.x, p.y, p.orange, p.orange ? 20 : 8);

      // Dernière orange → ralenti dramatique
      if (p.orange && s.orangeLeft === 0) {
        s.slowMoFrames = SLOW_MO_DURATION;
        s.flashWhite = 1.0;
        s.floatingTexts.push({ x: W / 2, y: H / 2 - 30, text: "DERNIÈRE CIBLE !", life: 1, maxLife: 2.5, color: "#88ccff", combo: true, fontSize: 16 });
      }

      // Texte de score flottant
      const comboBonus = s.combo >= BALANCE.combo.interval && s.combo % BALANCE.combo.interval === 0;
      const popFontSize = Math.min(18, 11 + Math.floor(totalMult * 1.5));
      s.floatingTexts.push({
        x: p.x + (Math.random() - 0.5) * 20,
        y: p.y,
        text: totalMult > 1 ? `+${earned} ×${comboMult}` : `+${earned}`,
        life: 1, maxLife: 1,
        color: p.orange ? "#88ccff" : "#ffffff",
        combo: comboBonus,
        fontSize: comboBonus ? popFontSize + 2 : popFontSize,
      });
      if (comboBonus) {
        s.floatingTexts.push({ x: p.x, y: p.y - 22, text: `COMBO ×${comboMult}!`, life: 1, maxLife: 1.6, color: "#ffcc44", combo: true, fontSize: Math.min(20, 13 + comboMult * 2) });
      }

      events.push({ kind: "sound", id: p.orange ? "pop" : "bip" });
    }
  }

  // Rattrapage par le panier
  const bucketTop = H - BUCKET_H - 4;
  if (b.y + s.effectiveBallR >= bucketTop && b.x >= s.bucket && b.x <= s.bucket + BUCKET_W) {
    s.balls += 1;
    s.bucketFlash = 1;
    s.trauma = Math.min(1, s.trauma + BALANCE.trauma.bucketCatch);
    s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 14, text: "ŒUF RÉCUPÉRÉ!", life: 1, maxLife: 1.8, color: "#00ffcc", combo: true, fontSize: 14 });
    events.push({ kind: "sound", id: "victory" });
    b.active = false;
  }

  // L'œuf sort de l'écran
  if (b.active && b.y > H + 40) {
    b.active = false;
  }
}
