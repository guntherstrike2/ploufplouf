// ─── DMD · Screen + Director (API haut-niveau) ───────────────────────────────
//
// Le point d'entrée du moteur côté HUD. `DmdScreen` encapsule un verre : sa
// géométrie de grille, son buffer persistant, son encre, et un `SceneDirector` qui
// joue les scènes (priorité, transition, sortie). Le HUD :
//   1. crée/réutilise un DmdScreen pour une zone (x,y,w,h) ;
//   2. pousse des scènes via `director.play(name, def)` sur fronts montants ;
//   3. appelle `screen.render(ctx, idle)` chaque frame — `idle` dessine le contenu
//      au repos (aigle + score) quand aucune scène ne joue.
//
// Tout le rendu de dots (afterglow, bloom, bruit) vit dans raster.ts ; ici on
// orchestre temps + composition + transitions.

import {
  DotBuffer, DmdGeom, DmdInk, getBuffer, blitGrid, composite, markComposited, decayUntouched,
  DMD_AMBER, DMD_HOT, DMD_BLUE, DMD_ORANGE, DMD_GOLD,
} from "./raster";
import {
  SceneDef, InkName, Band, SceneApi,
  DMD_ROWS_TOTAL, bandRow0, bandRows, stampLayers, sceneInks,
  applyTransitionClip,
} from "./scene";
import { timeline, Timeline } from "./tween";
import { type EffectCtx } from "./effects";
import { GLYPH_ROWS } from "./font";

export { DMD_ROWS_TOTAL };

// Résout un nom d'encre symbolique vers le DmdInk concret (base = encre du verre).
function inkFor(name: InkName, base: DmdInk, hot: boolean): DmdInk {
  switch (name) {
    case "hot": return DMD_HOT;
    case "blue": return DMD_BLUE;
    case "orange": return DMD_ORANGE;
    case "gold": return DMD_GOLD;
    default: return hot ? DMD_HOT : base;
  }
}

// ── Instance de scène en cours de lecture ────────────────────────────────────
interface ActiveScene {
  name: string;
  def: SceneDef;
  prio: number;
  tl: Timeline;
  t: number;       // 0→1 progression de JEU
  trans: number;   // 0→1 transition d'ENTRÉE
  out: number;     // 0→1 fondu de SORTIE
}

const TRANS_FRAMES = 6;
const OUT_FRAMES = 6;

// ── SceneDirector ────────────────────────────────────────────────────────────
// Gère la file/priorité des scènes pour UN verre. Une scène plus prioritaire
// interrompt la courante. `play` est idempotent par front (à l'appelant de ne le
// pousser que sur front montant).
export class SceneDirector {
  private active: ActiveScene | null = null;

  get current(): string | null {
    return this.active?.name ?? null;
  }
  get isIdle(): boolean {
    return this.active === null;
  }
  get isFullTakeover(): boolean {
    return this.active?.def.fullTakeover ?? false;
  }

  // Ouvre une scène (sauf si une scène strictement prioritaire joue encore et n'est
  // pas en train de sortir).
  play(name: string, def: SceneDef, prio: number): void {
    if (this.active && prio < this.active.prio && this.active.out === 0) return;
    const tl = timeline();
    def.build?.(tl);
    this.active = { name, def, prio, tl, t: 0, trans: 0, out: 0 };
  }

  // Force le retour à l'idle (reset de tour/niveau).
  reset(): void {
    this.active = null;
  }

  // Avance le temps d'une frame. Renvoie false quand la scène s'achève (→ idle).
  // `frozen` = la scène reste figée en fin de jeu (game over).
  private advance(frozen: boolean): void {
    const a = this.active;
    if (!a) return;
    if (a.trans < 1) a.trans = Math.min(1, a.trans + 1 / TRANS_FRAMES);
    else if (a.t < 1) a.t = Math.min(1, a.t + 1 / a.def.dur);
    else if (frozen) { /* figé */ }
    else if (a.out < 1) a.out = Math.min(1, a.out + 1 / OUT_FRAMES);
    else this.active = null;
  }

  // Rend la scène courante dans le buffer/contexte. Renvoie l'alpha de sortie (pour
  // que l'appelant dessine l'idle DERRIÈRE en cross-fade). null si idle.
  render(
    ctx: CanvasRenderingContext2D, buf: DotBuffer, geom: DmdGeom,
    cols: number, baseInk: DmdInk, globalIntensity: number, phase: number,
    frozenNames: ReadonlySet<string>,
  ): number | null {
    const a = this.active;
    if (!a) return null;
    const frozen = frozenNames.has(a.name) && a.t >= 1;
    this.advance(frozen);

    const def = a.def;
    const hot = def.hot ?? false;
    const effCtx: EffectCtx = { now: phase * 0.7, t: a.t };   // phase≈now/0.7 → now≈phase*0.7
    const sceneAlpha = globalIntensity * (1 - a.out) * Math.min(1, a.trans);
    const outAlpha = a.out;

    // Transition d'entrée : clip de révélation sur tout le verre.
    ctx.save();
    if (a.trans < 1) {
      applyTransitionClip(ctx, def.transition ?? "wipe", a.trans, {
        x: geom.x, y: geom.y, cols, rows: DMD_ROWS_TOTAL, pitch: geom.pitch,
      });
    }

    // Une passe de composite par encre utilisée par la scène (un buffer = une encre).
    for (const inkName of sceneInks(def)) {
      buf.cur.fill(0);
      if (def.layers) stampLayers(buf, def.layers, cols, a.tl.seek(a.t), effCtx, 1, inkName);
      // hook custom : seulement dans la passe "base" (il stampe librement).
      if (inkName === (def.ink ?? "base") && def.custom) {
        const api: SceneApi = {
          buf, cols, tl: a.tl.seek(a.t), ctx: effCtx, value: sceneAlpha,
          dot: (band: Band, c, r, v) => {
            const i = (bandRow0(band) + r) * buf.cols + c;
            if (c >= 0 && c < buf.cols && r >= 0 && r < bandRows(band) && v > (buf.cur[i] ?? 0)) buf.cur[i] = v;
          },
        };
        def.custom(api);
      }
      const ink = inkFor(inkName, baseInk, hot);
      // La passe scène ne porte pas d'afterglow persistant (persist=false) : le rendu
      // reste net image par image ; l'afterglow est réservé à l'idle/score (mouvant).
      composite(ctx, buf, geom, ink, sceneAlpha, true, phase, false);
    }
    ctx.restore();

    return outAlpha;
  }
}

// ── DmdScreen : un verre complet (caisson + grille + scènes/idle) ─────────────
export interface ScreenLayout {
  geom: DmdGeom;
  cols: number;
  rows: number;           // = DMD_ROWS_TOTAL
  bandTopY: number;       // y px du haut de la bande haute
  bandBotY: number;       // y px du haut de la bande basse
}

// Calcule la géométrie de grille d'un verre pour une zone interne (innerX..innerH).
export function computeLayout(innerX: number, innerY: number, innerW: number, innerH: number): ScreenLayout {
  const pitch = innerH / DMD_ROWS_TOTAL;
  const dotR = pitch * 0.4;
  const cols = Math.max(0, Math.floor(innerW / pitch));
  return {
    geom: { x: innerX, y: innerY, pitch, dotR },
    cols, rows: DMD_ROWS_TOTAL,
    bandTopY: innerY,
    bandBotY: innerY + (GLYPH_ROWS + 1) * pitch,
  };
}

export {
  DMD_AMBER, DMD_HOT, DMD_BLUE, DMD_ORANGE, DMD_GOLD,
  getBuffer, blitGrid, composite, markComposited, decayUntouched,
  type DmdInk, type DmdGeom, type DotBuffer,
};
