// ─── DMD · Easings ───────────────────────────────────────────────────────────
// Bibliothèque d'interpolations réutilisables par le moteur de timeline (tween.ts).
// Toutes prennent x ∈ [0,1] et renvoient la valeur eased (peut dépasser [0,1] pour
// les courbes « back » / « elastic »). Pures, sans état.

export type Easing = (x: number) => number;

export const linear: Easing = (x) => x;

export const inQuad: Easing = (x) => x * x;
export const outQuad: Easing = (x) => 1 - (1 - x) * (1 - x);
export const inOutQuad: Easing = (x) =>
  x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

export const inCubic: Easing = (x) => x * x * x;
export const outCubic: Easing = (x) => 1 - Math.pow(1 - x, 3);
export const inOutCubic: Easing = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export const inExpo: Easing = (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10));
export const outExpo: Easing = (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));

// « Back » : dépasse légèrement avant de revenir (overshoot). c1 règle la force.
export function outBack(c1 = 1.70158): Easing {
  const c3 = c1 + 1;
  return (x) => {
    const p = x - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  };
}
export function inBack(c1 = 1.70158): Easing {
  const c3 = c1 + 1;
  return (x) => c3 * x * x * x - c1 * x * x;
}

// « Elastic » : ressort qui oscille en amortissant — idéal pour les pops juicy.
export const outElastic: Easing = (x) => {
  if (x === 0 || x === 1) return x;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
};

// « Bounce » : rebonds successifs amortis (chutes, atterrissages).
export const outBounce: Easing = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
  if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
  x -= 2.625 / d1;
  return n1 * x * x + 0.984375;
};

// Pinball « step » : créneau à fréquence donnée (clignotement net, pas de fondu).
// Renvoie 1 sur le plateau haut, `floor` au creux. `hz` = cycles par seconde si
// `x` est du temps en secondes — ici utilisé surtout via les effects (cf. blink).
export function square(floor = 0): Easing {
  return (x) => (Math.sin(x * Math.PI * 2) > -0.4 ? 1 : floor);
}

// Résolution paresseuse d'un easing par nom (pour les scènes data-driven).
export type EasingName =
  | "linear" | "inQuad" | "outQuad" | "inOutQuad"
  | "inCubic" | "outCubic" | "inOutCubic"
  | "inExpo" | "outExpo" | "outBack" | "inBack"
  | "outElastic" | "outBounce";

const TABLE: Record<EasingName, Easing> = {
  linear, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic,
  inExpo, outExpo, outBack: outBack(), inBack: inBack(), outElastic, outBounce,
};

export function resolveEasing(e: Easing | EasingName | undefined): Easing {
  if (!e) return linear;
  return typeof e === "function" ? e : (TABLE[e] ?? linear);
}
