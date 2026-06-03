import type { GameState } from "../engine/types";

// ─── Mascotte façon DOOM — tête d'aigle de face réactive ──────────────────────
// Partagée entre le HUD (top-left) et l'aigle lanceur.

export const FACE = {
  head: "#f0e8d0", headHi: "#ffffff", headLo: "#cdbf9a", headLo2: "#a89c76",
  brow: "#8f7d52",
  beak: "#ffcc33", beakHi: "#ffe488", beakLo: "#d99a12", beakTip: "#a6760a",
  mouth: "#3a1d0a", tongue: "#d2563a",
  iris: "#f6d77a", irisRed: "#ff4433", pupil: "#141414", pupilRed: "#7a0d06",
  nape: "#6e4420", napeLo: "#452910",
  drop: "#9fd4ff",
} as const;

export interface FaceMood {
  blink: boolean;
  open: number;                      // 0..1 ouverture du bec
  brow: "flat" | "angry" | "up";    // sourcils : neutre / féroce / inquiet
  eyeRed: boolean;                   // yeux rouges (fever)
  wide: boolean;                     // yeux écarquillés (impact / surprise)
  look: number;                      // -1..1 décalage pupille (regard idle)
  pop: number;                       // 0..1 pulse d'échelle à l'impact
}

// Tête centrée sur (cx, cy). Boîte ≈ 28×32 px (de -14 à +14 en x, -16 à +16 en y).
export function eagleFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, m: FaceMood): void {
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  const scale = 1 + 0.14 * m.pop;
  if (scale !== 1) ctx.scale(scale, scale);

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
  };

  // épaules brunes (derrière la tête)
  px(-14, 7, 6, 9, FACE.nape);  px(-14, 7, 6, 1, "#8a5a2c");
  px(8, 7, 6, 9, FACE.nape);    px(8, 7, 6, 1, "#8a5a2c");
  px(-14, 14, 6, 2, FACE.napeLo); px(8, 14, 6, 2, FACE.napeLo);

  // dôme de la tête
  px(-6, -16, 12, 3, FACE.head);
  px(-9, -13, 18, 3, FACE.head);
  px(-12, -10, 24, 18, FACE.head);
  px(-10, 8, 20, 4, FACE.head);
  px(-7, 12, 14, 2, FACE.head);
  px(-6, -16, 12, 1, FACE.headHi);
  px(-12, -10, 1, 18, FACE.headHi);
  px(11, -10, 1, 18, FACE.headLo);
  px(-9, 11, 17, 1, FACE.headLo);
  px(-6, 13, 12, 1, FACE.headLo2);

  // sourcils / expression
  if (m.brow === "angry") {
    px(-11, -9, 4, 2, FACE.brow); px(-8, -7, 4, 2, FACE.brow);
    px(7, -9, 4, 2, FACE.brow);   px(4, -7, 4, 2, FACE.brow);
  } else if (m.brow === "up") {
    px(-11, -7, 4, 2, FACE.brow); px(-8, -9, 4, 2, FACE.brow);
    px(7, -7, 4, 2, FACE.brow);   px(4, -9, 4, 2, FACE.brow);
  } else {
    px(-11, -8, 5, 2, FACE.brow); px(6, -8, 5, 2, FACE.brow);
  }

  // yeux
  for (const sgn of [-1, 1]) {
    const ex = sgn * 7;
    if (m.blink) {
      px(ex - 3, -3, 6, 1, FACE.headLo2);
      continue;
    }
    const irisH = m.wide ? 7 : 5;
    const irisY = m.wide ? -5 : -4;
    px(ex - 3, irisY, 6, irisH, m.eyeRed ? FACE.irisRed : FACE.iris);
    px(ex - 3, irisY, 6, 1, "rgba(0,0,0,0.35)");
    const lk = Math.round(m.look);
    px(ex - 1 + lk, irisY + 1, 2, 3, m.eyeRed ? FACE.pupilRed : FACE.pupil);
    px(ex - 1 + lk, irisY + 1, 1, 1, FACE.headHi);
  }

  // bec supérieur
  px(-4, -1, 8, 2, FACE.beak);
  px(-3, 1, 6, 2, FACE.beak);
  px(-2, 3, 4, 1, FACE.beak);
  px(-4, -1, 1, 4, FACE.beakHi);
  px(3, -1, 1, 4, FACE.beakLo);
  px(-2, 0, 1, 1, FACE.beakTip);

  // mandibule inférieure
  const d = Math.round(m.open * 5);
  const ly = 4 + d;
  if (d > 0) {
    px(-3, 4, 6, d, FACE.mouth);
    px(-1, 4, 2, d, FACE.tongue);
  }
  px(-2, ly, 4, 2, FACE.beakLo);
  px(-2, ly, 4, 1, FACE.beak);
  px(-1, ly + 2, 2, 1, FACE.beakTip);

  // goutte d'inquiétude
  if (m.brow === "up") {
    px(10, -11, 2, 3, FACE.drop);
    px(10, -8, 1, 1, FACE.drop);
    px(10, -11, 1, 1, FACE.headHi);
  }

  ctx.restore();
}

// Dérive l'expression depuis l'état de jeu courant.
export function getFaceMood(s: GameState): FaceMood {
  const inClutch = s.balls > 0 && s.balls <= s.effectiveClutchThreshold;
  const lowBalls = s.balls > 0 && s.balls <= 2;
  const pulse = 0.5 + 0.5 * Math.sin(s.animClock * 6);
  const hitMag = s.hitFreezeFrames;
  const justHit = hitMag > 0;
  const burst = hitMag >= 8;
  return {
    blink: !justHit && !inClutch && (s.animClock % 3.2) < 0.12,
    open: inClutch ? 0.45 + 0.4 * pulse : justHit ? (burst ? 1 : 0.55) : 0,
    brow: inClutch ? "angry" : burst ? "angry" : lowBalls ? "up" : "flat",
    eyeRed: inClutch,
    wide: justHit,
    look: justHit || inClutch ? 0 : Math.sin(s.animClock * 0.6) * 1.2,
    pop: Math.min(1, hitMag / 9),
  };
}
