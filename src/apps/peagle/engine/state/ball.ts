import {
  PEG_R, BUCKET_H, BUCKET_W, WALL_BOUNCE, GRAVITY, FRICTION,
  SLOW_MO_DURATION, W, H,
} from "../constants";
import { BALANCE } from "../balance";
import type { GameState, Ball } from "../types";
import type { GameEvent } from "../events";
import { PEG_KINDS } from "../peg-kinds";
import { circleCollide } from "../physics";
import { spawnParticles, spawnImpactRing } from "./effects";
import { spawnBirds } from "./birds";

// ─── Exclamations « hype » à thème aigle / œuf ───────────────────────────────
// Escalade par paliers de combo : plus la chaîne est longue, plus le mot est
// gros, coloré et exalté. Mélange de classiques juicy (JUICY!, TASTY!) et de
// jeux de mots aigle/œuf (ŒUFTASTIQUE!, AIGLE ROYAL!, ENVERGURE!…).
const EAGLE_HYPE: readonly (readonly string[])[] = [
  ["JUICY!", "BEAU VOL!", "PIQUÉ NET!", "MIAM!"],
  ["TASTY!", "ŒUFTASTIQUE!", "EN PLEIN VOL!", "BEC EN OR!"],
  ["RAPACE!", "SERRES D'ACIER!", "SUPER VOL!", "ŒUF EN OR!"],
  ["AIGLE ROYAL!", "ENVERGURE!", "MAJESTUEUX!", "ŒUFTRAGEUX!"],
  ["PRÉDATEUR!", "FRAPPE AÉRIENNE!", "OVATION!", "ROI DU CIEL!"],
  ["LÉGENDE AILÉE!", "MAÎTRE DES CIEUX!", "INTOUCHABLE!", "PONTE PARFAITE!"],
];

const HYPE_COLORS = ["#ffe06a", "#ffb43a", "#ff7a2e", "#ff4d6b", "#d06bff", "#7fe0ff"] as const;

function pushEagleHype(s: GameState, x: number, y: number, mult: number): void {
  const tier = Math.max(0, Math.min(EAGLE_HYPE.length - 1, mult - 1));
  const words = EAGLE_HYPE[tier]!;
  s.floatingTexts.push({
    x, y,
    text: words[Math.floor(Math.random() * words.length)]!,
    life: 1,
    maxLife: 1.7,
    color: HYPE_COLORS[tier]!,
    combo: true,
    exclaim: true,
    fontSize: Math.min(26, 15 + tier * 2),
    spin: (Math.random() - 0.5) * 2,
  });
}

export function processBallPhysics(
  b: Ball,
  s: GameState,
  timeScale: number,
  events: GameEvent[],
): void {
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);

  // Le squash d'impact se résorbe vite (rebond élastique de l'œuf)
  if (b.squash > 0) b.squash = Math.max(0, b.squash - 0.14 * timeScale);

  // Ring buffer trail — évite Array.shift() O(n) et l'alloc d'objets par frame
  const TRAIL_MAX = 32;
  if (b.trail.length < TRAIL_MAX) {
    b.trail.push({ x: b.x, y: b.y, speed });
  } else {
    const slot = b.trail[b.trailHead]!;
    slot.x = b.x; slot.y = b.y; slot.speed = speed;
    b.trailHead = (b.trailHead + 1) % TRAIL_MAX;
  }

  // Finale : étincelles dorées qui s'égrènent derrière l'œuf en pleine plongée
  // vers le panier → traînée scintillante bien satisfaisante.
  if (s.orangeLeft === 0 && Math.random() < 0.65) {
    spawnParticles(s, b.x, b.y, true, 1);
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
      if (step === 0) { events.push({ kind: "sound", id: "bip" }); s.trauma = Math.min(1, s.trauma + BALANCE.wall.traumaPerHit); b.squash = Math.max(b.squash, Math.min(0.7, speed * 0.05)); }
    }
    if (b.x + s.effectiveBallR > W) {
      b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
      b.x = W - s.effectiveBallR;
      if (step === 0) { events.push({ kind: "sound", id: "bip" }); s.trauma = Math.min(1, s.trauma + BALANCE.wall.traumaPerHit); b.squash = Math.max(b.squash, Math.min(0.7, speed * 0.05)); }
    }

    // Pegs — comportement piloté par la table data-driven PEG_KINDS.
    for (const p of s.pegs) {
      if (p.hit) continue;
      if (p.cooldown > 0) continue; // obstacle permanent en cooldown : transparent
      const def = PEG_KINDS[p.kind];
      const result = circleCollide(b.x, b.y, b.vx, b.vy, s.effectiveBallR, p.x, p.y, PEG_R, s.effectivePegBounce * def.bounceMult);
      if (!result) continue;

      // Réflexion + correction de chevauchement
      b.vx = result.vx; b.vy = result.vy;
      const dx = b.x - p.x, dy = b.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist, ny = dy / dist;
      const overlap = s.effectiveBallR + PEG_R - dist + 0.5;
      b.x += nx * overlap;
      b.y += ny * overlap;

      // Kick d'un bumper : impulsion le long de la normale.
      if (def.impulse > 0) { b.vx += nx * def.impulse; b.vy += ny * def.impulse; }

      s.combo += 1;

      // Score : base × multiplicateur de combo
      const comboMult = Math.max(1, Math.floor(s.combo / BALANCE.combo.interval));
      const totalMult = comboMult * s.scoreMultiplier;
      const earned = Math.round(def.baseScore * totalMult);
      s.score += earned;

      // Feedback (freeze, shake, flash, particules) — valeurs de la table.
      s.hitFreezeFrames = Math.max(s.hitFreezeFrames, def.freezeFrames);
      if (def.trauma > 0) s.trauma = Math.min(1, s.trauma + def.trauma);
      if (def.flash > 0) s.flashWhite = Math.max(s.flashWhite, def.flash);
      spawnParticles(s, p.x, p.y, def.hotParticles, def.particles);

      // Bounce & juice : l'œuf s'écrase à l'impact, une onde de choc se propage
      // dans le décor et le fond pulse (cible orange = réaction la plus forte).
      b.squash = Math.max(b.squash, Math.min(1, 0.5 + speed * 0.04));
      const ringIntensity = def.isTarget ? 1 : p.kind === "bumper" ? 0.6 : 0.28;
      const ringColor = def.isTarget ? "#ffbb44" : p.kind === "bumper" ? "#ffdd55" : "#9fb8ff";
      spawnImpactRing(s, p.x, p.y, ringColor, ringIntensity);

      if (def.destructible) {
        // Pop : le peg disparaît.
        p.hit = true; p.popping = true; p.popAlpha = BALANCE.peg.popStartAlpha; p.scale = BALANCE.peg.popStartScale;
        // Easter egg « peagle » : chaque peg éclaté envoie un oiseau dans le ciel.
        spawnBirds(s);
        if (def.isTarget) {
          s.orangeLeft = Math.max(0, s.orangeLeft - 1);
          // Dernière cible → punch (freeze d'impact appuyé) puis ralenti dramatique
          if (s.orangeLeft === 0) {
            s.hitFreezeFrames = Math.max(s.hitFreezeFrames, 14);
            s.slowMoFrames = SLOW_MO_DURATION;
            s.flashWhite = 1.0;
            s.floatingTexts.push({ x: W / 2, y: H / 2 - 30, text: "DERNIÈRE PROIE !", life: 1, maxLife: 2.5, color: "#88ccff", combo: true, exclaim: true, fontSize: 20, spin: 0 });
          }
        }
      } else {
        // Obstacle permanent (bumper) : reste en place, flash + cooldown anti-spam.
        p.cooldown = def.cooldownFrames;
        p.bump = 1;
        p.scale = 1.5;
      }

      // Texte de score flottant
      const comboBonus = s.combo >= BALANCE.combo.interval && s.combo % BALANCE.combo.interval === 0;
      const popFontSize = Math.min(18, 11 + Math.floor(totalMult * 1.5));
      const textColor = def.isTarget ? "#88ccff" : p.kind === "bumper" ? "#ffcc44" : "#ffffff";
      s.floatingTexts.push({
        x: p.x + (Math.random() - 0.5) * 20,
        y: p.y,
        text: totalMult > 1 ? `+${earned} ×${comboMult}` : `+${earned}`,
        life: 1, maxLife: 1,
        color: textColor,
        combo: comboBonus,
        fontSize: comboBonus ? popFontSize + 2 : popFontSize,
      });
      if (comboBonus) {
        // Petit "×N" doré juste au-dessus du score, puis l'exclamation hype.
        s.floatingTexts.push({ x: p.x, y: p.y - 18, text: `COMBO ×${comboMult}`, life: 1, maxLife: 1.4, color: "#ffcc44", combo: true, fontSize: Math.min(18, 12 + comboMult) });
        pushEagleHype(s, p.x, p.y - 40, comboMult);
      }

      events.push({ kind: "sound", id: def.sound });
    }
  }

  // Rattrapage par le panier
  const bucketTop = H - BUCKET_H - 4;
  if (b.y + s.effectiveBallR >= bucketTop && b.x >= s.bucket && b.x <= s.bucket + BUCKET_W) {
    s.bucketFlash = 1;
    b.active = false;

    // JACKPOT : la dernière proie est déjà tombée et l'œuf retombe pile dans le
    // panier pendant le ralenti final → récompense maximale.
    if (s.orangeLeft === 0) {
      const bonus = BALANCE.score.jackpotBase * s.level;
      s.score += bonus;
      s.balls += BALANCE.score.jackpotBalls;
      s.flashWhite = 1;
      s.trauma = 1;
      s.slowMoFrames = Math.max(s.slowMoFrames, SLOW_MO_DURATION);
      spawnParticles(s, b.x, bucketTop, true, 28);
      spawnImpactRing(s, b.x, bucketTop, "#ffd700", 1);
      s.floatingTexts.push({ x: W / 2, y: H / 2 - 60, text: "JACKPOT !!!", life: 1, maxLife: 3.5, color: "#ffd700", combo: true, exclaim: true, fontSize: 30, spin: 0 });
      s.floatingTexts.push({ x: W / 2, y: H / 2 - 24, text: `+${bonus.toLocaleString()}  ·  +${BALANCE.score.jackpotBalls} ŒUFS`, life: 1, maxLife: 3, color: "#ffec80", combo: true, fontSize: 16 });
      events.push({ kind: "sound", id: "victory" });
    } else {
      s.balls += 1;
      s.trauma = Math.min(1, s.trauma + BALANCE.trauma.bucketCatch);
      s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 14, text: "ŒUF SAUVÉ !", life: 1, maxLife: 1.8, color: "#00ffcc", combo: true, exclaim: true, fontSize: 16, spin: (Math.random() - 0.5) * 1.5 });
      events.push({ kind: "sound", id: "victory" });
    }
  }

  // L'œuf sort de l'écran
  if (b.active && b.y > H + 40) {
    b.active = false;
  }
}
