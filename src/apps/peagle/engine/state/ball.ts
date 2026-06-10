import {
  PEG_R, BUCKET_W, WALL_BOUNCE, GRAVITY, FRICTION,
  SLOW_MO_DURATION, W, H, HUD_H, BUCKET_CATCH_HALF_W, BUCKET_RIM_Y,
} from "../constants";
import { BALANCE } from "../balance";
import type { GameState, Ball } from "../types";
import type { GameEvent } from "../events";
import { PEG_KINDS } from "../peg-kinds";
import { circleCollide } from "../physics";
import { spawnParticles, spawnImpactRing, spawnLeafBurst } from "./effects";
import { spawnBirds } from "./birds";
import { TEXT_FX } from "../palette";
import { HYPE_TIERS, hypeTier } from "../hype";

// Les MOTS hype vivent dans engine/hype.ts (source unique partagée avec le DMD) ;
// ici on ne garde que les COULEURS par palier.
const HYPE_COLORS = TEXT_FX.hype;

// Expression de combo ancrée À CÔTÉ du peg qui vient d'éclater (x, y), décalée
// en DIAGONALE vers l'espace libre (loin du bord le plus proche) puis envolée
// par une légère dérive. Le mot et sa couleur escaladent avec le palier ; le
// multiplicateur chiffré reste lisible sur le +N près du peg.
function pushEagleHype(s: GameState, mult: number, x: number, y: number): void {
  const tier = Math.max(0, Math.min(HYPE_TIERS.length - 1, mult - 1));
  const words = hypeTier(mult).playfield;
  const fontSize = Math.min(26, 15 + tier * 2);

  // Décalage diagonal : on s'écarte vers le côté qui a le plus de place (le peg
  // près du bord gauche pousse le texte à droite, et inversement) + vers le haut.
  const dirX = x < W / 2 ? 1 : -1;
  let hx = x + dirX * (26 + tier * 2);
  let hy = y - (22 + tier * 2);

  // Anti-collision : si une hype récente occupe déjà la place, on se décale
  // encore d'un cran en diagonale pour qu'aucune ne se masque pendant une rafale.
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const o of s.hypeTexts) {
      if (o.life < 0.4) continue;
      if (Math.abs(o.x - hx) < 70 && Math.abs(o.y - hy) < 22) {
        hx += dirX * 16; hy -= 20; moved = true;
      }
    }
    if (!moved) break;
  }

  // Garde le mot dans le cadre (le rendu fait un width-fit pour le reste).
  hx = Math.max(54, Math.min(W - 54, hx));
  hy = Math.max(HUD_H + 26, Math.min(H - 60, hy));

  s.hypeTexts.push({
    x: hx, y: hy,
    vx: dirX * (0.18 + tier * 0.04),
    vy: -(0.5 + tier * 0.08),
    text: words[Math.floor(s.rng() * words.length)]!,
    life: 1,
    maxLife: 1.5,
    color: HYPE_COLORS[tier]!,
    fontSize,
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

      // Score « bleu × orange » : on n'ajoute PLUS au total ici. On accumule dans les
      // compteurs — les points bleus (combo inclus) d'un côté, le multiplicateur orange
      // de l'autre. Le produit est versé à endOfTurn. `comboMult` (rafale court terme)
      // multiplie UNIQUEMENT les points bleus.
      const comboMult = Math.max(1, Math.floor(s.combo / BALANCE.combo.interval));
      const earned = Math.round(def.baseScore * comboMult);
      if (def.isTarget) {
        // Cible orange : NE donne PAS de points directs. Elle monte le multiplicateur
        // orange (turnOrangeCount), plafonné. Ce compteur N'EST PAS reset au lancer tant
        // qu'on enchaîne les rattrapages au panier (cf. useGameLoop) ; un œuf perdu le
        // remet à 0 (plus bas). Le multiplicateur effectif est (1 + turnOrangeCount).
        s.turnOrangeCount = Math.min(BALANCE.score.orangeMultMax - 1, s.turnOrangeCount + 1);
      } else {
        s.turnBluePts += earned;                  // bleu (peg normal) → points du tour
      }

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
      // Onde de choc en CRESCENDO : plancher bas → les 1ers pegs sont discrets ;
      // la contribution du combo suit une courbe accélérée (²). Plafonnée : sans
      // cap, le rayon du flash/bloom (cf. drawImpactRings) finit par déborder sur
      // les pegs voisins et les fait scintiller. ~1.5 = onde déjà bien ample.
      const baseRingIntensity = def.isTarget ? 0.45 : p.kind === "bumper" ? 0.3 : 0.12;
      const ringCombo = Math.min(1.5, ((s.combo - 1) / 8) ** 2);   // 0 au peg 1, accélère, plafonné
      const ringIntensity = baseRingIntensity + ringCombo;
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
            s.floatingTexts.push({ x: W / 2, y: H / 2 - 30, text: "LAST PREY!", life: 1, maxLife: 2.5, color: TEXT_FX.clutch, combo: true, exclaim: true, fontSize: 20, spin: 0 });
          }
        }
      } else {
        // Obstacle permanent (bumper) : reste en place, flash + cooldown anti-spam.
        s.bumperChainShot += 1;
        p.cooldown = def.cooldownFrames;
        p.bump = 1;
        p.scale = 1.8;

        // Score escaladant : chaque bumper du tir vaut 50% de plus que le précédent.
        // Le bumper n'est pas une cible orange → il alimente les points BLEUS du tour.
        const bumperBonus = Math.round(earned * (s.bumperChainShot - 1) * 0.5);
        s.turnBluePts += bumperBonus;

        // BUMPER FRENZY au 3e bumper du tir
        if (s.bumperChainShot === 3) {
          s.flashWhite = Math.max(s.flashWhite, 0.35);
          s.hitFreezeFrames = Math.max(s.hitFreezeFrames, 10);
          s.floatingTexts.push({ x: W / 2, y: H / 2 - 50, text: "BUMPER FRENZY!", life: 1, maxLife: 2, color: TEXT_FX.hype[4]!, combo: true, exclaim: true, fontSize: 22, spin: (s.rng() - 0.5) * 1.5 });
        } else if (s.bumperChainShot === 5) {
          s.flashWhite = Math.max(s.flashWhite, 0.5);
          s.floatingTexts.push({ x: W / 2, y: H / 2 - 50, text: "BUMPER MANIAC!", life: 1, maxLife: 2, color: TEXT_FX.gold, combo: true, exclaim: true, fontSize: 24, spin: (s.rng() - 0.5) * 2 });
        }
      }

      // Texte de score flottant (discret, près du peg, anti-collision).
      // Orange : pas de points directs → on affiche le MULTIPLICATEUR qu'elle vient de
      // faire monter (×N), pas un faux « +pts ». Bleu/bumper : « +points » (×comboMult si >1).
      const comboBonus = s.combo >= BALANCE.combo.interval && s.combo % BALANCE.combo.interval === 0;
      const popFontSize = Math.min(18, 11 + Math.floor(comboMult * 1.5));
      const textColor = def.isTarget ? TEXT_FX.clutch : p.kind === "bumper" ? TEXT_FX.gold : TEXT_FX.score;
      const scoreLabel = def.isTarget
        ? `×${1 + s.turnOrangeCount}`
        : comboMult > 1 ? `+${earned} ×${comboMult}` : `+${earned}`;
      pushScoreText(s, p.x + (s.rng() - 0.5) * 20, p.y, scoreLabel, textColor, popFontSize);
      if (comboBonus) {
        // Palier de combo franchi → l'expression hype claque à côté du peg, en
        // diagonale, et un arpège pixel ascendant récompense la montée en palier.
        pushEagleHype(s, comboMult, p.x, p.y);
        events.push({ kind: "sound", id: "combo-tier" });
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

    // ── MULTIPLICATEUR CONSERVÉ ──────────────────────────────────────────────
    // RISK/REWARD : rattraper l'œuf au panier CONSERVE le multiplicateur orange pour le
    // tour suivant (turnOrangeCount n'est PAS reset au lancer — cf. useGameLoop). On le
    // signale visuellement quand un mult est en jeu. Un œuf perdu (hors écran) le casse.
    if (s.turnOrangeCount > 0) {
      s.floatingTexts.push({ x: bucketCx, y: bucketTop - 46, text: `MULT ×${1 + s.turnOrangeCount} KEPT`, life: 1, maxLife: 2, color: TEXT_FX.goldHi, combo: true, exclaim: true, fontSize: 16, spin: (s.rng() - 0.5) * 1.2 });
      spawnImpactRing(s, b.x, bucketTop, TEXT_FX.goldHi, 0.6);
    }

    // JACKPOT : la dernière proie est déjà tombée et l'œuf retombe pile dans le
    // panier pendant le ralenti final → récompense maximale. Le bonus de SCORE part
    // en attente (pendingJackpot) pour être versé via une PayoutLine à endOfTurn (le
    // DMD payout le rejoue) ; les œufs sont crédités là aussi. Le juice reste immédiat.
    if (s.orangeLeft === 0) {
      const bonus = BALANCE.score.jackpotBase * s.level;
      s.pendingJackpot += bonus;
      s.pendingJackpotBalls += BALANCE.score.jackpotBalls;
      s.flashWhite = 1;
      s.trauma = 1;
      s.slowMoFrames = Math.max(s.slowMoFrames, SLOW_MO_DURATION);
      spawnParticles(s, b.x, bucketTop, true, 28);
      spawnImpactRing(s, b.x, bucketTop, TEXT_FX.gold, 1);
      s.floatingTexts.push({ x: W / 2, y: H / 2 - 60, text: "JACKPOT!!!", life: 1, maxLife: 3.5, color: TEXT_FX.gold, combo: true, exclaim: true, fontSize: 30, spin: 0 });
      s.floatingTexts.push({ x: W / 2, y: H / 2 - 24, text: `+${bonus.toLocaleString()}  ·  +${BALANCE.score.jackpotBalls} EGGS`, life: 1, maxLife: 3, color: TEXT_FX.goldHi, combo: true, fontSize: 16 });
      events.push({ kind: "sound", id: "jackpot" });
    } else {
      s.balls += 1;
      s.trauma = Math.min(1, s.trauma + BALANCE.trauma.bucketCatch);

      // `s.combo > 0` ⟺ l'œuf a touché au moins un peg ce tour-ci (le combo n'est
      // remis à 0 qu'en fin de tour). C'est la condition d'un rattrapage « qualifiant ».
      if (s.combo > 0) {
        s.bucketStreak += 1;

        if (s.bucketStreak >= 2) {
          // Bonus de SÉRIE : grimpe à chaque rattrapage qualifiant consécutif. Mis en
          // attente (pendingStreakBonus) → versé via une PayoutLine à endOfTurn, comme
          // le jackpot, pour que le DMD payout le rejoue et que le total reste cohérent.
          const streakBonus = BALANCE.bucketStreak.base * (s.bucketStreak - 1) * s.level;
          s.pendingStreakBonus += streakBonus;
          s.flashWhite = Math.max(s.flashWhite, 0.4);
          s.trauma = Math.min(1, s.trauma + 0.1);
          spawnParticles(s, b.x, bucketTop, true, 10 + s.bucketStreak * 2);
          spawnImpactRing(s, b.x, bucketTop, TEXT_FX.gold, Math.min(1, 0.4 + s.bucketStreak * 0.1));
          s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 32, text: `STREAK ×${s.bucketStreak}`, life: 1, maxLife: 2, color: TEXT_FX.gold, combo: true, exclaim: true, fontSize: Math.min(26, 16 + s.bucketStreak), spin: (s.rng() - 0.5) * 1.2 });
          s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 14, text: `+${streakBonus.toLocaleString()}`, life: 1, maxLife: 1.8, color: TEXT_FX.goldHi, combo: true, fontSize: 14 });
        } else {
          s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 14, text: "EGG SAVED!", life: 1, maxLife: 1.8, color: TEXT_FX.boon, combo: true, exclaim: true, fontSize: 16, spin: (s.rng() - 0.5) * 1.5 });
        }

        // +1 œuf bonus tous les N rattrapages d'affilée.
        if (s.bucketStreak % BALANCE.bucketStreak.eggEvery === 0) {
          s.balls += 1;
          s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 50, text: "+1 EGG!", life: 1, maxLife: 2, color: TEXT_FX.boon, combo: true, fontSize: 15 });
        }

        events.push({ kind: "sound", id: s.bucketStreak >= 2 ? "jackpot" : "victory" });
      } else {
        // Rattrapage direct, sans avoir touché de peg : ne compte pas, casse la série.
        s.bucketStreak = 0;
        s.floatingTexts.push({ x: s.bucket + BUCKET_W / 2, y: bucketTop - 14, text: "EGG SAVED!", life: 1, maxLife: 1.8, color: TEXT_FX.boon, combo: true, exclaim: true, fontSize: 16, spin: (s.rng() - 0.5) * 1.5 });
        events.push({ kind: "sound", id: "victory" });
      }
    }
  }

  // L'œuf sort de l'écran → œuf manqué : la série de paniers est rompue ET le
  // multiplicateur orange ne se conservera PAS au tour suivant. ATTENTION : on ne reset
  // PAS turnOrangeCount ici — endOfTurn tourne dans le même tick, juste après, et doit
  // encore voir le mult pour l'appliquer au versement DE CE TOUR. On pose juste un flag ;
  // endOfTurn applique le mult, l'affiche perdu, puis remet le compteur à 0.
  if (b.active && b.y > H + 40) {
    b.active = false;
    s.bucketStreak = 0;
    if (s.turnOrangeCount > 0) s.orangeLostThisTurn = true;
  }
}
