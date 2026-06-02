"use client";

import { useCallback, useEffect, useState } from "react";
import { getChannel } from "@/lib/audio/channel";
import { getContext } from "@/lib/audio/engine";
import { AudioPlayer } from "@/lib/audio/player";
import { useSoundContext } from "@/lib/contexts/sound-context";

// Survit aux remounts React — permet de killer la source précédente avant d'en créer une nouvelle
let _player: AudioPlayer | null = null;
let _analyser: AnalyserNode | null = null;
let _freqData: Uint8Array | null = null;
let _prevEnergy = 0; // énergie du frame précédent (pour le flux spectral)
let _beatPulse = 0;  // sortie lissée [0..1]

const MENU_TRACK  = "/sounds/peagle-theme.mp3";
const GAME_TRACK  = "/sounds/peagle-track1.mp3";
const FEVER_TRACK = "/sounds/fever-track.mp3";
const FADE = 0.35;
const FEVER_FADE = 0.18; // transition plus courte pour l'effet "coup de théâtre"

// Détection de beat par flux spectral — appelé chaque frame depuis TitleCanvas.
//
// Principe : au lieu de lire l'énergie brute (qui reste élevée sur une note tenue),
// on calcule la DIFFÉRENCE positive entre frames consécutives. Seuls les transitoires
// (kick, onset de note, attaque) créent un flux positif → les notes tenues sont ignorées.
// Résultat : une valeur [0..1] qui pulse sur chaque beat réel, zéro entre les beats.
export function getMenuBeat(): number {
  if (!_analyser || !_freqData) return 0;
  _analyser.getByteFrequencyData(_freqData as Uint8Array<ArrayBuffer>);

  const bins = _analyser.frequencyBinCount; // 256 avec fftSize=512

  // Bande 1 — kick / sub-basse (~0–260 Hz) : premiers 3% des bins
  const bassN = Math.max(3, Math.floor(bins * 0.03));
  let bassRms = 0;
  for (let i = 0; i < bassN; i++) bassRms += (_freqData[i]! / 255) ** 2;
  bassRms = Math.sqrt(bassRms / bassN);

  // Bande 2 — basse / synthés bas (~260–860 Hz) : bins 3%–10%
  const midN = Math.max(bassN + 2, Math.floor(bins * 0.10));
  let midRms = 0;
  for (let i = bassN; i < midN; i++) midRms += (_freqData[i]! / 255) ** 2;
  midRms = Math.sqrt(midRms / (midN - bassN));

  // Énergie combinée (basse dominante pour les grooves kick)
  const energy = bassRms * 0.72 + midRms * 0.28;

  // Flux spectral : seule la montée d'énergie compte (= onset / transitoire)
  const flux = Math.max(0, energy - _prevEnergy);
  _prevEnergy = energy;

  // Amplification du flux → amplitude de beat nette même sur un mix peu saturé
  const onset = flux * 6;

  // Attaque ultra-rapide, déclin rapide (~2–3 frames à 60fps = ~40ms half-life)
  // → grooves percutants, retombe à 0 entre les beats
  if (onset > _beatPulse) {
    _beatPulse += (onset - _beatPulse) * 0.85;
  } else {
    _beatPulse *= 0.76;
  }

  return Math.min(1, _beatPulse);
}

export function useMusic(enabled = false) {
  const { init } = useSoundContext();
  const [musicMuted, setMusicMuted] = useState(false);

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
      _player?.stop();
      _player = null;
      _analyser?.disconnect();
      _analyser = null;
      _freqData = null;
      _prevEnergy = 0;
      _beatPulse = 0;
    };
  }, [init, enabled]);

  const crossfadeTo = useCallback((track: string, fadeTime = FADE) => {
    if (musicMuted) return;
    const channel = getChannel("peagle-music");
    channel.fadeOut(fadeTime);
    setTimeout(() => {
      channel.setVolume(0);
      _player?.play(track, { loop: true });
      channel.fadeIn(fadeTime);
    }, fadeTime * 1000 + 50);
  }, [musicMuted]);

  const fadeOutAndRestart  = useCallback(() => crossfadeTo(MENU_TRACK), [crossfadeTo]);
  const fadeToGameTrack    = useCallback(() => crossfadeTo(GAME_TRACK), [crossfadeTo]);
  const fadeToFeverTrack   = useCallback(() => crossfadeTo(FEVER_TRACK, FEVER_FADE), [crossfadeTo]);

  const toggleMusic = useCallback(() => {
    setMusicMuted(prev => {
      const next = !prev;
      getChannel("peagle-music").fadeTo(next ? 0 : 1, 0.25);
      return next;
    });
  }, []);

  return { musicMuted, toggleMusic, fadeOutAndRestart, fadeToGameTrack, fadeToFeverTrack, getBeat: getMenuBeat };
}
