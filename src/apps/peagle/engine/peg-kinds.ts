// ─── Types de pegs (data-driven) ────────────────────────────────────────────
// ⭐ POINT D'EXTENSION : pour ajouter un nouvel objet (bombe, peg vert, armure,
// warp…), ajoute un id à PegKind PUIS une entrée dans PEG_KINDS. La collision
// (state/ball.ts) lit cette table — pas de chaîne de `if (p.orange)`. Le seul
// code à toucher en plus est le RENDU (renderer/pegs.ts) et, si l'objet a un
// effet vraiment spécial (donner un œuf, exploser en chaîne…), une petite
// branche keyée par `kind` dans ball.ts.
//
// Trois familles décrites par les flags :
//   • cible destructible  → destructible:true,  isTarget:true   (orange)
//   • peg bonus destructible → destructible:true, isTarget:false (normal)
//   • obstacle permanent  → destructible:false                  (bumper)

import {
  HIT_FREEZE_NORMAL, HIT_FREEZE_ORANGE,
} from "./constants";
import { BALANCE } from "./balance";
import type { SoundId } from "./events";

export type PegKind = "normal" | "orange" | "bumper";

export interface PegKindDef {
  /** Le peg disparaît quand on le touche (cible/bonus). false = obstacle permanent. */
  destructible: boolean;
  /** Compte dans la condition de victoire (toutes les cibles détruites). */
  isTarget: boolean;
  /** Multiplie le rebond effectif (restitution) lors de la collision. */
  bounceMult: number;
  /** Vitesse ajoutée le long de la normale au contact (px/frame). Le « kick » d'un bumper. */
  impulse: number;
  /** Points de base, avant multiplicateurs de combo / run. */
  baseScore: number;
  /** Frames de hit-freeze déclenchées à l'impact. */
  freezeFrames: number;
  /** Trauma (screenshake) ajouté. */
  trauma: number;
  /** Flash blanc ajouté (0..1). */
  flash: number;
  /** Nombre de particules crachées à l'impact. */
  particles: number;
  /** Particules « chaudes » (palette cible orange) vs froides (normal). */
  hotParticles: boolean;
  /** Son joué à l'impact. */
  sound: SoundId;
  /** Obstacle permanent uniquement : frames avant de pouvoir le re-toucher. */
  cooldownFrames: number;
}

export const PEG_KINDS: Record<PegKind, PegKindDef> = {
  normal: {
    destructible: true,
    isTarget: false,
    bounceMult: 1,
    impulse: 0,
    baseScore: BALANCE.score.normalBase,
    freezeFrames: HIT_FREEZE_NORMAL,
    trauma: BALANCE.trauma.normalPeg,
    flash: 0,
    particles: 8,
    hotParticles: false,
    sound: "peg-hit",
    cooldownFrames: 0,
  },
  orange: {
    destructible: true,
    isTarget: true,
    bounceMult: 1,
    impulse: 0,
    baseScore: BALANCE.score.orangeBase,
    freezeFrames: HIT_FREEZE_ORANGE,
    trauma: BALANCE.trauma.orangePeg,
    flash: BALANCE.flash.orangePeg,
    particles: 20,
    hotParticles: true,
    sound: "orange-hit",
    cooldownFrames: 0,
  },
  bumper: {
    destructible: false,
    isTarget: false,
    bounceMult: 1.6,
    impulse: 8.0,
    baseScore: 75,
    freezeFrames: 7,
    trauma: 0.22,
    flash: 0.12,
    particles: 22,
    hotParticles: true,
    sound: "bumper-hit",
    cooldownFrames: 5,
  },
};

/** Définition d'un peg. */
export const kindDef = (kind: PegKind): PegKindDef => PEG_KINDS[kind];

/** Le peg compte-t-il dans la condition de victoire ? */
export const isTarget = (p: { kind: PegKind }): boolean => PEG_KINDS[p.kind].isTarget;
