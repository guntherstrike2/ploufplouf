// ─── DMD · Effects composables ───────────────────────────────────────────────
//
// La COUCHE 2 (« comment ») du moteur. Un `Effect` module COMMENT un layer est
// stampé : décalage (dx,dy en colonnes/lignes), intensité (mult 0..1+), et visibilité.
// Les effets sont COMPOSABLES : un layer reçoit une liste d'effets qu'on accumule.
// Cela couvre 90% des animations DMD classiques de flipper :
//
//   blink      — clignote (créneau net, façon plasma)
//   pulse      — respire (sinus doux sur l'intensité)
//   jitter     — tremble (±N dots, frenzy)
//   shake      — secousse verticale amortie (impact)
//   scroll     — défile en continu (marquee)
//   bob        — flotte verticalement (idle vivant)
//   gate       — apparaît/disparaît dans une fenêtre temporelle [from,to]
//   typewriter — révèle caractère par caractère (géré au niveau du layer texte)
//
// Un effet reçoit le CONTEXTE d'animation (temps réel `now` en s, et `t` la
// progression de la scène) et renvoie un `EffectOut` accumulable.

export interface EffectCtx {
  now: number;   // temps réel en secondes (performance.now()/1000) — anims libres
  t: number;     // progression 0..1 de la scène — anims synchronisées
}

export interface EffectOut {
  dx: number;       // décalage colonne (additif)
  dy: number;       // décalage ligne (additif)
  mult: number;     // facteur d'intensité (multiplicatif)
  reveal: number;   // fraction révélée 0..1 (pour typewriter ; min entre effets)
  visible: boolean; // si false, le layer n'est pas stampé cette frame
}

export type Effect = (ctx: EffectCtx) => Partial<EffectOut>;

const IDENTITY: EffectOut = { dx: 0, dy: 0, mult: 1, reveal: 1, visible: true };

// Accumule une liste d'effets en un seul EffectOut.
export function applyEffects(effects: Effect[] | undefined, ctx: EffectCtx): EffectOut {
  if (!effects || effects.length === 0) return IDENTITY;
  const out: EffectOut = { ...IDENTITY };
  for (const e of effects) {
    const r = e(ctx);
    if (r.dx) out.dx += r.dx;
    if (r.dy) out.dy += r.dy;
    if (r.mult !== undefined) out.mult *= r.mult;
    if (r.reveal !== undefined) out.reveal = Math.min(out.reveal, r.reveal);
    if (r.visible === false) out.visible = false;
  }
  return out;
}

// ── Bibliothèque ─────────────────────────────────────────────────────────────

// Clignotement net (créneau) à `hz` Hz. Au creux, l'intensité tombe à `floor`.
export function blink(hz = 6, floor = 0.55): Effect {
  return ({ now }) => ({ mult: Math.sin(now * hz * Math.PI) > -0.4 ? 1 : floor });
}

// Respiration douce (sinus) : l'intensité ondule entre 1-amp et 1.
export function pulse(hz = 1.2, amp = 0.25): Effect {
  return ({ now }) => ({ mult: 1 - amp * (0.5 - 0.5 * Math.sin(now * hz * Math.PI * 2)) });
}

// Tremblement : décale ±`amp` dots, change ~`hz` fois/s (alternance stable, pas random).
export function jitter(amp = 1, hz = 16): Effect {
  return ({ now }) => {
    const frame = Math.floor(now * hz);
    return { dx: (frame % 2 === 0 ? 1 : -1) * amp };
  };
}

// Secousse verticale amortie sur la progression de la scène (impact à l'entrée).
export function shake(amp = 2, decay = 6): Effect {
  return ({ t, now }) => ({ dy: Math.sin(now * 40) * amp * Math.exp(-t * decay) });
}

// Défilement continu (marquee) : `colsPerSec` colonnes/s, optionnellement vertical.
export function scroll(colsPerSec = 6, vertical = false): Effect {
  return ({ now }) => {
    const d = now * colsPerSec;
    return vertical ? { dy: -d } : { dx: -d };
  };
}

// Décalage de colonnes CONSTANT (dx fixe). Sert à recentrer un GROUPE de layers
// d'encres différentes : chacun part centré (col:"center") puis est poussé d'un dx
// déduit des largeurs de texte, sans avoir besoin de connaître `cols`.
export function shift(dx: number): Effect {
  return () => ({ dx });
}

// Flottement vertical doux (idle vivant) : ±`amp` lignes à `hz` Hz.
export function bob(amp = 0.5, hz = 0.6): Effect {
  return ({ now }) => ({ dy: amp * Math.sin(now * hz * Math.PI * 2) });
}

// Fenêtre temporelle : le layer n'est visible (et révélé progressivement) que dans
// [from,to] de la progression de scène. Avant → invisible ; pendant → fade-in court.
export function gate(from: number, to = 1): Effect {
  return ({ t }) => {
    if (t < from || t > to) return { visible: false };
    const fade = Math.min(1, (t - from) * 8);
    return { mult: fade };
  };
}

// Machine à écrire : révèle progressivement entre `from` et `to` de la scène.
export function typewriter(from = 0, to = 0.5): Effect {
  return ({ t }) => {
    const span = Math.max(0.001, to - from);
    return { reveal: Math.max(0, Math.min(1, (t - from) / span)) };
  };
}

// Fondu d'entrée linéaire sur les premières `dur` (fraction de scène).
export function fadeIn(dur = 0.15): Effect {
  return ({ t }) => ({ mult: Math.min(1, t / Math.max(0.001, dur)) });
}

// Fondu de sortie sur la fin de scène.
export function fadeOut(from = 0.85): Effect {
  return ({ t }) => ({ mult: t < from ? 1 : Math.max(0, 1 - (t - from) / Math.max(0.001, 1 - from)) });
}

// Glissade d'entrée : entre de `fromCols` colonnes (négatif = depuis la gauche) vers 0
// sur les premières `dur` de la scène, avec rebond. dx additif.
export function slideIn(fromCols: number, dur = 0.3): Effect {
  return ({ t }) => {
    const k = Math.min(1, t / Math.max(0.001, dur));
    // easeOutBack inline (overshoot doux).
    const c1 = 2.8, c3 = c1 + 1, p = k - 1;
    const eased = 1 + c3 * p * p * p + c1 * p * p;
    return { dx: fromCols * (1 - eased) };
  };
}
