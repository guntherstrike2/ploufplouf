// ─── DMD · Bibliothèque de scènes (data + hooks) ─────────────────────────────
//
// Chaque scène du DmdDirector — combo, série, frenzy, clutch, jackpot, record,
// niveau gagné, game over — est définie ICI comme une DATA déclarative (layers +
// timeline + effects) plutôt qu'en code impératif dans le HUD. Les rares moments
// créatifs (burst doré du jackpot, pluie de la frenzy) passent par le hook
// `custom(api)`. Une scène est produite par une FACTORY qui reçoit ses paramètres
// runtime (mot de combo, n° de niveau, valeur de record, expression de l'aigle).
//
// Priorités (qui interrompt qui) et durées vivent à côté de chaque factory pour que
// tout ce qui concerne « une scène » soit au même endroit.

import {
  kf, type SceneDef, type DmdFace, type SceneApi,
  eagleDots, eggDots, miniEagleDots, EGG_FRAME_COUNT, EAGLE_W,
  STAR_DOTS, STAR_W, MINI_EAGLE_W, EGG_W,
  blink, typewriter, gate, fadeIn, jitter, pulse, stampText, textCols,
} from "./index";

// Priorité de chaque scène (plus haut = interrompt). levelWon/gameOver au sommet.
// (Plus d'entrée "combo" : le combo ne joue plus de scène, il pulse juste la brillance.)
export const SCENE_PRIO = {
  idle: 0, streak: 2, frenzy: 3, clutch: 4, jackpot: 5, record: 6, levelWon: 7, gameOver: 8,
} as const;

// Scènes qui restent FIGÉES en fin de jeu (ne fondent pas vers l'idle).
export const FROZEN_SCENES = new Set<string>(["gameOver"]);

// ── COMBO ────────────────────────────────────────────────────────────────────
// (Plus de scène de mot au combo : le verre reste sur le score, le HUD ne fait que
// pulser la brillance — cf. renderer/hud.ts. La table de mots hype sert encore aux
// HypeText du playfield, pas au DMD.)

// ── STREAK ───────────────────────────────────────────────────────────────────
// Série de paniers (≥2). La variante CYCLE selon la taille de série (`count`) plutôt
// qu'au hasard : déterministe (pas de Math.random au rendu, comme le reste du moteur)
// et la variété reste naturelle puisque `count` grimpe d'un cran à chaque série.
// 6 ambiances arcade : compteur+points, flammes ON FIRE, aigle qui plonge, slot
// machine, jauge de combo, étoiles filantes. Toutes lisent `count` (taille de série).

const STREAK_VARIANTS = [streakDots, streakFire, streakDive, streakSlot, streakGauge, streakStars];

export function streakScene(count: number): SceneDef {
  const pick = STREAK_VARIANTS[((count % STREAK_VARIANTS.length) + STREAK_VARIANTS.length) % STREAK_VARIANTS.length]!;
  return pick(count);
}

// (1) COMPTEUR + POINTS — « STREAK x3 » centré, une rangée de points dessous (un par
// catch, ils s'allument un à un en bas de bande).
function streakDots(count: number): SceneDef {
  return {
    dur: 78, transition: "dissolve",
    layers: [
      { kind: "text", text: `STREAK x${count}`, band: "top", row: 0, col: "center",
        effects: [blink(6, 0.7), fadeIn(0.1)] },
    ],
    custom: ({ ctx, cols, dot }: SceneApi) => {
      const t = ctx.t;
      const n = Math.min(count, 8);
      const totalW = n * 2 - 1;             // dot + gap
      let c0 = Math.floor((cols - totalW) / 2);
      const lit = Math.min(n, Math.floor(t / 0.6 * n) + 1);
      for (let i = 0; i < n; i++) {
        if (i < lit) dot("top", c0, 6, 1);
        c0 += 2;
      }
    },
  };
}

// (2) FLAMMES — « ON FIRE! » + rangée de flammes pixel qui vacillent en bas de bande.
function streakFire(count: number): SceneDef {
  return {
    dur: 78, transition: "wipe", hot: true,
    layers: [
      { kind: "text", text: count >= 4 ? "ON FIRE!" : "HEAT!", band: "top", row: 0, col: "center",
        effects: [jitter(1, 14), blink(6, 0.7)] },
    ],
    custom: ({ ctx, cols, dot }: SceneApi) => {
      const frame = Math.floor(ctx.now * 18);
      for (let c = 0; c < cols; c++) {
        // hauteur de flamme pseudo-aléatoire mais stable par colonne+frame.
        const h = (Math.abs(Math.sin(c * 12.9898 + frame * 0.7) * 43758.5) % 1);
        const top = h > 0.5 ? 4 : h > 0.25 ? 5 : 6;
        for (let r = 6; r >= top; r--) dot("top", c, r, r === top ? 0.6 : 1);
      }
    },
  };
}

// (3) DIVE — un mini-aigle plonge en diagonale à travers le verre + « x3 » qui clignote.
function streakDive(count: number): SceneDef {
  return {
    dur: 78, transition: "none",
    layers: [
      { kind: "text", text: `x${count}`, band: "top", row: 0, col: "center",
        effects: [blink(6, 0.7), fadeIn(0.2)] },
    ],
    // L'aigle traverse tout l'écran (-MINI_EAGLE_W → cols) en descendant : géométrie
    // diagonale → hook custom plutôt qu'un colTrack borné au verre.
    custom: ({ ctx, cols, dot }: SceneApi) => {
      const t = ctx.t;
      const rows = miniEagleDots();
      const cx = Math.floor(-MINI_EAGLE_W + t * (cols + MINI_EAGLE_W));
      const ry = Math.floor(t * (15 - rows.length));
      for (let r = 0; r < rows.length; r++)
        for (let c = 0; c < rows[r]!.length; c++)
          if (rows[r]![c] === "#") dot("full", cx + c, ry + r, 1);
    },
  };
}

// (4) SLOT — les chiffres défilent comme une machine à sous puis s'arrêtent sur « x3 ».
function streakSlot(count: number): SceneDef {
  return {
    dur: 84, transition: "shutter",
    custom: ({ ctx, cols, buf }: SceneApi) => {
      const t = ctx.t;
      const settle = 0.7;
      // avant settle : chiffres qui défilent ; après : verrouillé sur count.
      const shown = t < settle
        ? `STREAK x${Math.floor((1 - t / settle) * 9 + Math.floor(ctx.now * 30)) % 9 + 1}`
        : `STREAK x${count}`;
      const c0 = Math.floor((cols - textCols(shown)) / 2);
      const blinkOn = t < settle || Math.floor(ctx.now * 8) % 2 === 0;
      if (blinkOn) stampText(buf, shown, c0, 0, 1);
    },
  };
}

// (5) JAUGE — une barre de combo qui se remplit segment par segment, « STREAK » au-dessus.
function streakGauge(count: number): SceneDef {
  return {
    dur: 78, transition: "wipe",
    layers: [
      { kind: "text", text: "STREAK", band: "top", row: 0, col: "center", effects: [fadeIn(0.1)] },
    ],
    custom: ({ ctx, cols, dot }: SceneApi) => {
      const t = ctx.t;
      const segs = Math.min(count, 10);
      const barW = segs * 2 - 1;
      let c0 = Math.floor((cols - barW) / 2);
      const fill = Math.min(segs, Math.floor(t / 0.7 * segs) + 1);
      for (let i = 0; i < segs; i++) {
        const v = i < fill ? 1 : 0.2;
        dot("bot", c0, 4, v);
        dot("bot", c0, 5, v);
        c0 += 2;
      }
    },
  };
}

// (6) ÉTOILES — « x3 STREAK! » + des étoiles qui filent en travers (réutilise STAR_DOTS).
function streakStars(count: number): SceneDef {
  return {
    dur: 80, transition: "dissolve",
    layers: [
      { kind: "text", text: `STREAK x${count}`, band: "top", row: 0, col: "center",
        effects: [blink(6, 0.7)] },
    ],
    custom: ({ ctx, cols, dot }: SceneApi) => {
      const n = Math.min(count, 4);
      for (let s = 0; s < n; s++) {
        // chaque étoile a un offset de phase → file en diagonale, décalée.
        const phase = (ctx.t * 1.4 + s * 0.27) % 1;
        const sx = Math.floor(phase * (cols + STAR_W)) - STAR_W;
        const sy = (s * 3 + 1) % 8;
        for (let r = 0; r < STAR_DOTS.length; r++)
          for (let c = 0; c < STAR_W; c++)
            if (STAR_DOTS[r]![c] === "#") dot("full", sx + c, sy + r, 1 - phase * 0.4);
      }
    },
  };
}

// ── FRENZY ───────────────────────────────────────────────────────────────────
// Le mot tremble (jitter) + pluie de dots clignotants (hook custom).
export function frenzyScene(word: string): SceneDef {
  return {
    dur: 72, transition: "dissolve",
    layers: [
      { kind: "text", text: word, band: "top", row: 4, col: "center", effects: [jitter(1, 16), blink(6, 0.7)] },
    ],
    custom: ({ cols, ctx, dot }) => {
      const frame = Math.floor(ctx.now * 16);
      for (let i = 0; i < 10; i++) {
        const c = (i * 7 + (frame % 3)) % Math.max(1, cols);
        const r = (i * 3 + frame) % 15;   // pluie sur tout le verre (15 lignes)
        if (Math.sin(frame * 0.7 + i * 2.3) > 0) dot("full", c, r, 0.6);
      }
    },
  };
}

// ── CLUTCH ───────────────────────────────────────────────────────────────────
// Entrée en fever : aigle féroce à gauche + « DERNIERE PROIE » qui pulse, encre chaude.
export function clutchScene(face: DmdFace): SceneDef {
  return {
    dur: 64, transition: "wipe", hot: true,
    layers: [
      { kind: "sprite", matrix: eagleDots({ ...face, brow: "angry", blink: false, star: false }),
        w: EAGLE_W, band: "top", col: 0 },
      { kind: "text", text: "DERNIERE PROIE", band: "top", col: "center", effects: [blink(6, 0.6)] },
    ],
  };
}

// ── JACKPOT ──────────────────────────────────────────────────────────────────
// Pièce de bravoure (plein écran) : l'œuf éclot (bande haute, piste "egg"), le mot
// JACKPOT clignote (bande basse), puis éclat doré final (hook custom).
export function jackpotScene(): SceneDef {
  return {
    dur: 96, transition: "iris", fullTakeover: true, hot: true,
    build: (tl) => {
      // Ramène jusqu'à l'avant-dernière frame (coquille ouverte) : la dernière frame
      // « éclat » est volontairement remplacée par le burst doré du hook custom (t>0.78).
      tl.track("egg", [kf(0, 0), kf(0.78, EGG_FRAME_COUNT - 2, "linear")]);
    },
    layers: [
      // Œuf : frame pilotée par la piste "egg" (centrée bande haute).
      { kind: "sprite", w: EGG_W, band: "top", col: "center",
        matrix: (tl) => eggDots(Math.min(EGG_FRAME_COUNT - 2, Math.floor(tl.value("egg")))) },
      // Aiglon qui jaillit en fin d'éclosion.
      { kind: "sprite", matrix: miniEagleDots(), w: MINI_EAGLE_W, band: "top", row: 1, col: "center",
        effects: [gate(0.5, 0.78)] },
      // JACKPOT s'écrit en bas dès la moitié de l'éclosion.
      { kind: "text", text: "JACKPOT", band: "bot", col: "center", effects: [gate(0.4), blink()] },
    ],
    // Éclat doré + giclées radiales dans la phase finale (>0.78).
    custom: ({ ctx, cols, dot }) => {
      const t = ctx.t;
      if (t < 0.78) return;
      const burst = (t - 0.78) / 0.22;
      const cc = Math.floor(cols / 2), cr = 3;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const rr = burst * 5;
        const c = Math.round(cc + Math.cos(ang) * rr);
        const r = Math.round(cr + Math.sin(ang) * rr - burst * 2);
        dot("top", c, r, 1 - burst);
      }
    },
  };
}

// ── RECORD ───────────────────────────────────────────────────────────────────
// Nouveau meilleur score (plein écran) : aigle yeux-étoile + RECORD! typewriter
// (bande haute), puis la VALEUR en or qui clignote (bande basse).
export function recordScene(face: DmdFace, valueStr: string): SceneDef {
  return {
    dur: 110, transition: "iris", fullTakeover: true,
    layers: [
      { kind: "sprite", matrix: eagleDots({ ...face, star: true, blink: false }),
        w: EAGLE_W, band: "top", col: 0 },
      { kind: "text", text: "RECORD!", band: "top", col: EAGLE_W + 2, effects: [typewriter(0, 0.4)] },
      { kind: "text", text: valueStr, band: "bot", col: "center", ink: "gold",
        effects: [gate(0.45), blink(6, 0.7)] },
    ],
  };
}

// ── NIVEAU GAGNÉ ─────────────────────────────────────────────────────────────
// Message NIVEAU N en machine à écrire (bande haute) + 3 étoiles qui pop (bande basse).
export function levelWonScene(face: DmdFace, level: number): SceneDef {
  const text = `NIVEAU ${level}`;
  return {
    dur: 130, transition: "shutter", fullTakeover: true,
    layers: [
      { kind: "sprite", matrix: eagleDots({ ...face, star: true, blink: false }),
        w: EAGLE_W, band: "top", col: 0 },
      { kind: "text", text, band: "top", col: EAGLE_W + 2, effects: [typewriter(0, 0.5)] },
    ],
    // 3 étoiles qui pop une à une (positions discrètes → hook custom).
    custom: ({ ctx, cols, dot }) => {
      const t = ctx.t;
      const popN = t < 0.5 ? 0 : Math.floor(((t - 0.5) / 0.5) * 3) + 1;
      const totalW = 3 * (STAR_W + 1);
      let c0 = Math.floor((cols - totalW) / 2);
      for (let i = 0; i < Math.min(3, popN); i++) {
        for (let r = 0; r < STAR_DOTS.length; r++)
          for (let c = 0; c < STAR_W; c++)
            if (STAR_DOTS[r]![c] === "#") dot("bot", c0 + c, r + 2, 1);
        c0 += STAR_W + 1;
      }
    },
  };
}

// ── GAME OVER ────────────────────────────────────────────────────────────────
// Aigle effondré (bande haute) + GAME OVER figé (bande basse), dalle qui s'assombrit.
export function gameOverScene(face: DmdFace): SceneDef {
  return {
    dur: 120, transition: "shutter", hot: false, fullTakeover: true,
    layers: [
      { kind: "sprite", matrix: eagleDots({ ...face, brow: "drowsy", blink: true, star: false }),
        w: EAGLE_W, band: "top", col: "center",
        effects: [pulse(0.5, 0.4)] },
      { kind: "text", text: "GAME OVER", band: "bot", col: "center", effects: [blink(4, 0.4)] },
    ],
  };
}
