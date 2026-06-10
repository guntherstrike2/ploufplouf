// ─── DMD · Tween / Timeline ──────────────────────────────────────────────────
//
// La COUCHE 3 (« temps ») du moteur. Une `Timeline` est un sac de PISTES nommées ;
// chaque piste interpole une valeur dans le temps via des KEYFRAMES + easing. On lit
// la valeur d'une piste à un instant `t` (∈ [0,1], progression dans la scène) avec
// `tl.value("name")`. Plus aucune scène ne recode son timing à la main avec des
// Math.floor / paliers : elle DÉCLARE ses pistes.
//
//   const tl = timeline()
//     .track("eggFrame", [kf(0, 0), kf(0.78, 5, "linear")])
//     .track("wordX",    [kf(0.2, -10), kf(0.4, 0, "outBack")])
//     .track("flash",    [kf(0, 1), kf(1, 0, "outQuad")]);
//   tl.seek(t);
//   const f = tl.value("eggFrame");   // frame œuf interpolée à l'instant courant
//
// Les valeurs sont des nombres (positions, intensités, indices de frame…). Pour un
// indice de frame discret, lire puis Math.round/Math.floor côté appelant.

import { resolveEasing, type Easing, type EasingName } from "./easing";

// Un keyframe : à la position `at` (0..1 dans la scène), la piste vaut `v`. L'easing
// gouverne le segment QUI MÈNE à ce keyframe (depuis le précédent).
export interface Keyframe {
  at: number;
  v: number;
  ease: Easing;
}

export function kf(at: number, v: number, ease?: Easing | EasingName): Keyframe {
  return { at, v, ease: resolveEasing(ease) };
}

interface Track {
  keys: Keyframe[];   // triés par `at` croissant
}

export class Timeline {
  private tracks = new Map<string, Track>();
  private t = 0;   // position courante 0..1

  // Déclare une piste. Les keyframes sont triées par sécurité (l'ordre d'écriture
  // n'a pas à être strict). Renvoie `this` pour le chaînage.
  track(name: string, keys: Keyframe[]): this {
    const sorted = [...keys].sort((a, b) => a.at - b.at);
    this.tracks.set(name, { keys: sorted });
    return this;
  }

  // Positionne la timeline à l'instant `t` (clampé 0..1).
  seek(t: number): this {
    this.t = t < 0 ? 0 : t > 1 ? 1 : t;
    return this;
  }

  // Valeur interpolée d'une piste à l'instant courant. `fallback` si la piste
  // n'existe pas ou est vide. Avant le 1er keyframe → valeur du 1er ; après le
  // dernier → valeur du dernier (hold aux extrémités).
  value(name: string, fallback = 0): number {
    const tr = this.tracks.get(name);
    if (!tr || tr.keys.length === 0) return fallback;
    const { keys } = tr;
    const t = this.t;
    if (t <= keys[0]!.at) return keys[0]!.v;
    const last = keys[keys.length - 1]!;
    if (t >= last.at) return last.v;
    // Segment [a,b] contenant t.
    for (let i = 1; i < keys.length; i++) {
      const b = keys[i]!;
      if (t <= b.at) {
        const a = keys[i - 1]!;
        const span = b.at - a.at;
        const local = span <= 0 ? 1 : (t - a.at) / span;
        return a.v + (b.v - a.v) * b.ease(local);
      }
    }
    return last.v;
  }

  // Position brute courante (utile pour les hooks custom qui veulent le `t` global).
  get pos(): number {
    return this.t;
  }
}

export function timeline(): Timeline {
  return new Timeline();
}
