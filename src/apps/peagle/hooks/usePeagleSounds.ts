"use client";

import { useCallback, useEffect, useRef } from "react";
import { getContext, getMasterGain, loadBuffer, prefetch } from "@/lib/audio/engine";
import { useSettingsState } from "@/lib/contexts/settings-context";
import { W } from "../engine/constants";

// ─── Samples (cris d'aigle réels, MP3) ───────────────────────────────────────
const CRY_SHORT = "/sounds/peagle-eagle-cry-short.mp3";
const CRY_LONG  = "/sounds/peagle-eagle-cry-long.mp3";

// ─── Compressor partagé ──────────────────────────────────────────────────────
// Un seul DynamicsCompressor pour tous les sons Peagle — donne le "punch"
// caractéristique des jeux modernes. Invalidé si le contexte change.

let _comp: { ctx: AudioContext; node: DynamicsCompressorNode } | null = null;

function getComp(ctx: AudioContext, master: GainNode): AudioNode {
  if (!_comp || _comp.ctx !== ctx) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = -18;
    c.knee.value      = 8;
    c.ratio.value     = 4;
    c.attack.value    = 0.002;
    c.release.value   = 0.08;
    c.connect(master);
    _comp = { ctx, node: c };
  }
  return _comp.node;
}

// ─── Courbe de distorsion (soft-clip) ────────────────────────────────────────

function makeClipCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 512;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// ─── Helpers de synthèse ────────────────────────────────────────────────────
// Tous prennent `dest` (AudioNode) plutôt que master directement.
// `t` = ctx.currentTime + delay pour les planifications futures.

/** Oscillateur simple avec micro-attaque (évite les clics) + decay exponentiel */
function tone(
  ctx: AudioContext, dest: AudioNode,
  freq: number, dur: number, type: OscillatorType, vol: number,
  delay = 0, freqEnd?: number,
) {
  const t = ctx.currentTime + delay;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) {
      // Exponential ramp = courbe musicale, bien plus naturelle que linéaire
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + dur);
    }
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.001); // micro-attack anti-clic
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.01);
  } catch {}
}

/** Paire d'oscillateurs légèrement désaccordés — double l'épaisseur du son */
function detuned(
  ctx: AudioContext, dest: AudioNode,
  freq: number, centsSpread: number,
  dur: number, type: OscillatorType, vol: number,
  delay = 0,
) {
  const t = ctx.currentTime + delay;
  try {
    const o1   = ctx.createOscillator();
    const o2   = ctx.createOscillator();
    const gain = ctx.createGain();
    o1.type = o2.type = type;
    o1.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq, t);
    o1.detune.setValueAtTime(-centsSpread / 2, t);
    o2.detune.setValueAtTime( centsSpread / 2, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o1.connect(gain); o2.connect(gain); gain.connect(dest);
    o1.start(t); o1.stop(t + dur + 0.01);
    o2.start(t); o2.stop(t + dur + 0.01);
  } catch {}
}

/**
 * Synthèse FM — le modulator module la fréquence du carrier.
 * Donne des timbres de type xylophone, cloche, métal selon les ratios.
 *   modRatio  = fréquence modulant / fréquence porteuse (2 = octave, 3.5 = xylophone)
 *   modIdx    = profondeur de modulation (1=clair, 4+=métallique)
 */
function fm(
  ctx: AudioContext, dest: AudioNode,
  carrFreq: number, modRatio: number, modIdx: number,
  dur: number, vol: number,
  delay = 0,
) {
  const t = ctx.currentTime + delay;
  try {
    const carrier   = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain   = ctx.createGain();
    const envGain   = ctx.createGain();

    carrier.type   = "sine";
    modulator.type = "sine";
    carrier.frequency.setValueAtTime(carrFreq, t);
    modulator.frequency.setValueAtTime(carrFreq * modRatio, t);

    // La profondeur de modulation décroît plus vite → le timbre part métallique
    // puis s'adoucit : son "bell" classique.
    modGain.gain.setValueAtTime(carrFreq * modIdx, t);
    modGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);

    envGain.gain.setValueAtTime(0, t);
    envGain.gain.linearRampToValueAtTime(vol, t + 0.001);
    envGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency); // FM!
    carrier.connect(envGain);
    envGain.connect(dest);

    modulator.start(t); modulator.stop(t + dur + 0.01);
    carrier.start(t);   carrier.stop(t + dur + 0.01);
  } catch {}
}

/** Bruit blanc filtré passe-bande — transients et textures */
function noise(
  ctx: AudioContext, dest: AudioNode,
  dur: number, vol: number,
  filterFreq = 800, delay = 0, filterQ = 1.2,
) {
  const t = ctx.currentTime + delay;
  try {
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    const filter = ctx.createBiquadFilter();
    filter.type  = "bandpass";
    filter.frequency.value = filterFreq;
    filter.Q.value         = filterQ;
    const gain   = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(dest);
    src.start(t); src.stop(t + dur + 0.01);
  } catch {}
}

/** Oscillateur saturable via WaveShaper — crunch et mordant */
function distortedTone(
  ctx: AudioContext, dest: AudioNode,
  freq: number, dur: number, vol: number,
  distAmount: number, delay = 0, freqEnd?: number,
) {
  const t = ctx.currentTime + delay;
  try {
    const osc     = ctx.createOscillator();
    const shaper  = ctx.createWaveShaper();
    const gain    = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + dur);
    }
    shaper.curve = makeClipCurve(distAmount);
    shaper.oversample = "2x";
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(shaper); shaper.connect(gain); gain.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.01);
  } catch {}
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePeagleSounds() {
  const { settings } = useSettingsState();
  const enabledRef = useRef(settings.soundEnabled);
  useEffect(() => { enabledRef.current = settings.soundEnabled; }, [settings.soundEnabled]);

  // Précharge les cris d'aigle pour qu'ils soient prêts dès l'intro.
  useEffect(() => { prefetch(CRY_SHORT); prefetch(CRY_LONG); }, []);

  /** Retourne { ctx, dest } (dest = compresseur Peagle) ou null si muet. */
  const cd = useCallback((): { ctx: AudioContext; dest: AudioNode } | null => {
    if (!enabledRef.current) return null;
    try {
      const ctx  = getContext();
      const dest = getComp(ctx, getMasterGain());
      return { ctx, dest };
    } catch { return null; }
  }, []);

  // ── Cris d'aigle (samples MP3) ────────────────────────────────────────────
  // Joués via le compresseur Peagle comme tous les sons → restent dans le mix.

  /** Joue un sample one-shot à travers le compresseur, pitch/volume réglables. */
  const playSample = useCallback((url: string, vol: number, rate = 1) => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    loadBuffer(url).then((buf) => {
      if (!enabledRef.current) return; // coupé pendant le chargement
      try {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const gain = ctx.createGain();
        gain.gain.value = vol;
        src.connect(gain); gain.connect(dest);
        src.start();
      } catch {}
    }).catch(() => {});
  }, [cd]);

  /** Petit cri — teaser pendant l'intro. `rate` fourni par l'appelant (pitch qui
   *  escalade d'un peek à l'autre) ; sinon pitch random ±22% par défaut. */
  const playEagleCryShort = useCallback((vol = 0.35, rate?: number) => {
    playSample(CRY_SHORT, vol, rate ?? 0.78 + Math.random() * 0.44);
  }, [playSample]);

  /** Gros cri — l'aigle débarque vraiment. `rate` < 1 = pitch grave (ex: défaite dégoûtée). */
  const playEagleCryLong = useCallback((vol = 0.6, rate = 1) => {
    playSample(CRY_LONG, vol, rate);
  }, [playSample]);

  // ── Gameplay ────────────────────────────────────────────────────────────────

  /**
   * Peg normal touché.
   * – FM bois rond (ratio 2 = octave, plus chaud que 3.5 xylophone)
   * – Sub thunk grave pour le "bounce" physique
   * – Pitch légèrement plus aigu à droite qu'à gauche (immersion spatiale)
   */
  const playPegHit = useCallback((combo = 0, x = W / 2) => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Pitch spatial : x=0 → -8%, x=W → +8%
    const spatial = 1 + ((x / W) - 0.5) * 0.16;
    const baseFreq = (380 + Math.random() * 70) * spatial;
    const modIdx   = 0.6 + combo * 0.22; // 0.6 (chaud) → ~2.8 à combo 10
    fm(ctx, dest, baseFreq, 2.0, modIdx, 0.075, 0.14);
    // Sub thunk — donne le "bounce" physique
    tone(ctx, dest, 75 + combo * 8, 0.045, "sine", 0.12, 0, 38);
    noise(ctx, dest, 0.014, 0.040, baseFreq * 0.9, 0, 2.0);
  }, [cd]);

  /**
   * Peg qui apparaît pendant le rideau d'intro — petit "ploc" cristallin très
   * léger et bref, pitché spatialement (x) et avec un soupçon d'aléa pour éviter
   * la répétition mécanique sur la rafale d'apparitions.
   */
  const playPegReveal = useCallback((x = W / 2) => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Pitch spatial large (registre clair) + jitter aléatoire → grappe scintillante
    const spatial = 1 + ((x / W) - 0.5) * 0.5;
    const freq = (880 + Math.random() * 220) * spatial;
    fm(ctx, dest, freq, 3.0, 0.8, 0.05, 0.028);
  }, [cd]);

  /**
   * Orange peg touché.
   * – FM cloche chaude (ratio 2) — plus grave et plus riche
   * – Harmonique grave bien marquée + sub thunk satisfaisant
   */
  const playOrangePegHit = useCallback((combo = 0, x = W / 2) => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    const spatial = 1 + ((x / W) - 0.5) * 0.12;
    const baseFreq = (620 + Math.random() * 80) * spatial;
    const modIdx   = 1.0 + combo * 0.30;
    fm(ctx, dest, baseFreq, 2, modIdx, 0.09, 0.17);
    // Harmonique grave "corps"
    detuned(ctx, dest, baseFreq * 0.5, 12, 0.12, "sine", 0.09, 0.004);
    // Sub thunk plus marqué que le peg normal
    tone(ctx, dest, 90, 0.060, "sine", 0.18, 0, 42);
    noise(ctx, dest, 0.018, 0.060, baseFreq * 0.8, 0, 1.8);
  }, [cd]);

  /**
   * Bumper touché.
   * – Sub thud grave + chirp montant modéré → boing caoutchouc élastique
   * – Distorsion adoucie (8 au lieu de 18) pour moins de dureté
   */
  const playBumperHit = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Sub boing — la sensation de masse qui rebondit
    tone(ctx, dest, 95, 0.090, "sine", 0.24, 0, 42);
    // Chirp montant modéré — caoutchouc, pas métal
    distortedTone(ctx, dest, 190, 0.060, 0.15, 8, 0.005, 560);
    noise(ctx, dest, 0.022, 0.060, 480, 0, 0.8);
  }, [cd]);

  /**
   * Palier de combo franchi (×N) — petit arpège pixel ascendant qui escalade
   * avec le palier : récompense audible et satisfaisante de la montée en combo.
   * Le registre grimpe par paliers (pentatonique majeure) puis sature au sommet,
   * et un sub-pop appuie le « claquement » du mot hype qui apparaît.
   */
  const playComboTier = useCallback((tier = 1) => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    const t = Math.max(0, tier - 1);
    // Gamme pentatonique majeure de Do — chaque palier décale le départ d'un degré
    // et transpose à l'octave au-delà, pour une montée qui reste musicale et brillante.
    const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0] as const; // C5 D5 E5 G5 A5
    const start = t % PENTA.length;
    const oct = Math.pow(2, Math.floor(t / PENTA.length));
    // Arpège de 3 notes montantes — le tempo se resserre légèrement avec le palier.
    const step = Math.max(0.045, 0.075 - t * 0.004);
    for (let i = 0; i < 3; i++) {
      const f = PENTA[(start + i * 2) % PENTA.length]! * oct * (i >= PENTA.length - start ? 2 : 1);
      detuned(ctx, dest, f, 9, 0.13, "sine", 0.10, i * step);
      fm(ctx, dest, f, 2, 0.7 + t * 0.12, 0.10, i * step); // brillance FM qui monte
    }
    // Sub-pop synchro avec le « claquement » du mot hype.
    tone(ctx, dest, 120 + t * 6, 0.06, "sine", 0.14, 0, 60);
    // Étincelle aiguë sur les gros paliers.
    if (t >= 2) noise(ctx, dest, 0.05, 0.04, 2400, 0.02, 2.0);
  }, [cd]);

  /**
   * Rebond mur — impact caoutchouc sourd.
   * – Sub thud + bruit grave + chirp descendant bas
   */
  const playWallBounce = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Sub thud sourd
    tone(ctx, dest, 80, 0.032, "sine", 0.14, 0, 36);
    noise(ctx, dest, 0.025, 0.10, 260, 0, 0.4);
    tone(ctx, dest, 210, 0.038, "triangle", 0.08, 0, 58);
  }, [cd]);

  /**
   * Balle sauvée par le bucket.
   * – Sub kick (chirp grave) + arpège ascendant en paires désaccordées
   */
  const playBucketCatch = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Sub kick
    tone(ctx, dest, 160, 0.08, "sine", 0.22, 0, 45);
    // Arpège avec paires désaccordées
    ([523, 659, 784, 1047] as const).forEach((f, i) =>
      detuned(ctx, dest, f, 10, 0.07, "sine", 0.12, 0.038 + i * 0.042),
    );
    noise(ctx, dest, 0.04, 0.05, 1300, 0.04, 1.5);
  }, [cd]);

  /**
   * JACKPOT — dernière orange + bucket. Le son le plus important du jeu.
   * – Sub kick massif + explosion de bruit + arpège chromatique en rafale
   * – Accord final tenu + scintillement
   */
  const playJackpot = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;

    // Sub kick massif
    tone(ctx, dest, 110, 0.16, "sine", 0.28, 0, 28);
    // Explosion bruit
    noise(ctx, dest, 0.10, 0.13, 900, 0, 0.7);

    // Arpège chromatique ultra-rapide — 8 notes, paires désaccordées
    ([392, 494, 587, 698, 784, 988, 1175, 1568] as const).forEach((f, i) =>
      detuned(ctx, dest, f, 8, 0.07, "sine", 0.14, 0.015 + i * 0.034),
    );

    // Accord C-E-G final soutenu (délai 0.28s = après l'arp)
    ([523, 659, 784] as const).forEach((f) =>
      detuned(ctx, dest, f, 14, 0.55, "sine", 0.10, 0.28),
    );
    fm(ctx, dest, 1047, 2, 0.5, 0.55, 0.12, 0.28);

    // Scintillement final
    noise(ctx, dest, 0.06, 0.07, 2200, 0.30, 2.0);
  }, [cd]);

  /**
   * Level gagné.
   * – Arpège majeur ascendant + note finale soutenue avec FM
   */
  const playLevelClear = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    ([523, 659, 784, 1047, 1318] as const).forEach((f, i) => {
      const isLast = i === 4;
      detuned(ctx, dest, f, 10, isLast ? 0.50 : 0.08, "sine", 0.14, i * 0.068);
      if (isLast) fm(ctx, dest, f, 2, 0.8, 0.50, 0.06, i * 0.068);
    });
    noise(ctx, dest, 0.07, 0.05, 1600, 0.34, 1.5);
  }, [cd]);

  /**
   * Pegs effacés en fin de tour.
   * – Sweep FM montant unique — plus cohérent que 3 tones séparés
   */
  const playPegClear = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    fm(ctx, dest, 350, 2, 1.5, 0.08, 0.11);
    tone(ctx, dest, 350, 0.08, "sine", 0.08, 0, 900);
    noise(ctx, dest, 0.04, 0.04, 850, 0.04, 1.8);
  }, [cd]);

  /**
   * Game over — descente mélancolique avec saturation légère.
   * Utilisé pour les événements secondaires (ex : "delete").
   */
  const playGameOver = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    distortedTone(ctx, dest, 440, 0.40, 0.10, 6, 0, 200);
    tone(ctx, dest, 220, 0.40, "sine", 0.09, 0.10, 110);
    noise(ctx, dest, 0.08, 0.05, 330, 0.05, 0.6);
  }, [cd]);

  /**
   * Stinger game over classique : impact + 3 stabs mineurs descendants + note finale.
   * Durée ~1.7s — "wah wah wah waaah".
   */
  const playGameOverStinger = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;

    // Impact initial
    noise(ctx, dest, 0.06, 0.22, 300, 0, 0.45);
    tone(ctx, dest, 55, 0.12, "sine", 0.30, 0, 28);
    distortedTone(ctx, dest, 160, 0.07, 0.16, 14, 0.005, 85);

    // 3 stabs courts descendants — A4 → F#4 → Eb4 (descente mineure)
    ([440, 370, 311] as const).forEach((freq, i) => {
      const t = 0.05 + i * 0.18;
      detuned(ctx, dest, freq, 16, 0.16, "sine", 0.17, t);
      tone(ctx, dest, freq * 0.5, 0.15, "sine", 0.11, t);
    });

    // Note finale longue : A3 descendant vers E3
    const fT = 0.05 + 3 * 0.18;
    detuned(ctx, dest, 220, 20, 1.1, "sine", 0.20, fT);
    tone(ctx, dest, 220, 1.1, "sine", 0.16, fT, 165);
    fm(ctx, dest, 220, 2, 1.5, 1.0, 0.14, fT);
    tone(ctx, dest, 110, 1.0, "sine", 0.14, fT, 82);
  }, [cd]);

  // ── Menus ────────────────────────────────────────────────────────────────────

  /**
   * Hover bouton — FM ping doux, registre médium.
   * Pitch random pour éviter la monotonie.
   */
  const playMenuHover = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    fm(ctx, dest, 520 + Math.random() * 180, 2, 1.2, 0.018, 0.048);
  }, [cd]);

  /**
   * Click bouton — transient bruit + tail pitché.
   * Moderne et net, style "confirmation UI".
   */
  const playMenuClick = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    noise(ctx, dest, 0.010, 0.10, 620, 0, 1.5); // transient click
    tone(ctx, dest, 400, 0.042, "sine", 0.07, 0.008, 180); // tail pitché descendant
  }, [cd]);

  /**
   * Menu révélé après l'intro — chime descendant avec léger écho.
   * Les paires désaccordées donnent une texture "bois chaud".
   */
  const playMenuReveal = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    const notes = [523, 392, 330, 261] as const; // une octave plus bas
    notes.forEach((f, i) => {
      detuned(ctx, dest, f, 14, 0.18, "sine", 0.072, i * 0.085);
      // Echo à volume réduit — simule un reverb court
      detuned(ctx, dest, f, 14, 0.10, "sine", 0.022, i * 0.085 + 0.048);
    });
  }, [cd]);

  /**
   * Impact œuf sur le titre — bruit + chirp proportionnels à la force.
   */
  const playTitleImpact = useCallback((force: number) => {
    if (force < 0.07) return;
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Sub thud proportionnel à la force
    tone(ctx, dest, 70, 0.040, "sine", force * 0.18, 0, 32);
    noise(ctx, dest, 0.022, force * 0.08, 320 + force * 220, 0, 0.4);
    tone(ctx, dest, 260 + force * 140, 0.032, "triangle", force * 0.09, 0, 105 + force * 40);
  }, [cd]);

  // ── Upgrade picker ──────────────────────────────────────────────────────────

  /**
   * Les cartes d'upgrade apparaissent — shimmer ascendant FM, octave plus bas.
   */
  const playUpgradeReveal = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    ([261, 330, 392, 523] as const).forEach((f, i) =>
      fm(ctx, dest, f, 2, 0.8, 0.09, 0.090, i * 0.055),
    );
    noise(ctx, dest, 0.04, 0.03, 650, 0.20, 1.2);
  }, [cd]);

  /** Hover carte upgrade — FM doux, registre médium. */
  const playUpgradeHover = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    fm(ctx, dest, 380 + Math.random() * 100, 2, 1.2, 0.022, 0.050);
  }, [cd]);

  /**
   * Upgrade choisie — le son le plus satisfaisant des menus.
   * Accord plein C-E-G avec FM + sub note bien marquée + sparkle doux.
   */
  const playUpgradePick = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Accord simultané en paires désaccordées
    ([523, 659, 784] as const).forEach((f) =>
      detuned(ctx, dest, f, 12, 0.32, "sine", 0.092),
    );
    fm(ctx, dest, 523, 2, 1.0, 0.44, 0.11, 0.048); // FM à l'octave (523 au lieu de 1047)
    // Sub note pour la sensation de "poids"
    tone(ctx, dest, 130, 0.22, "sine", 0.16, 0, 80);
    noise(ctx, dest, 0.04, 0.06, 720, 0.05, 1.2);
  }, [cd]);

  /** Upgrade passée — descente propre. */
  const playUpgradeSkip = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    tone(ctx, dest, 600, 0.040, "sine", 0.065, 0, 300);
    noise(ctx, dest, 0.020, 0.03, 400, 0.015, 0.8);
  }, [cd]);

  /**
   * Feu d'artifice — sifflement montant + pop d'éclatement + étincelles.
   * Joué périodiquement pendant la phase de victoire.
   */
  const playFirework = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    const baseFreq = 160 + Math.random() * 120;
    // Sifflement montant
    tone(ctx, dest, baseFreq, 0.18, "sine", 0.10, 0, 1400 + Math.random() * 900);
    // Pop d'éclatement (bruit)
    noise(ctx, dest, 0.09, 0.16, 1600 + Math.random() * 1000, 0.18, 1.5);
    // Étincelles aiguës
    const sparkFreq = 700 + Math.random() * 500;
    detuned(ctx, dest, sparkFreq,        14, 0.13, "sine", 0.09, 0.18);
    detuned(ctx, dest, sparkFreq * 1.52, 10, 0.10, "sine", 0.06, 0.21);
    // Sub pop pour le "coup"
    tone(ctx, dest, 110, 0.09, "sine", 0.14, 0.18, 50);
  }, [cd]);

  // ── Launcher ────────────────────────────────────────────────────────────────

  /**
   * TABLEAU VIDE — tous les pegs détruits, sensation "l'écran explose".
   * – Whoosh de bruit large + sub boom + accord C-E-G-B étalé + pluie de sparkles
   */
  const playClearBoard = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Sub boom massif
    tone(ctx, dest, 65, 0.22, "sine", 0.36, 0, 28);
    // Whoosh large
    noise(ctx, dest, 0.18, 0.26, 900, 0, 0.8);
    noise(ctx, dest, 0.10, 0.16, 2400, 0.04, 1.2);
    // Accord étalé C-E-G-B-C' (pentatonique lumieux)
    ([523, 659, 784, 988, 1047] as const).forEach((f, i) =>
      detuned(ctx, dest, f, 10, 0.70, "sine", 0.13, 0.05 + i * 0.05),
    );
    fm(ctx, dest, 1047, 2, 0.9, 0.70, 0.15, 0.25);
    // Pluie de sparkles aiguës (4 vagues décalées)
    ([1568, 1976, 2637, 3136] as const).forEach((f, i) =>
      detuned(ctx, dest, f, 8, 0.18, "sine", 0.08, 0.38 + i * 0.07),
    );
    noise(ctx, dest, 0.09, 0.08, 3000, 0.42, 2.2);
  }, [cd]);

  /**
   * Count-up — son de PIÈCE en boucle ultra-rapide pendant que le score se déverse vers
   * le total (« brrrr » de comptage classique, type Mario/Sonic). Joué CHAQUE frame (~60/s),
   * donc ultra-court et sec (onde carrée ~22ms) pour ne pas baver. Le pitch MONTE légèrement
   * avec la progression (prog 0→1) → la récompense « grimpe » jusqu'au ding final.
   */
  const playCountTick = useCallback((prog = 0) => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Glissando discret sur une plage restreinte (reste « pièce », pas mélodie), une octave
    // plus bas qu'avant pour un timbre plus doux/rond : ~B4 → ~E5.
    const f = 494 + prog * 165;
    // Le volume MONTE légèrement vers la fin → accélération-récompense audible avant le ding.
    const vol = 0.040 + prog * 0.030;
    // Onde TRIANGLE (plus douce que la carrée, moins criarde). Court car il y en a beaucoup.
    tone(ctx, dest, f, 0.024, "triangle", vol);
  }, [cd]);

  /**
   * Count-up terminé — petit « ding » de clôture quand le verre est vide et que
   * « vert × orange » revient. Récompense brève et satisfaisante, sans voler la vedette.
   */
  const playCountFinish = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    // Tierce montante C5→E5 + corps → petit accord de résolution (octave plus bas qu'avant,
    // pour rester dans le registre doux du « brrr » des pièces).
    detuned(ctx, dest, 523.25, 10, 0.18, "sine", 0.11, 0);
    detuned(ctx, dest, 659.25, 10, 0.20, "sine", 0.10, 0.03);
    fm(ctx, dest, 523.25, 2, 0.7, 0.20, 0.02);
    tone(ctx, dest, 196.0, 0.11, "sine", 0.09, 0, 150);  // sub léger pour le « poids »
    noise(ctx, dest, 0.03, 0.020, 1600, 0.02, 1.6);      // étincelle discrète, moins sifflante
  }, [cd]);

  /**
   * Saisie de l'aigle — froissement de plumes avec ton doux.
   */
  const playGrab = useCallback(() => {
    const r = cd(); if (!r) return;
    const { ctx, dest } = r;
    noise(ctx, dest, 0.025, 0.065, 720, 0, 0.6);
    tone(ctx, dest, 440, 0.030, "sine", 0.048, 0.008, 600);
  }, [cd]);

  return {
    playPegHit,
    playPegReveal,
    playOrangePegHit,
    playBumperHit,
    playComboTier,
    playWallBounce,
    playBucketCatch,
    playJackpot,
    playClearBoard,
    playLevelClear,
    playPegClear,
    playGameOver,
    playGameOverStinger,
    playMenuHover,
    playMenuClick,
    playMenuReveal,
    playTitleImpact,
    playEagleCryShort,
    playEagleCryLong,
    playUpgradeReveal,
    playUpgradeHover,
    playUpgradePick,
    playUpgradeSkip,
    playGrab,
    playFirework,
    playCountTick,
    playCountFinish,
  };
}
