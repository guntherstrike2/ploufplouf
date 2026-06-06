"use client";

import { getContext, loadBuffer } from "./engine";
import type { AudioChannel } from "./channel";

interface ActiveSource {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
}

/**
 * Joue un fichier audio (one-shot ou loop) sur un canal donné.
 * Gère le chargement, la lecture, le fade et le stop.
 */
export class AudioPlayer {
  private active: ActiveSource | null = null;
  private channel: AudioChannel;
  private stopToken = 0;

  constructor(channel: AudioChannel) {
    this.channel = channel;
  }

  /** Démarre la lecture. Si déjà en cours, stoppe avant de relancer. */
  async play(url: string, options: { loop?: boolean; volume?: number; offset?: number; fadeIn?: number } = {}): Promise<void> {
    this.stop();
    const token = ++this.stopToken;

    let buffer: AudioBuffer;
    try {
      buffer = await loadBuffer(url);
    } catch {
      return;
    }

    // stop() a été appelé pendant le chargement — on abandonne
    if (token !== this.stopToken) return;

    const ctx = getContext();
    const gainNode = ctx.createGain();
    const targetVol = options.volume ?? 1;
    if (options.fadeIn && options.fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + options.fadeIn);
    } else {
      gainNode.gain.value = targetVol;
    }
    gainNode.connect(this.channel.gain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    source.connect(gainNode);
    source.start(ctx.currentTime, options.offset ?? 0);

    this.active = { source, gainNode };

    if (!options.loop) {
      source.onended = () => {
        if (this.active?.source === source) this.active = null;
      };
    }
  }

  /** Stoppe immédiatement (invalide aussi tout play() en cours de chargement). */
  stop() {
    this.stopToken++;
    if (!this.active) return;
    try { this.active.source.stop(); } catch {}
    this.active = null;
  }

  /** Fade out puis stoppe. */
  fadeOutAndStop(duration = 0.4) {
    if (!this.active) return;
    const { source, gainNode } = this.active;
    this.active = null;

    const ctx = getContext();
    gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    setTimeout(() => { try { source.stop(); } catch {} }, (duration + 0.1) * 1000);
  }

  /** Ajuste le volume en cours de lecture. */
  setVolume(value: number) {
    if (!this.active) return;
    const ctx = getContext();
    this.active.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, value)), ctx.currentTime);
  }

  fadeTo(target: number, duration: number) {
    if (!this.active) return;
    const ctx = getContext();
    const gain = this.active.gainNode.gain;
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setValueAtTime(gain.value, ctx.currentTime);
    gain.linearRampToValueAtTime(Math.max(0, Math.min(1, target)), ctx.currentTime + duration);
  }

  /**
   * Joue une fois, puis appelle `onEnded` si la lecture n'a pas été interrompue.
   * Utile pour chaîner deux sons (ex: boot → run en loop).
   */
  async playOnce(url: string, options: { volume?: number; onEnded?: () => void } = {}): Promise<void> {
    this.stop();
    const token = ++this.stopToken;

    let buffer: AudioBuffer;
    try {
      buffer = await loadBuffer(url);
    } catch {
      return;
    }

    if (token !== this.stopToken) return;

    const ctx = getContext();
    const gainNode = ctx.createGain();
    gainNode.gain.value = options.volume ?? 1;
    gainNode.connect(this.channel.gain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.connect(gainNode);

    this.active = { source, gainNode };

    source.onended = () => {
      if (this.active?.source === source) {
        this.active = null;
        options.onEnded?.();
      }
    };

    source.start(ctx.currentTime);
  }

  get isPlaying() {
    return this.active !== null;
  }
}
