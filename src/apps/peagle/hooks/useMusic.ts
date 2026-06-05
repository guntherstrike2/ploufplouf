"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getChannel } from "@/lib/audio/channel";
import { getContext } from "@/lib/audio/engine";
import { AudioPlayer } from "@/lib/audio/player";
import { useSoundContext } from "@/lib/contexts/sound-context";

// Survit aux remounts React — permet de killer la source précédente avant d'en créer une nouvelle
let _player: AudioPlayer | null = null;
let _analyser: AnalyserNode | null = null;
let _freqData: Uint8Array | null = null;

// ─── État de l'analyse multi-bandes (persiste entre frames) ───────────────────
const NB_BARS = 22; // nombre de barres de l'equalizer renvoyées chaque frame
const _spectrum = new Float32Array(NB_BARS);
let _prevKickE = 0, _prevMidE = 0, _prevTrebE = 0; // énergie band précédente (flux)
let _kickP = 0, _midP = 0, _trebP = 0;             // pulses d'onset lissés [0..1]
let _bassP = 0, _levelP = 0;                        // énergies soutenues lissées [0..1]

const MENU_TRACK  = "/sounds/peagle-theme.mp3";
const GAME_TRACK  = "/sounds/peagle-track1.mp3";
const CLUTCH_TRACK = "/sounds/fever-track.mp3";
const FADE = 0.35;
const CLUTCH_FADE = 0.18; // transition plus courte pour l'effet "coup de théâtre"

// Décomposition fréquentielle de la musique — appelée chaque frame par TitleCanvas.
// Chaque élément de l'écran-titre réagit à une bande différente : le titre rebondit
// sur le KICK, la forêt/lune respirent sur la BASSE, le badge dodeline sur les MÉDIUMS,
// les étoiles flashent sur les AIGUS, et un equalizer pulse à l'horizon (spectre brut).
export interface BeatBands {
  /** Onset sub-basse (~0–170 Hz) — le « boum » du kick, percutant. */
  kick: number;
  /** Énergie basse soutenue (~170–520 Hz) — groove de fond, fait « respirer » la scène. */
  bass: number;
  /** Onset médium (~520 Hz–1.9 kHz) — caisse claire / synthés, dodeline le badge. */
  mid: number;
  /** Onset aigu (~1.9–9 kHz) — charley / cymbales, fait scintiller étoiles & étincelles. */
  treble: number;
  /** RMS plein spectre lissé — intensité globale (vignette, glow ambiant). */
  level: number;
  /** Spectre log-compressé en NB_BARS barres [0..1] — pour l'equalizer décoratif. */
  spectrum: Float32Array;
}

const _bands: BeatBands = { kick: 0, bass: 0, mid: 0, treble: 0, level: 0, spectrum: _spectrum };

/** RMS d'une plage de bins [from, to) normalisé [0..1]. */
function bandRms(data: Uint8Array, from: number, to: number): number {
  const lo = Math.max(0, Math.floor(from));
  const hi = Math.min(data.length, Math.ceil(to));
  if (hi <= lo) return 0;
  let s = 0;
  for (let i = lo; i < hi; i++) { const v = data[i]! / 255; s += v * v; }
  return Math.sqrt(s / (hi - lo));
}

/** Enveloppe d'onset : attaque vive si l'énergie monte, déclin rapide sinon. */
function onsetEnv(prev: number, flux: number, attack: number, decay: number): number {
  const onset = flux * 7; // amplifie le flux pour un pulse net même sur un mix doux
  return onset > prev ? prev + (onset - prev) * attack : prev * decay;
}

export function getMenuBeat(): BeatBands {
  if (!_analyser || !_freqData) {
    // Pas de musique : tout retombe doucement vers 0 (pas de figement brutal)
    _kickP *= 0.8; _midP *= 0.8; _trebP *= 0.8; _bassP *= 0.8; _levelP *= 0.8;
    for (let b = 0; b < NB_BARS; b++) _spectrum[b]! *= 0.8;
    _bands.kick = _kickP; _bands.bass = _bassP; _bands.mid = _midP;
    _bands.treble = _trebP; _bands.level = _levelP;
    return _bands;
  }
  _analyser.getByteFrequencyData(_freqData as Uint8Array<ArrayBuffer>);
  const data = _freqData;
  const bins = _analyser.frequencyBinCount; // 256 avec fftSize=512 (~86 Hz/bin à 44.1 kHz)

  // ── Énergies par bande (fractions des bins) ──────────────────────────────────
  const kickE = bandRms(data, 0, bins * 0.02);            // ~0–170 Hz
  const bassE = bandRms(data, bins * 0.02, bins * 0.06);  // ~170–520 Hz
  const midE  = bandRms(data, bins * 0.06, bins * 0.22);  // ~520 Hz–1.9 kHz
  const trebE = bandRms(data, bins * 0.22, bins * 0.75);  // ~1.9–9 kHz
  const level = bandRms(data, 0, bins * 0.75);

  // ── Onsets (kick / mid / treble) via flux spectral positif ───────────────────
  _kickP = onsetEnv(_kickP, Math.max(0, kickE - _prevKickE), 0.85, 0.74); _prevKickE = kickE;
  _midP  = onsetEnv(_midP,  Math.max(0, midE  - _prevMidE),  0.82, 0.76); _prevMidE  = midE;
  _trebP = onsetEnv(_trebP, Math.max(0, trebE - _prevTrebE), 0.78, 0.62); _prevTrebE = trebE;

  // ── Énergies soutenues (basse + niveau global) : lissage exponentiel ─────────
  _bassP  += (Math.min(1, bassE * 1.7) - _bassP) * 0.22;
  _levelP += (Math.min(1, level * 1.4) - _levelP) * 0.16;

  // ── Spectre log-compressé pour l'equalizer ───────────────────────────────────
  const specMax = bins * 0.72;
  for (let b = 0; b < NB_BARS; b++) {
    const i0 = Math.pow(b / NB_BARS, 1.8) * specMax;
    const i1 = Math.pow((b + 1) / NB_BARS, 1.8) * specMax;
    const e = Math.min(1, bandRms(data, i0, Math.max(i0 + 1, i1)) * 1.5);
    // Montée rapide, descente lente → barres qui « tombent » comme un vrai EQ
    _spectrum[b] = e > _spectrum[b]! ? e : _spectrum[b]! + (e - _spectrum[b]!) * 0.3;
  }

  _bands.kick = Math.min(1, _kickP);
  _bands.bass = _bassP;
  _bands.mid = Math.min(1, _midP);
  _bands.treble = Math.min(1, _trebP);
  _bands.level = _levelP;
  return _bands;
}

export function useMusic(enabled = false) {
  const { init } = useSoundContext();
  const [musicMuted, setMusicMuted] = useState(false);
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    init();
    const channel = getChannel("peagle-music");
    channel.setVolume(1);
    _player?.stop();
    _player = new AudioPlayer(channel);
    _player.play(MENU_TRACK, { loop: true });

    // Tap analyser sur le channel (ne perturbe pas le signal → branché en parallèle)
    _analyser?.disconnect();
    const audioCtx = getContext();
    _analyser = audioCtx.createAnalyser();
    _analyser.fftSize = 512;
    _analyser.smoothingTimeConstant = 0;
    _freqData = new Uint8Array(_analyser.frequencyBinCount);
    channel.gain.connect(_analyser);
    // L'output de l'analyser reste déconnecté — il est utilisé uniquement pour la lecture

    return () => {
      if (crossfadeTimerRef.current !== null) clearTimeout(crossfadeTimerRef.current);
      _player?.stop();
      _player = null;
      _analyser?.disconnect();
      _analyser = null;
      _freqData = null;
      _prevKickE = _prevMidE = _prevTrebE = 0;
      _kickP = _midP = _trebP = _bassP = _levelP = 0;
      _spectrum.fill(0);
    };
  }, [init, enabled]);

  const crossfadeTo = useCallback((track: string, fadeTime = FADE) => {
    if (musicMuted) return;
    const channel = getChannel("peagle-music");
    channel.fadeOut(fadeTime);
    if (crossfadeTimerRef.current !== null) clearTimeout(crossfadeTimerRef.current);
    crossfadeTimerRef.current = setTimeout(() => {
      crossfadeTimerRef.current = null;
      channel.setVolume(0);
      _player?.play(track, { loop: true });
      channel.fadeIn(fadeTime);
    }, fadeTime * 1000 + 50);
  }, [musicMuted]);

  const fadeOutAndRestart  = useCallback(() => crossfadeTo(MENU_TRACK), [crossfadeTo]);
  const fadeToGameTrack    = useCallback(() => crossfadeTo(GAME_TRACK), [crossfadeTo]);
  const fadeToClutchTrack   = useCallback(() => crossfadeTo(CLUTCH_TRACK, CLUTCH_FADE), [crossfadeTo]);

  const toggleMusic = useCallback(() => {
    setMusicMuted(prev => {
      const next = !prev;
      getChannel("peagle-music").fadeTo(next ? 0 : 1, 0.25);
      return next;
    });
  }, []);

  return { musicMuted, toggleMusic, fadeOutAndRestart, fadeToGameTrack, fadeToClutchTrack, getBeat: getMenuBeat };
}
