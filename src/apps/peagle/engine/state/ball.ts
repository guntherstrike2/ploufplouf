import {
  PEG_R, BUCKET_W, WALL_BOUNCE, GRAVITY, FRICTION,
  SLOW_MO_DURATION, W, H, BUCKET_CATCH_HALF_W, BUCKET_RIM_Y,
} from "../constants";
import { BALANCE } from "../balance";
import type { GameState, Ball } from "../types";
import type { GameEvent } from "../events";
import { PEG_KINDS } from "../peg-kinds";
import { circleCollide } from "../physics";
import { spawnParticles, spawnImpactRing, spawnLeafBurst } from "./effects";
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

// Expression de combo poussée dans la ZONE HYPE dédiée (pile centrée sous le
// lanceur), et non plus à côté du peg. Le mot et sa couleur escaladent avec le
// palier de combo ; le multiplicateur chiffré reste lisible sur le +N près du peg.
function pushEagleHype(s: GameState, mult: number): void {
  const tier = Math.max(0, Math.min(EAGLE_HYPE.length - 1, mult - 1));
  const words = EAGLE_HYPE[tier]!;
  s.hypeTexts.push({
    text: words[Math.floor(s.rng() * words.length)]!,
    life: 1,
    maxLife: 1.6,
    color: HYPE_COLORS[tier]!,
    fontSize: Math.min(28, 16 + tier * 2),
    tier,
    spin: (s.rng() - 0.5) * 2,
  });
}

// Texte de score « +N » près du peg, version discrète (B2). Anti-collision : si
// un score récent occupe déjà la place, on empile le nouveau juste au-dessus
// pour qu'aucun ne soit masqué pendant une rafale de combo.
function pushScoreText(
  s: GameState, x: number, y: number, text: string, color: string, fontSize: number,
): void {
  let ny = y;
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (const t of s.floatingTexts) {
      if (t.combo || t.exclaim || t.life < 0.35) continue;
      if (Math.abs(t.x - x) < 24 && Math.abs(t.y - ny) < 12) { ny = t.y - 12; moved = true; }
    }
    if (!moved) break;
  }
  s.floatingTexts.push({ x, y: ny, text, life: 1, maxLife: 1, color, combo: false, fontSize });
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
  if (s.orangeLeft === 0 && s.rng() < 0.65) {
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
      events.push({ kind: "sound", id: "wall-bounce" }); s.trauma = Math.min(1, s.trauma + BALANCE.wall.traumaPerHit); b.squash = Math.max(b.squash, Math.min(0.7, speed * 0.05));
    }
    if (b.x + s.effectiveBallR > W) {
      b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
      b.x = W - s.effectiveBallR;
      events.push({ kind: "sound", id: "wall-bounce" }); s.trauma = Math.min(1, s.trauma + BALANCE.wall.traumaPerHit); b.squash = Math.max(b.squash, Math.min(0.7, speed * 0.05));
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

      // Mémorise l'impact pour piloter l'expression de l'aigle (face.ts) : un hit
      // sur cible orange déclenche la tête « proie ! » (yeux étoile), un peg normal
      // le pop standard. Réinitialise aussi le compteur « vol dans le vide ».
      s.lastHitClock = s.animClock;
      s.lastHitWasOrange = def.isTarget;

      // Score : base × multiplicateur de combo
      const comboMult = Math.max(1, Math.floor(s.combo / BALANCE.combo.interval));
      const totalMult = comboMult * s.scoreMultiplier;
      const earned = Math.round(def.baseScore * totalMult);
      s.score += earned;

      // Intensité visuelle qui monte avec le combo : 1.0 au premier peg → ~2.5 à combo 10+.
      // Cela amplifie progressivement les particules, l'onde de choc et le screenshake
      // pour rendre la montée en puissance tangible sans changer le gameplay.
      const comboBoost = Math.min(1, (s.combo - 1) / 10); // 0..1
      const visualMult = 1 + comboBoost * 1.5;            // 1..2.5

      // Feedback (freeze, shake, flash, particules) — valeurs de la table.
      s.hitFreezeFrames = Math.max(s.hitFreezeFrames, def.freezeFrames);
      if (def.trauma > 0) s.trauma = Math.min(1, s.trauma + def.trauma * visualMult);
      if (def.flash > 0) s.flashWhite = Math.max(s.flashWhite, def.flash);
      spawnParticles(s, p.x, p.y, def.hotParticles, Math.round(def.particles * visualMult));
      spawnLeafBurst(s, p.x, p.y, 3 + Math.round(comboBoost * 5));

      // Bounce & juice : l'œuf s'écrase à l'impact, une onde de choc se propage
      // dans le décor et le fond pulse (cible orange = réaction la plus forte).
      b.squash = Math.max(b.squash, Math.min(1, 0.5 + speed * 0.04));
      const baseRingIntensity = def.isTarget ? 1 : p.kind === "bumper" ? 0.6 : 0.28;
      const ringIntensity = Math.min(1, baseRingIntensity + comboBoost * (1 - baseRingIntensity) * 0.7);
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
        s.bumperChainShot += 1;
        p.cooldown = def.cooldownFrames;
        p.bump = 1;
        p.scale = 1.8;

        // Score escaladant : chaque bumper du tir vaut 50% de plus que le précédent.
        const bumperBonus = Math.round(earned * (s.bumperChainShot - 1) * 0.5);
        s.score += bumperBonus;

        // BUMPER FRENZY au 3e bumper du tir
        if (s.bumperChainShot === 3) {
          s.flashWhite = Math.max(s.flashWhite, 0.35);
          s.hitFreezeFrames = Math.max(s.hitFreezeFrames, 10);
          s.floatingTexts.push({ x: W / 2, y: H / 2 - 50, text: "BUMPER FRENZY !", life: 1, maxLife: 2, color: "#ff9900", combo: true, exclaim: true, fontSize: 22, spin: (s.rng() - 0.5) * 1.5 });
        } else if (s.bumperChainShot === 5) {
          s.flashWhite = Math.max(s.flashWhite, 0.5);
          s.floatingTexts.push({ x: W / 2, y: H / 2 - 50, text: "BUMPER MANIAC !", life: 1, maxLife: 2, color: "#ff4400", combo: true, exclaim: true, fontSize: 24, spin: (s.rng() - 0.5) * 2 });
        }
      }

      // Texte de score flottant (discret, près du peg, anti-collision).
      const comboBonus = s.combo >= BALANCE.combo.interval && s.combo % BALANCE.combo.interval === 0;
      const popFontSize = Math.min(18, 11 + Math.floor(totalMult * 1.5));
      const textColor = def.isTarget ? "#88ccff" : p.kind === "bumper" ? "#ffcc44" : "#ffffff";
      pushScoreText(
        s, p.x + (s.rng() - 0.5) * 20, p.y,
        totalMult > 1 ? `+${earned} ×${comboMult}` : `+${earned}`,
        textColor, popFontSize,
      );
      if (comboBonus) {
        // Palier de combo franchi → l'expression hype part dans la zone dédiée
        // (plus de badge "COMBO ×N" entassé près du peg : le ×N figure sur le +N).
        pushEagleHype(s, comboMult);
      }

      events.push({ kind: "sound", id: def.sound, x: p.x });
    }
  }

  // Rattrapage par le panier — la hitbox épouse le nid dessiné (renderer/ui.ts) :
  // largeur du rebord tressé (BUCKET_CATCH_HALF_W) et ligne de capture au niveau
  // de l'ouverture visible (BUCKET_RIM_Y), au lieu du rectangle BUCKET_W étroit et
  // trop bas d'avant.
  const bucketTop = BUCKET_RIM_Y;
  const bucketCx = s.bucket + BUCKET_W / 2;
  if (b.y + s.effectiveBallR >= bucketTop && Math.abs(b.x - bucketCx) <= BUCKET_CATCH_HALF_W) {
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
      events.push({ kind: "sound", id: "jackpot" });
    } else {
      s.balls += 1;
      s.trauma = Math.min(1, s.trauma + BALANCE.trauma.bucketCatch);

      // `s.combo > 0` ⟺ l'œuf a touché au moins un peg ce tour-ci (le combo n'est
      // remis à 0 qu'en fin de tour). C'est la condition d'un rattrapage « qualifiant ».
      if (s.combo > 0) {
        s.bucketStreak += 1;

        if (s.bucketStreak >= 2) {
          // Bonus de SÉRIE : grimpe à chaque rattrapage qualifiant consécutif.
          const streakBonus = BALANCE.bucketStreak.base * (s.bucketStreak - 1) * s.level;
          s.score += streakBonus;
          s.flashWhite = Math.max(s.flashWhite, 0.4);
          s.trauma = Math.min(1, s.trauma + 0.1);
          spawnParticles(s, b.x, bucketTop, true, 10 + s.bucketStreak * 2);
          spawnImpactRing(s, b.x, bucketTop, "#ffd700", Math.min(1, 0.4 + s.bucketStreak * 0.1));
          s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 32, text: `SÉRIE ×${s.bucketStreak}`, life: 1, maxLife: 2, color: "#ffd700", combo: true, exclaim: true, fontSize: Math.min(26, 16 + s.bucketStreak), spin: (s.rng() - 0.5) * 1.2 });
          s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 14, text: `+${streakBonus.toLocaleString()}`, life: 1, maxLife: 1.8, color: "#ffec80", combo: true, fontSize: 14 });
        } else {
          s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 14, text: "ŒUF SAUVÉ !", life: 1, maxLife: 1.8, color: "#00ffcc", combo: true, exclaim: true, fontSize: 16, spin: (s.rng() - 0.5) * 1.5 });
        }

        // +1 œuf bonus tous les N rattrapages d'affilée.
        if (s.bucketStreak % BALANCE.bucketStreak.eggEvery === 0) {
          s.balls += 1;
          s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 50, text: "+1 ŒUF !", life: 1, maxLife: 2, color: "#00ffcc", combo: true, fontSize: 15 });
        }

        events.push({ kind: "sound", id: s.bucketStreak >= 2 ? "jackpot" : "victory" });
      } else {
        // Rattrapage direct, sans avoir touché de peg : ne compte pas, casse la série.
        s.bucketStreak = 0;
        s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 14, text: "ŒUF SAUVÉ !", life: 1, maxLife: 1.8, color: "#00ffcc", combo: true, exclaim: true, fontSize: 16, spin: (s.rng() - 0.5) * 1.5 });
        events.push({ kind: "sound", id: "victory" });
      }
    }
  }

  // L'œuf sort de l'écran → œuf manqué, la série de paniers est rompue.
  if (b.active && b.y > H + 40) {
    b.active = false;
    s.bucketStreak = 0;
  }
}
