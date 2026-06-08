"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  EAGLE_BODY,
  EAGLE_WING,
  EAGLE_WING_PIVOT,
  EAGLE_WING_ANCHOR,
  getActiveBall,
} from "../engine/assets";
import { BALL_R } from "../engine/constants";
import { RAMP } from "../engine/palette";
import { eagleFace, getFaceMood, titleFaceCtx, type FaceContext, type FaceMood } from "../renderer/face";
import { roundGlowRect } from "../renderer/helpers";
import type { BeatBands } from "../hooks/useMusic";

// ─── Écran-titre animé (canvas) ──────────────────────────────────────────────
// Intro "juicy" : l'aigle débarque en vol (ailes qui battent), puis le titre
// « PEAGLE 98 » tombe lettre par lettre en pixel art avec rebond + flash + shake.
// Après l'intro, tout reste en boucle idle (aigle qui plane, titre qui pulse)
// et `onMenuReveal()` est appelé pour faire apparaître le menu DOM par-dessus.
// L'intro est skippable (clic / touche) → saut direct à l'état final.

// ─── Police pixel 7×9 — glyphes dessinés à la main (lisibles + caractère) ─────
// "." = vide, "1" = corps, "2" = ombre interne (auto-générée si absente)
const GLYPHS: Record<string, string[]> = {
  P: [
    "1111110",
    "1111111",
    "11...11",
    "11...11",
    "1111111",
    "1111110",
    "11.....",
    "11.....",
    "11.....",
  ],
  E: [
    "1111111",
    "1111111",
    "11.....",
    "111111.",
    "111111.",
    "11.....",
    "11.....",
    "1111111",
    "1111111",
  ],
  A: [
    "..111..",
    ".11111.",
    "11...11",
    "11...11",
    "1111111",
    "1111111",
    "11...11",
    "11...11",
    "11...11",
  ],
  G: [
    ".111111",
    "1111111",
    "11.....",
    "11.....",
    "11..111",
    "11..111",
    "11...11",
    "1111111",
    ".11111.",
  ],
  L: [
    "11.....",
    "11.....",
    "11.....",
    "11.....",
    "11.....",
    "11.....",
    "11.....",
    "1111111",
    "1111111",
  ],
  "9": [
    ".11111.",
    "1111111",
    "11...11",
    "1111111",
    ".111111",
    ".....11",
    "....11.",
    "..111..",
    ".11....",
  ],
  "8": [
    ".11111.",
    "1111111",
    "11...11",
    ".11111.",
    ".11111.",
    "11...11",
    "11...11",
    "1111111",
    ".11111.",
  ],
};
const GW = 7;
const GH = 9;

const WORD = "PEAGLE";
const BADGE = "98";

// ─── Palette ──────────────────────────────────────────────────────────────────
// Titre « PEAGLE » en or (RAMP.gold), badge « 98 » en vert (RAMP.green) — dérivés
// de la palette unifiée pour rester en harmonie avec l'UI et le décor.
const C = {
  goldTop: "#fff3b0",        // highlight très clair (au-dessus de gold[100])
  goldMid: RAMP.gold[300],   // or principal
  goldBot: "#f5a623",        // or chaud (entre 300 et 600)
  goldDeep: RAMP.gold[600],  // ombre or
  outline: "#241405",        // contour brun très sombre (encre chaude)
  glow: "#ffcc33",
  badge: RAMP.green[200],    // accent clair
  badgeBot: RAMP.green[500],
  badgeDeep: RAMP.green[700],
};

// ─── Timeline (secondes) ──────────────────────────────────────────────────────
const EAGLE_IN = 1.05;       // durée du vol d'arrivée
const LETTERS_START = 0.7;   // 1re lettre commence à tomber
const LETTER_STAGGER = 0.11; // décalage entre lettres
const LETTER_FALL = 0.5;     // durée de chute d'une lettre
const BADGE_AT = 1.85;       // le "98" pop
const MENU_AT = 2.35;        // révélation du menu

const lastLetterLand = LETTERS_START + (WORD.length - 1) * LETTER_STAGGER + LETTER_FALL;

// ─── Timeline pré-intro ────────────────────────────────────────────────────────
const STUDIO_DUR  = 3.8;                       // "Gunther Studio présente"
const PIGEON_DUR  = 3.8;                       // séquence pigeon
const INTRO_OFFSET = STUDIO_DUR + PIGEON_DUR;  // 6.8 s avant le vrai générique

// Instants (relatifs au début de la phase pigeon) où chaque tête fait coucou.
// Partagé entre le dessin et le déclenchement des petits cris d'aigle.
const PEEK_STARTS = [0.08, 1.70, 3.32] as const;

// ─── Forêt animée — positions précalculées (stables entre renders) ────────────
interface TreeData { nx: number; nh: number; nw: number; swayAmp: number; swaySpeed: number; swayPhase: number; }
interface ForestLayer { yBase: number; col: string; trees: TreeData[]; }
function fhash(s: number): number { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const _forestLayers: ForestLayer[] = (() => {
  const defs = [
    { count: 16, yBase: 0.67, col: "#050e03", minH: 0.11, maxH: 0.19, minW: 0.028, maxW: 0.046, swayMax: 0.020 },
    { count: 11, yBase: 0.79, col: "#030a01", minH: 0.19, maxH: 0.30, minW: 0.038, maxW: 0.063, swayMax: 0.026 },
    { count: 7,  yBase: 0.91, col: "#020501", minH: 0.28, maxH: 0.42, minW: 0.058, maxW: 0.092, swayMax: 0.033 },
  ];
  return defs.map((d, li) => ({
    yBase: d.yBase, col: d.col,
    trees: Array.from({ length: d.count }, (_, i) => {
      const s = li * 100 + i;
      return {
        nx:        (i + 0.5) / d.count + (fhash(s)     - 0.5) * 0.07,
        nh:        d.minH + fhash(s + 1) * (d.maxH - d.minH),
        nw:        d.minW + fhash(s + 2) * (d.maxW - d.minW),
        swayAmp:   d.swayMax * (0.4 + fhash(s + 3) * 0.6),
        swaySpeed: 0.28 + fhash(s + 4) * 0.44,
        swayPhase: fhash(s + 5) * Math.PI * 2,
      };
    }),
  }));
})();

interface StarData { nx: number; ny: number; r: number; speed: number; phase: number; bright: number; col: string; }
const _stars: StarData[] = Array.from({ length: 58 }, (_, i) => {
  const s = i + 300;
  const cols = ["#ffffff", "#e8f0ff", "#fff8e8", "#ffd0c8"] as const;
  return {
    nx:    fhash(s),
    ny:    fhash(s + 1),
    r:     fhash(s + 6) < 0.10 ? 2 : 1,
    speed: 0.5 + fhash(s + 2) * 1.8,
    phase: fhash(s + 3) * Math.PI * 2,
    bright: 0.35 + fhash(s + 4) * 0.65,
    col:   cols[Math.floor(fhash(s + 5) * cols.length)]!,
  };
});

// ─── Sprites de l'aigle pré-rendus (1px = 1 cellule) ──────────────────────────
function buildSprite(grid: readonly string[], palette: Record<string, string>): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cv = document.createElement("canvas");
  cv.width = cols;
  cv.height = rows;
  const c = cv.getContext("2d");
  if (!c) return null;
  for (let r = 0; r < rows; r++) {
    const row = grid[r]!;
    for (let x = 0; x < cols; x++) {
      const ch = row[x]!;
      const col = ch === "." ? null : palette[ch];
      if (col) {
        c.fillStyle = col;
        c.fillRect(x, r, 1, 1);
      }
    }
  }
  return cv;
}

let _body: HTMLCanvasElement | null = null;
let _wing: HTMLCanvasElement | null = null;
function getSprites() {
  _body ??= buildSprite(EAGLE_BODY.grid, EAGLE_BODY.palette);
  _wing ??= buildSprite(EAGLE_WING.grid, EAGLE_WING.palette);
  return { body: _body, wing: _wing };
}

// Sprite de l'œuf — réplique pixel-exact le rendu en partie (renderer/ball.ts),
// avec la skin d'œuf active. Pré-rendu à BALL_R puis scalé sans lissage.
function buildEggSprite(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const style = getActiveBall();
  const br = BALL_R;
  const S = br * 2;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const c = cv.getContext("2d");
  if (!c) return null;
  const bx = br, by = br;

  // Corps principal pixel (carré arrondi — 3 rectangles superposés)
  c.fillStyle = style.body;
  c.fillRect(bx - br + 1, by - br, br * 2 - 2, br * 2);
  c.fillRect(bx - br, by - br + 1, br * 2, br * 2 - 2);
  // Bevel pixel — top/left clairs, bottom/right sombres
  c.fillStyle = "#ffffff";
  c.fillRect(bx - br + 1, by - br, br * 2 - 2, 1);
  c.fillRect(bx - br, by - br + 1, 1, br * 2 - 2);
  c.fillStyle = "rgba(0,0,0,0.55)";
  c.fillRect(bx - br + 1, by + br - 1, br * 2 - 2, 1);
  c.fillRect(bx + br - 1, by - br + 1, 1, br * 2 - 2);
  // Highlight coin
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.fillRect(bx - br + 1, by - br + 1, 2, 1);
  c.fillRect(bx - br + 1, by - br + 1, 1, 2);
  // Mouchetures
  c.fillStyle = style.speckle;
  c.fillRect(bx - 1, by - br + 2, 2, 1);
  c.fillRect(bx + br - 3, by - 1, 1, 2);
  c.fillRect(bx - br + 2, by + 1, 1, 1);
  c.fillRect(bx, by + br - 3, 2, 1);

  return cv;
}

// ─── Pré-rendu du logo en sprite pixel-art ────────────────────────────────────
// Chaque lettre devient un petit canvas où 1px = 1 cellule. On y peint le
// contour, le remplissage dégradé verticalement, un liseré clair en haut
// (highlight) et un liseré sombre en bas (ombre) → vrai look pixel-art bombé.
type LetterSprite = { cv: HTMLCanvasElement; cols: number; rows: number };

// Super-sampling : on rend chaque cellule de glyphe sur une sous-grille SS×SS. Ça
// double la définition du logo et permet un arrondi de coin d'UN sous-pixel (fin,
// au lieu de grignoter un demi-trait à la résolution d'origine). cols/rows exposés
// restent en CELLULES logiques (W/H) → le layout amont est inchangé.
const SS = 2;

function buildLetterSprite(
  glyph: string[],
  fill: { top: string; mid: string; bot: string; deep: string },
): LetterSprite | null {
  if (typeof document === "undefined") return null;
  const rows = glyph.length;
  const cols = glyph[0]!.length;
  // +1 cellule de marge partout pour loger le contour
  const W = cols + 2;
  const H = rows + 2;
  const cv = document.createElement("canvas");
  cv.width = W * SS;
  cv.height = H * SS;
  const c = cv.getContext("2d");
  if (!c) return null;

  const srcOn = (r: number, cc: number) =>
    r >= 0 && r < rows && cc >= 0 && cc < cols && glyph[r]![cc] === "1";

  // ── 1) Sur-échantillonnage + ÉPAISSISSEMENT ───────────────────────────────────
  // Grille fine F[gr][gc] (taille (rows)*SS × (cols)*SS). Une sous-cellule est pleine
  // si sa cellule source l'est (upscale ×SS) OU si une cellule source voisine l'est et
  // qu'on est sur le bord adjacent (dilatation douce → traits plus gras sans empâter).
  const FR = rows * SS, FC = cols * SS;
  const fine: boolean[][] = [];
  for (let gr = 0; gr < FR; gr++) {
    fine[gr] = [];
    for (let gc = 0; gc < FC; gc++) {
      const r = (gr / SS) | 0, cc = (gc / SS) | 0;
      let v = srcOn(r, cc);
      // Épaississement : déborde d'un sous-pixel vers un voisin plein — MAIS jamais
      // dans une contre-forme étroite (creux pincé entre deux pleins), sinon on bouche
      // les creux de 1 cellule (ex. la branche du milieu du E). On ne déborde donc que
      // si le côté OPPOSÉ est vide (vrai bord extérieur, pas un creux interne).
      if (!v) {
        const subR = gr % SS, subC = gc % SS;
        if (subR === 0 && srcOn(r - 1, cc) && !srcOn(r + 1, cc)) v = true;        // ← voisin haut
        else if (subR === SS - 1 && srcOn(r + 1, cc) && !srcOn(r - 1, cc)) v = true; // ← voisin bas
        else if (subC === 0 && srcOn(r, cc - 1) && !srcOn(r, cc + 1)) v = true;   // ← voisin gauche
        else if (subC === SS - 1 && srcOn(r, cc + 1) && !srcOn(r, cc - 1)) v = true; // ← voisin droit
      }
      fine[gr]![gc] = v;
    }
  }

  const onRaw = (gr: number, gc: number) =>
    gr >= 0 && gr < FR && gc >= 0 && gc < FC && fine[gr]![gc] === true;

  // ── 2) Arrondi : rogne le sous-pixel de coin extérieur saillant ────────────────
  const isClipped = (gr: number, gc: number): boolean => {
    if (!onRaw(gr, gc)) return false;
    const top = !onRaw(gr - 1, gc), bot = !onRaw(gr + 1, gc);
    const left = !onRaw(gr, gc - 1), right = !onRaw(gr, gc + 1);
    return (
      (top && left && !bot && !right) ||
      (top && right && !bot && !left) ||
      (bot && left && !top && !right) ||
      (bot && right && !top && !left)
    );
  };
  const on = (gr: number, gc: number) => onRaw(gr, gc) && !isClipped(gr, gc);

  // ── 3) Contour (sous-grille) : sous-cellule vide adjacente (8-voisins) à une pleine
  const off = SS; // marge d'1 cellule = SS sous-pixels
  c.fillStyle = C.outline;
  for (let gr = -1; gr <= FR; gr++) {
    for (let gc = -1; gc <= FC; gc++) {
      if (on(gr, gc)) continue;
      let touch = false;
      for (let dr = -1; dr <= 1 && !touch; dr++)
        for (let dc = -1; dc <= 1; dc++) if (on(gr + dr, gc + dc)) { touch = true; break; }
      if (touch) c.fillRect(gc + off, gr + off, 1, 1);
    }
  }

  // ── 4) Remplissage dégradé + shading (sous-grille) ─────────────────────────────
  for (let gr = 0; gr < FR; gr++) {
    const t = gr / (FR - 1);
    const base = t < 0.28 ? fill.top : t < 0.6 ? fill.mid : fill.bot;
    for (let gc = 0; gc < FC; gc++) {
      if (!on(gr, gc)) continue;
      const topEdge = !on(gr - 1, gc);
      const leftEdge = !on(gr, gc - 1);
      const botEdge = !on(gr + 1, gc);
      const rightEdge = !on(gr, gc + 1);
      let col = base;
      if (topEdge || leftEdge) col = fill.top;
      else if (botEdge || rightEdge) col = fill.deep;
      c.fillStyle = col;
      c.fillRect(gc + off, gr + off, 1, 1);
    }
  }

  // cols/rows exposés = cellules logiques (inchangés) ; le canvas a SS× plus de pixels.
  return { cv, cols: W, rows: H };
}

// Cache des sprites de lettres (gold pour le mot, vert pour le badge "98")
const GOLD = { top: C.goldTop, mid: C.goldMid, bot: C.goldBot, deep: C.goldDeep };
const GREEN = { top: RAMP.green[100], mid: C.badge, bot: C.badgeBot, deep: C.badgeDeep };
const _letterCache = new Map<string, LetterSprite | null>();
function getLetterSprite(ch: string, green = false): LetterSprite | null {
  const key = (green ? "g:" : "y:") + ch;
  if (!_letterCache.has(key)) {
    const glyph = GLYPHS[ch];
    _letterCache.set(key, glyph ? buildLetterSprite(glyph, green ? GREEN : GOLD) : null);
  }
  return _letterCache.get(key) ?? null;
}

// easeOutBack — rebond avec léger dépassement
function easeOutBack(p: number): number {
  const c1 = 2.2;
  const c3 = c1 + 1;
  const x = p - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}
function easeOutCubic(p: number): number {
  const x = 1 - p;
  return 1 - x * x * x;
}
// Progression 0→1 clampée pour les reveals du décor
function bgP(elapsed: number, start: number, dur: number): number {
  return Math.max(0, Math.min(1, (elapsed - start) / dur));
}
// Oscillation élastique décroissante (multi-rebond autour de 1.0)
function easeOutElastic(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1;
}
// Rebond multiple à l'atterrissage (CSS easeOutBounce)
function easeOutBounce(p: number): number {
  const n1 = 7.5625, d1 = 2.75;
  if (p < 1 / d1)         return n1 * p * p;
  if (p < 2 / d1)         { const q = p - 1.5 / d1;   return n1 * q * q + 0.75; }
  if (p < 2.5 / d1)       { const q = p - 2.25 / d1;  return n1 * q * q + 0.9375; }
  const q = p - 2.625 / d1; return n1 * q * q + 0.984375;
}

interface TitleCanvasProps {
  onMenuReveal: () => void;
  /** Si true, saute l'intro et commence directement en état idle (retour au menu). */
  skipIntro?: boolean;
  /** Émis à chaque fois qu'un œuf percute le titre ou le badge (force 0..1).
      Le menu s'en sert pour faire trembloter son texte — onde de choc lointaine. */
  onImpact?: (force: number) => void;
  /** Cri d'aigle ponctuel : "short" = peeks teaser de l'intro, "long" = l'aigle débarque.
      `rate` = pitch de lecture (1 = normal) ; les petits cris escaladent peek après peek. */
  onEagleCry?: (variant: "short" | "long", rate?: number) => void;
  /** Décomposition fréquentielle de la musique (kick/basse/médium/aigus/spectre) — chaque
      élément de l'écran-titre groove sur une bande différente. */
  getBeat?: () => BeatBands;
}

export function TitleCanvas({ skipIntro = false, onMenuReveal, onImpact, onEagleCry, getBeat }: TitleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const revealedRef = useRef(false);
  const onRevealRef = useRef(onMenuReveal);
  const onImpactRef = useRef(onImpact);
  const onCryRef = useRef(onEagleCry);
  const getBeatRef = useRef(getBeat);
  // Garde les callbacks à jour sans relancer l'effet d'animation. Mutés en
  // layout-effect (pas pendant le render) pour rester safe en mode concurrent.
  useLayoutEffect(() => {
    onRevealRef.current = onMenuReveal;
    onImpactRef.current = onImpact;
    onCryRef.current = onEagleCry;
    getBeatRef.current = getBeat;
  });
  // Capturé à la création de l'effet — détermine l'état initial, ne change pas.
  const skipIntroRef = useRef(skipIntro);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { body, wing } = getSprites();
    const eggSprite = buildEggSprite();
    const activeBall = getActiveBall();
    const eggGlow = activeBall.glow;
    const eggBody = activeBall.body;
    const bodyCols = EAGLE_BODY.grid[0]?.length ?? 48;
    const bodyRows = EAGLE_BODY.grid.length;

    let raf = 0;
    let startT = 0;
    let skipped = skipIntroRef.current; // déjà "skipé" si retour au menu

    // Cris d'aigle : tirés une seule fois chacun. Une fenêtre temporelle évite
    // qu'un saut d'intro (clic) ne déclenche des cris en retard d'un coup.
    const criedPeek = [false, false, false]; // petit cri par tête qui fait coucou
    let criedBig = false;                     // gros cri quand l'aigle débarque

    // Enveloppe d'ouverture du bec, synchronisée sur le cri en cours.
    let screechStart = -1; // performance.now() du début du cri visuel ; -1 = aucun
    let screechDur   = 0;  // durée d'ouverture du bec (s)
    let screechRel   = 0;  // durée de fermeture (s) — courte pour les petits cris
    let currentScreech = 0; // valeur [0..1] recalculée chaque frame → injectée au visage

    /** Déclenche un cri : joue le son ET ouvre le bec (enveloppe visuelle). */
    function fireCry(kind: "short" | "long", now: number, rate?: number) {
      onCryRef.current?.(kind, rate);
      screechStart = now;
      // Petit cri = ouverture brève et sèche ; gros cri = bec ouvert plus longtemps
      // (le sample dure ~6.8s, on referme après la partie percutante).
      screechDur = kind === "long" ? 2.4 : 0.34;
      screechRel = kind === "long" ? 0.22 : 0.12;
    }

    /** Ouverture du bec [0..1] pour l'instant `now` : attaque vive, léger flutter, release. */
    function screechOpen(now: number): number {
      if (screechStart < 0) return 0;
      const t = (now - screechStart) / 1000;
      if (t < 0 || t >= screechDur) return 0;
      const atk = Math.min(1, t / 0.05);                  // ouverture quasi instantanée
      const rel = Math.min(1, (screechDur - t) / screechRel); // referme
      const flutter = 0.86 + 0.14 * Math.sin(t * 42);     // le bec vibre = cri qui porte
      return Math.max(0, Math.min(1, Math.min(atk, rel) * flutter));
    }
    let trauma = 0;
    let prevMs = 0;
    let cssW = 0;
    let cssH = 0;

    // Moods aléatoires stables tirés une seule fois à l'init — un par peek pigeon + un pour l'aigle
    const peekMoodIds = [Math.floor(Math.random() * 7), Math.floor(Math.random() * 7), Math.floor(Math.random() * 7)];
    const introMoodIdx = Math.floor(Math.random() * 7);

    // Flash de mood occasionnel en idle (écran-titre)
    let moodFlashIdx = -1;   // -1 = pas de flash actif
    let moodFlashEnd = 0;
    let nextMoodFlash = EAGLE_IN + 2.5 + Math.random() * 6; // premier flash ~3-9s après l'atterrissage

    // Offscreen réutilisé pour le reflet (shine) qui balaie le titre en boucle.
    // On y peint une bande diagonale blanche puis on la masque par la forme des
    // lettres (destination-in) → un vrai glint pixel-net clippé au logo.
    const shineCv = typeof document !== "undefined" ? document.createElement("canvas") : null;
    const shineCtx = shineCv?.getContext("2d") ?? null;

    // Étincelles qui scintillent autour du logo (positions relatives au mot).
    const titleSparkles = [
      { fx: 0.06, fy: 0.12, ph: 0.0, sp: 1.7, col: C.goldTop },
      { fx: 0.95, fy: 0.08, ph: 1.2, sp: 2.1, col: C.goldMid },
      { fx: 0.5, fy: -0.16, ph: 2.4, sp: 1.4, col: "#ffffff" },
      { fx: 0.74, fy: 0.92, ph: 3.1, sp: 1.9, col: C.goldMid },
      { fx: 0.18, fy: 0.96, ph: 4.0, sp: 2.3, col: C.goldTop },
    ];

    // ─── Dessin d'un conifère pixel (silhouette) ──────────────────────────────
    function drawConifer(cx: number, tipY: number, h: number, w: number, swayRad: number) {
      ctx!.save();
      // Rotation autour de la base → la cime bouge plus que le tronc (balancement naturel)
      ctx!.translate(cx, tipY + h);
      ctx!.rotate(swayRad);
      ctx!.translate(-cx, -(tipY + h));
      const numLayers = Math.max(2, Math.floor(h / 22));
      for (let l = 0; l < numLayers; l++) {
        const ly = tipY + (l / numLayers) * h * 0.80;
        const lw = w * (0.28 + 0.72 * (l + 1) / numLayers);
        const lh = (h / numLayers) * 1.38;
        ctx!.beginPath();
        ctx!.moveTo(cx, ly);
        ctx!.lineTo(cx - lw / 2, ly + lh);
        ctx!.lineTo(cx + lw / 2, ly + lh);
        ctx!.closePath();
        ctx!.fill();
      }
      const tw = Math.max(2, w * 0.11);
      ctx!.fillRect(Math.round(cx - tw / 2), Math.round(tipY + h * 0.82), Math.ceil(tw), Math.ceil(h * 0.18 + 1));
      ctx!.restore();
    }

    function drawForest(elapsed: number) {
      // Vent : deux sinusoïdes lentes + rafale périodique qui se propage de gauche à droite
      const windBase = Math.sin(elapsed * 0.65) * 0.55 + Math.sin(elapsed * 0.29 + 1.1) * 0.38;
      const gustT = elapsed % 9.0;
      const gustStr = gustT < 2.2 ? Math.sin((gustT / 2.2) * Math.PI) * 1.9 : 0;

      // Chaque arbre a son propre timing dérivé de swayPhase + rebond easeOutBack à l'atterrissage
      const LAYER_BASE_START = [0.18, 0.25, 0.32] as const;
      const LAYER_SPREAD     = [0.28, 0.25, 0.22] as const; // étalement intra-layer via swayPhase
      const LAYER_SLIDE      = [1.10, 0.85, 0.65] as const; // chute depuis plus haut = impact + fort
      const TREE_DUR = 0.36; // chute plus rapide = atterrissage plus percutant

      ctx!.save();
      ctx!.imageSmoothingEnabled = false;
      for (let li = 0; li < _forestLayers.length; li++) {
        const layer = _forestLayers[li]!;
        ctx!.fillStyle = layer.col;
        for (const tree of layer.trees) {
          const treeNorm  = tree.swayPhase / (Math.PI * 2);         // [0..1] déterministe
          const treeStart = LAYER_BASE_START[li]! + treeNorm * LAYER_SPREAD[li]!;
          const treeP     = bgP(elapsed, treeStart, TREE_DUR);
          if (treeP <= 0) continue;
          const treeE  = easeOutBounce(treeP);                        // multi-rebond à l'atterrissage
          const ySlide = (1 - treeE) * cssH * LAYER_SLIDE[li]!;

          const h = tree.nh * cssH;
          const w = tree.nw * cssW;
          const tx = tree.nx * cssW;
          const tipY = layer.yBase * cssH - h;
          // Rafale décalée par position x → vague qui traverse la forêt
          const gustPhase = elapsed * 2.8 + tree.nx * 4.8;
          const windSway = (windBase + gustStr * Math.sin(gustPhase)) * tree.swayAmp * 0.85;
          const swayBoost = 1 + beat * 1.4;
          const sway = Math.sin(elapsed * tree.swaySpeed + tree.swayPhase) * tree.swayAmp * 2.4 * swayBoost + windSway;

          ctx!.save();
          ctx!.translate(0, ySlide);
          drawConifer(tx, tipY, h, w, sway);
          ctx!.restore();
        }
      }
      // Brume de sol animée — arrive après la dernière vague d'arbres
      const mistReveal = easeOutCubic(bgP(elapsed, 0.52, 0.65));
      if (mistReveal > 0) {
        for (let i = 0; i < 3; i++) {
          const drift = Math.sin(elapsed * 0.07 + i * 2.1) * cssW * 0.05;
          const mistY = cssH * (0.76 + i * 0.05);
          const mistH = cssH * 0.20;
          const a = [0.065, 0.044, 0.028][i]!;
          const gm = ctx!.createLinearGradient(0, mistY, 0, mistY + mistH);
          gm.addColorStop(0,    `rgba(70,130,45,0)`);
          gm.addColorStop(0.22, `rgba(55,100,32,${a})`);
          gm.addColorStop(0.60, `rgba(38,70,20,${a * 0.45})`);
          gm.addColorStop(1,    `rgba(15,35,8,0)`);
          ctx!.save();
          ctx!.globalAlpha = mistReveal;
          ctx!.translate(drift, 0);
          ctx!.fillStyle = gm;
          ctx!.fillRect(-cssW * 0.15, mistY, cssW * 1.3, mistH);
          ctx!.restore();
        }
      }
      ctx!.restore();
    }

    // ─── Étoiles filantes ─────────────────────────────────────────────────────
    interface ShootingStar { x: number; y: number; vx: number; vy: number; life: number; max: number; len: number; }
    const shootingStars: ShootingStar[] = [];
    let nextShootAt = 3 + Math.random() * 5;

    function updateAndDrawShootingStars(elapsed: number, dt: number) {
      if (elapsed > 1.0) {
        nextShootAt -= dt;
        if (nextShootAt <= 0) {
          const angle = (0.12 + Math.random() * 0.42) * Math.PI;
          const speed = 360 + Math.random() * 340;
          const dur = 0.45 + Math.random() * 0.55;
          shootingStars.push({
            x: cssW * (0.04 + Math.random() * 0.72),
            y: cssH * (0.02 + Math.random() * 0.36),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: dur, max: dur,
            len: 50 + Math.random() * 80,
          });
          nextShootAt = 5 + Math.random() * 9;
        }
      }
      if (shootingStars.length === 0) return;
      ctx!.save();
      ctx!.globalCompositeOperation = "lighter";
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]!;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        if (s.life <= 0 || s.x > cssW + 60 || s.y > cssH * 0.64) { shootingStars.splice(i, 1); continue; }
        const a = s.life / s.max;
        const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        const nx = s.vx / sp, ny = s.vy / sp;
        const tailX = s.x - nx * s.len * a;
        const tailY = s.y - ny * s.len * a;
        const grad = ctx!.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0,    "rgba(255,255,255,0)");
        grad.addColorStop(0.55, `rgba(200,220,255,${(a * 0.35).toFixed(3)})`);
        grad.addColorStop(1,    `rgba(255,255,255,${(a * 0.9).toFixed(3)})`);
        ctx!.globalAlpha = 1;
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.2;
        ctx!.beginPath();
        ctx!.moveTo(tailX, tailY);
        ctx!.lineTo(s.x, s.y);
        ctx!.stroke();
        ctx!.fillStyle = "#ffffff";
        ctx!.globalAlpha = a;
        ctx!.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
      }
      ctx!.restore();
    }

    // Suivi des atterrissages de lettres (pour shake + flash)
    const landed = new Array(WORD.length).fill(false);
    let badgePopped = false;
    let lastImpactT = -999; // elapsed au dernier impact d'œuf (déclenche shine + sparkles)
    let currentElapsed = 0; // elapsed courant, partagé avec les fonctions splat
    // Ressort d'impact propre au badge "98" — totalement indépendant de la vague
    // de PEAGLE : il ne bounce que quand un œuf le percute lui-même.
    let badgeKnock = 0;   // déplacement vertical (px)
    let badgeKnockV = 0;  // vitesse du ressort
    let badgeFlash = 0;   // 0..1 éclat à l'impact
    // Bandes musicales courantes (remplies chaque frame depuis getBeat).
    // `beat` reste l'alias de la BASSE soutenue — le décor (forêt, lune, aigle qui
    // plane) « respire » dessus, comme avant. Les autres bandes pilotent des effets
    // dédiés : kick → rebond du titre + headbang de l'aigle ; mid → wiggle du badge ;
    // treble → scintillement étoiles/étincelles ; level → vignette/glow ambiant.
    let beat = 0;         // = bands.bass (énergie basse soutenue [0..1])
    let kick = 0;         // onset sub-basse [0..1]
    let midBand = 0;      // onset médium [0..1]
    let treble = 0;       // onset aigu [0..1]
    let level = 0;        // RMS plein spectre lissé [0..1]
    let prevKick = 0;     // kick du frame précédent → front montant
    let prevMid = 0;      // mid du frame précédent → front montant
    // Headbang de l'aigle : ressort vertical kické par le kick (l'aigle hoche du chef).
    let headBang = 0;     // déplacement vertical (px) — repos = 0
    let headBangV = 0;    // vitesse du ressort
    // Groove du titre = ressort sous-amorti piloté par les onsets. Coller la
    // position au `beat` brut donnait un mouvement sec/saccadé ; ici chaque kick
    // injecte une impulsion et le titre rebondit puis se stabilise (overshoot juteux).
    let grooveY = 0;      // déplacement vertical (px) — repos = 0
    let grooveV = 0;      // vitesse du ressort
    let groovePop = 0;    // pop d'échelle [0..~0.18] qui retombe entre les beats
    // Groove PROPRE au badge « 98 » : au lieu de pomper verticalement avec le mot,
    // il dodeline (wiggle rotationnel alterné gauche/droite) + pulse léger → un
    // caractère bien à lui, distinct du rebond vertical de PEAGLE.
    let grooveBadgeRot = 0;   // rotation du wiggle (rad) — repos = 0
    let grooveBadgeRotV = 0;  // vitesse du ressort de rotation
    let grooveBadgeDir = 1;   // alterne le sens du wiggle à chaque beat
    let badgePulse = 0;       // pulse d'échelle propre au badge [0..~0.14]

    // ─── Œufs lâchés par l'aigle (gag idle) ──────────────────────────────────
    // De temps en temps, une fois posé en vol stationnaire, l'aigle « pond »
    // un œuf qui tombe en tournoyant et sort de l'écran par le bas. xD
    interface Egg { x: number; y: number; vx: number; vy: number; rot: number; vr: number; r: number; }
    const eggs: Egg[] = [];
    let nextEggAt = 0; // pond dès l'atterrissage
    let recoil = 0;          // sursaut de l'aigle au moment de la ponte
    let ponte = 0;           // 0 = repos, 1 = ponte (pattes écartées + aigle penché)
    let aimAngle = Math.PI / 2; // direction de tir courante (radians, +y = bas)
    let legSwing = 0;        // balancier des pattes (pendule amorti)
    let legSwingV = 0;       // vitesse angulaire du balancier
    // Position/échelle de l'aigle exposées par drawEagle pour ancrer la ponte
    let eagleX = 0, eagleY = 0, eagleScl = 1, eagleBob = 0;
    // Dernière position du pigeon (bout du peek 3) → point de départ de l'aigle
    let lastPigeonX = 0;
    let lastPigeonY = 0;

    // Peeks aléatoires générés une seule fois — bord + position le long du bord
    // Le dernier peek a un bord de SORTIE différent du bord d'entrée :
    //   le pigeon entre d'un côté, repart par un autre → l'aigle part de là.
    type PeekSide = "left" | "right" | "top" | "bottom";
    interface PeekConfig {
      side: PeekSide; pos: number;
      exitSide: PeekSide; exitPos: number; // sortie (= entrée pour tous sauf le dernier)
    }
    const PEEK_COUNT = 3;
    const _peekConfigs: PeekConfig[] = (() => {
      const sides: PeekSide[] = ["left", "right", "top", "bottom"];
      const randSide = (exclude: string) => {
        let s: PeekSide;
        do { s = sides[Math.floor(Math.random() * sides.length)]!; } while (s === exclude);
        return s;
      };
      const out: PeekConfig[] = [];
      let prev = "";
      for (let i = 0; i < PEEK_COUNT; i++) {
        const s = randSide(prev);
        prev = s;
        const pos = 0.25 + Math.random() * 0.50;
        // La tête se recache toujours bien droite : elle repart par le même bord
        // et à la même position qu'à l'entrée (sortie perpendiculaire, pas en
        // diagonale). Pour le dernier peek ça cale aussi le départ de l'aigle.
        const exitSide = s;
        const exitPos = pos;
        out.push({ side: s, pos, exitSide, exitPos });
      }
      return out;
    })();

    // ─── Impact des œufs sur les lettres du logo ──────────────────────────────
    // Quand un œuf percute une lettre, elle encaisse : ressort vertical (bonk),
    // éclat blanc, et l'œuf éclate en coquilles. Les rects sont remplis chaque
    // frame par drawTitle (espace logique, hors shake) pour la détection.
    type Rect = { x: number; y: number; w: number; h: number };
    const letterRects: (Rect | null)[] = new Array(WORD.length).fill(null);
    let badgeRect: Rect | null = null; // hitbox du badge "98" (rempli par drawTitle)
    const knock = new Array(WORD.length).fill(0);   // déplacement vertical (px)
    const knockV = new Array(WORD.length).fill(0);  // vitesse du ressort
    const flash = new Array(WORD.length).fill(0);   // 0..1 éclat à l'impact
    interface Shard { x: number; y: number; vx: number; vy: number; life: number; max: number; sz: number; }
    const shards: Shard[] = [];

    // Rebonds différés propagés aux lettres voisines à l'impact (effet d'onde) :
    // chaque voisine reçoit son coup de ressort après un petit délai, avec une
    // force décroissante → le rebond traverse le mot comme une vague.
    interface PendingKnock { i: number; delay: number; force: number; fl: number; }
    const pendingKnocks: PendingKnock[] = [];

    // Synchronise la taille du backing-store avec la taille CSS réelle du canvas.
    // Appelé à chaque frame → toujours responsive, quelle que soit la manière
    // dont la fenêtre OS redimensionne son contenu (ResizeObserver pas fiable ici).
    function syncSize() {
      const w = Math.max(1, canvas!.clientWidth);
      const h = Math.max(1, canvas!.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(w * dpr);
      const bh = Math.round(h * dpr);
      cssW = w;
      cssH = h;
      if (canvas!.width !== bw || canvas!.height !== bh) {
        canvas!.width = bw;
        canvas!.height = bh;
      }
      // setTransform à chaque frame (le redimensionnement du backing-store le reset)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    syncSize();

    function skip() {
      const now = performance.now();
      const elapsedNow = startT ? (now - startT) / 1000 : 0;
      if (elapsedNow < INTRO_OFFSET) {
        // Premier clic : saute la pré-intro, démarre le générique principal
        startT = now - INTRO_OFFSET * 1000;
        // Initialise la position pigeon au défaut si pas encore vue
        if (lastPigeonX === 0) { lastPigeonX = cssW + 40; lastPigeonY = cssH * 0.38; }
      } else if (!skipped) {
        // Second clic (pendant le générique) : saute à la fin
        skipped = true;
        startT = now - (INTRO_OFFSET + MENU_AT + 0.2) * 1000;
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") skip();
    }
    canvas.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", onKey);

    // Construit un FaceContext "posé" selon le mood d'intro tiré au sort.
    // Pendant EAGLE_IN + ~0.9s, l'aigle tient cette expression avant de
    // passer en idle normal.
    function buildIntroFaceCtx(idx: number, elapsed: number): FaceContext {
      const base = titleFaceCtx(elapsed, 0, 0);
      switch (idx) {
        case 0: return { ...base, won: true };         // étoile + jubilation
        case 1: return { ...base, bigCombo: true };    // smug arrogant
        case 2: return { ...base, hitMag: 12 };        // impact excité
        case 3: return { ...base, lowBalls: true };    // sourcils inquiets
        case 4: return { ...base, zeroPeg: true };     // rage
        case 5: return { ...base, aimIdleSec: 8 };    // somnolent
        case 6: return { ...base, oneBall: true };     // larmes dramatiques
        default: return base;
      }
    }

    function drawEagle(elapsed: number) {
      if (!body || !wing) return;
      const restX = cssW / 2;
      const restY = cssH * 0.21;
      const targetScale = Math.max(1.0, Math.min(2.6, (cssW * 0.20) / bodyCols));

      let ex: number;
      let ey: number;
      let scl: number;
      let flapSpeed: number;
      let flapAmp: number;

      if (elapsed < EAGLE_IN) {
        const p = easeOutCubic(elapsed / EAGLE_IN);
        // Démarre depuis la dernière position du pigeon (bord aléatoire) → cohérence narrative
        const hasPigPos = lastPigeonX !== 0 || lastPigeonY !== 0;
        const sx = hasPigPos ? lastPigeonX : cssW + bodyCols * targetScale * 0.5;
        const sy = hasPigPos ? lastPigeonY : restY - cssH * 0.18;
        ex = sx + (restX - sx) * p;
        ey = sy + (restY - sy) * p + Math.sin(p * Math.PI) * 32; // arc de vol
        scl = targetScale * (0.55 + 0.45 * p);
        flapSpeed = 26;
        flapAmp = 0.55;
      } else {
        const idle = elapsed - EAGLE_IN;
        ex = restX;
        // plane (bob amplifié par la basse) + headbang qui plonge la tête sur le kick
        ey = restY + Math.sin(idle * 2.2) * 5 * (1 + beat * 0.7) - recoil + headBang;
        scl = targetScale;
        flapSpeed = recoil > 0.3 ? 22 : 6.5; // bat plus fort juste après la ponte
        flapAmp = (recoil > 0.3 ? 0.5 : 0.3) * (1 + beat * 0.5);
      }

      const phase = elapsed * flapSpeed;
      const flap = Math.sin(phase) * flapAmp;
      const bob = Math.cos(phase) * 1.4;

      // Expose la pose courante pour ancrer la ponte des œufs
      eagleX = ex;
      eagleY = ey;
      eagleScl = scl;
      eagleBob = bob;

      // Ombre douce au sol du titre
      ctx!.save();
      ctx!.imageSmoothingEnabled = false;
      ctx!.translate(ex, ey);
      ctx!.scale(scl, scl);
      ctx!.translate(0, bob);

      // Lueur dorée derrière l'aigle (axe non penché → reste centrée)
      const halo = ctx!.createRadialGradient(0, 0, 2, 0, 0, bodyCols * 0.7);
      halo.addColorStop(0, "rgba(255,210,90,0.22)");
      halo.addColorStop(1, "rgba(255,210,90,0)");
      ctx!.fillStyle = halo;
      ctx!.fillRect(-bodyCols, -bodyRows, bodyCols * 2, bodyRows * 2);

      // L'aigle penche son arrière dans la direction de tir le temps de la ponte
      // (comme en jeu : rotation de aimAngle − π/2). S'efface quand `ponte` retombe.
      ctx!.rotate((aimAngle - Math.PI / 2) * ponte);

      // Ailes (autour de l'épaule)
      const { x: ax, y: ay } = EAGLE_WING_ANCHOR;
      const { x: pvx, y: pvy } = EAGLE_WING_PIVOT;
      for (const dir of [-1, 1] as const) {
        ctx!.save();
        ctx!.translate(dir * -ax, ay);
        if (dir > 0) ctx!.scale(-1, 1);
        ctx!.rotate(flap);
        ctx!.drawImage(wing, -pvx, -pvy);
        ctx!.restore();
      }
      // Pattes (talons) — derrière le corps. Elles s'écartent à la ponte (comme
      // en jeu) et pendouillent en balancier amorti (`legSwing`) → effet rigolo.
      {
        const ORANGE = "#f0a81e";
        const HI = "#ffc24a";
        const spread = 0.16 + ponte * 0.85;          // grand écart pendant la ponte
        const wobble = Math.sin(phase) * 0.05;       // petit frémissement idle
        // Un rectangle arrondi orange avec reflet « L » blanc — même DA que les pegs.
        const chunk = (x: number, y: number, w: number, h: number, r: number) => {
          ctx!.fillStyle = ORANGE;
          ctx!.beginPath();
          ctx!.roundRect(x, y, w, h, r);
          ctx!.fill();
          ctx!.strokeStyle = HI;
          ctx!.lineWidth = 1.5;
          ctx!.beginPath();
          ctx!.moveTo(x + 1.5, y + r + 2);
          ctx!.lineTo(x + 1.5, y + r);
          ctx!.arcTo(x + 1.5, y + 1.5, x + r, y + 1.5, r);
          ctx!.lineTo(x + r + 2, y + 1.5);
          ctx!.stroke();
        };
        // Une patte = 4 rectangles arrondis : 1 jambe + 3 doigts en éventail.
        const drawTalon = (dir: number, hipX: number, ang: number, len: number) => {
          ctx!.save();
          ctx!.translate(dir * hipX, 0);
          ctx!.rotate(-dir * ang);
          chunk(-3, -1, 6, len + 3, 1.5);              // la jambe
          for (const toe of [-0.5, 0, 0.5]) {
            ctx!.save();
            ctx!.translate(0, len);
            ctx!.rotate(toe);
            chunk(-1.5, 0, 3, 9, 1);                   // un doigt
            ctx!.restore();
          }
          ctx!.restore();
        };
        // Tout le bassin balance autour de la hanche (pendule), puis chaque patte
        // s'ouvre vers l'extérieur.
        ctx!.save();
        ctx!.translate(0, bodyRows / 2 - 7);
        ctx!.rotate(legSwing + wobble);
        drawTalon(-1, 4, spread, 13);
        drawTalon(+1, 4, spread, 13);
        ctx!.restore();
      }

      // Corps
      ctx!.drawImage(body, -bodyCols / 2, -bodyRows / 2);
      // Tête Doom — mood aléatoire pendant l'intro, flash occasionnel en idle
      const INTRO_HOLD = EAGLE_IN + 0.9;
      let faceCtx: FaceContext;
      if (elapsed < INTRO_HOLD) {
        faceCtx = buildIntroFaceCtx(introMoodIdx, elapsed);
      } else {
        // Déclenche un nouveau flash si l'heure est venue
        if (moodFlashIdx === -1 && elapsed >= nextMoodFlash) {
          moodFlashIdx = Math.floor(Math.random() * 7);
          moodFlashEnd = elapsed + 1.5 + Math.random() * 1.5;
          nextMoodFlash = moodFlashEnd + 6 + Math.random() * 10;
        }
        if (moodFlashIdx !== -1 && elapsed < moodFlashEnd) {
          faceCtx = buildIntroFaceCtx(moodFlashIdx, elapsed);
        } else {
          moodFlashIdx = -1;
          faceCtx = titleFaceCtx(elapsed, recoil, ponte);
        }
      }
      faceCtx.screech = currentScreech; // bec grand ouvert quand l'aigle crie
      eagleFace(ctx!, 0, -13, getFaceMood(faceCtx));
      ctx!.restore();
    }

    // L'aigle vise dans une direction au hasard, écarte les pattes et tire un œuf
    // depuis son arrière dans cette direction (avec recul + balancier des pattes).
    function layEgg() {
      // Direction aléatoire, biaisée vers le bas (± ~63°) pour rester visible
      aimAngle = Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      // Tir rapide comme en jeu (LAUNCH_SPEED≈600px/s), un peu calé sur l'échelle
      const speed = 540 + eagleScl * 60 + Math.random() * 160;
      const r = Math.max(4, eagleScl * 3.2);
      const dist = (bodyRows * 0.5) * eagleScl; // sort au niveau de l'arrière
      eggs.push({
        x: eagleX + Math.cos(aimAngle) * dist,
        y: eagleY + eagleBob + Math.sin(aimAngle) * dist,
        vx: Math.cos(aimAngle) * speed,
        vy: Math.sin(aimAngle) * speed,
        rot: 0,
        vr: (Math.random() - 0.5) * 10,
        r,
      });
      ponte = 1;                          // pattes écartées + aigle penché
      recoil = 7;                         // sursaut
      legSwingV += (Math.random() - 0.5) * 4 - 9; // les pattes se font éjecter
    }

    // Éclatement d'un œuf en coquilles + bonk de la lettre touchée.
    function splatEgg(e: Egg, li: number) {
      const baseForce = 440 + Math.min(320, Math.abs(e.vy) * 0.45);
      knockV[li] += baseForce;     // la lettre touchée encaisse à fond
      flash[li] = 1;
      trauma = Math.min(1, trauma + 0.34);
      onImpactRef.current?.(Math.min(1, baseForce / 760)); // onde vers le menu
      // Onde de rebond : les voisines suivent avec un délai croissant et une
      // force qui décroît → le rebond traverse le mot comme une vague (ricochet).
      for (let d = 1; d < WORD.length; d++) {
        const falloff = Math.pow(0.62, d);
        const force = baseForce * falloff;
        if (force < 14) break;
        const delay = d * 0.042;
        if (li - d >= 0) pendingKnocks.push({ i: li - d, delay, force, fl: falloff });
        if (li + d < WORD.length) pendingKnocks.push({ i: li + d, delay, force, fl: falloff });
      }
      burstShards(e);
      lastImpactT = currentElapsed;
    }

    // Projection des coquilles depuis un œuf éclaté (partagé lettres ↔ badge).
    function burstShards(e: Egg) {
      const n = 10 + Math.floor(Math.random() * 6);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 90 + Math.random() * 230;
        shards.push({
          x: e.x, y: e.y,
          vx: Math.cos(a) * sp + e.vx * 0.18,
          vy: Math.sin(a) * sp - 110, // gicle vers le haut
          life: 0.5 + Math.random() * 0.4,
          max: 0.9,
          sz: Math.max(1, Math.round(e.r * (0.4 + Math.random() * 0.4))),
        });
      }
    }

    // Impact d'un œuf sur le badge "98" — réaction indépendante de PEAGLE :
    // seul le ressort du badge encaisse (pas de propagation aux lettres, ni
    // l'inverse). Même juice : bonk + flash + éclats + petit shake.
    function splatBadge(e: Egg) {
      const f = 440 + Math.min(320, Math.abs(e.vy) * 0.45);
      badgeKnockV += f;
      badgeFlash = 1;
      trauma = Math.min(1, trauma + 0.3);
      onImpactRef.current?.(Math.min(1, f / 760)); // onde vers le menu
      burstShards(e);
      lastImpactT = currentElapsed;
    }

    function updateAndDrawEggs(dt: number) {
      const G = 900; // gravité (px/s²)
      for (let i = eggs.length - 1; i >= 0; i--) {
        const e = eggs[i]!;
        e.vy += G * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += e.vr * dt;
        if (e.y - e.r > cssH + 20) { eggs.splice(i, 1); continue; }

        // Collision avec une lettre du logo (cercle ↔ rect) → éclatement
        let hit = false;
        for (let li = 0; li < letterRects.length; li++) {
          const R = letterRects[li];
          if (!R) continue;
          const cx = Math.max(R.x, Math.min(e.x, R.x + R.w));
          const cy = Math.max(R.y, Math.min(e.y, R.y + R.h));
          const ddx = e.x - cx, ddy = e.y - cy;
          if (ddx * ddx + ddy * ddy <= e.r * e.r) {
            splatEgg(e, li);
            eggs.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;

        // Collision avec le badge "98" (indépendant des lettres)
        if (badgeRect) {
          const R = badgeRect;
          const cx = Math.max(R.x, Math.min(e.x, R.x + R.w));
          const cy = Math.max(R.y, Math.min(e.y, R.y + R.h));
          const ddx = e.x - cx, ddy = e.y - cy;
          if (ddx * ddx + ddy * ddy <= e.r * e.r) {
            splatBadge(e);
            eggs.splice(i, 1);
            continue;
          }
        }
        if (!eggSprite) continue;

        // scale entier pour rester pixel-net, comme en partie
        const scale = Math.max(1, Math.round(e.r / BALL_R));
        const sz = eggSprite.width * scale;
        ctx!.save();
        ctx!.translate(e.x, e.y);
        ctx!.rotate(e.rot);
        ctx!.imageSmoothingEnabled = false;
        // glow pixel (comme renderer/ball.ts)
        ctx!.fillStyle = eggGlow;
        ctx!.globalAlpha = 0.22;
        ctx!.fillRect(-sz / 2 - scale * 2, -sz / 2 - scale * 2, sz + scale * 4, sz + scale * 4);
        ctx!.globalAlpha = 1;
        ctx!.drawImage(eggSprite, -sz / 2, -sz / 2, sz, sz);
        ctx!.restore();
      }
    }

    // Éclats de coquille projetés à l'impact (petits carrés qui retombent).
    function updateAndDrawShards(dt: number) {
      const G = 1100;
      for (let i = shards.length - 1; i >= 0; i--) {
        const sh = shards[i]!;
        sh.life -= dt;
        if (sh.life <= 0) { shards.splice(i, 1); continue; }
        sh.vy += G * dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        ctx!.globalAlpha = Math.max(0, Math.min(1, sh.life / sh.max));
        ctx!.fillStyle = eggBody;
        ctx!.fillRect(Math.round(sh.x), Math.round(sh.y), sh.sz, sh.sz);
      }
      ctx!.globalAlpha = 1;
    }

    function letterAlpha(elapsed: number, i: number): { p: number } {
      const start = LETTERS_START + i * LETTER_STAGGER;
      return { p: Math.max(0, Math.min(1, (elapsed - start) / LETTER_FALL)) };
    }

    function drawTitle(elapsed: number) {
      // Cellule du mot principal — 1 cellule = `u` pixels écran.
      // `u` s'adapte à la fenêtre : borné par la largeur (~82%) ET la hauteur
      // (~28% pour la hauteur du mot), pas de plafond fixe → grossit avec la fenêtre.
      const wordCells = WORD.length * GW + (WORD.length - 1) * 2; // 2 cellules d'espace
      // ~76% de largeur → laisse une gouttière à droite pour le badge "98"
      const uByW = (cssW * 0.60) / wordCells;
      const uByH = (cssH * 0.22) / GH;
      const u = Math.max(2, Math.floor(Math.min(uByW, uByH)));
      const gap = u * 2; // espace entre lettres
      const letterW = GW * u;
      const totalW = WORD.length * letterW + (WORD.length - 1) * gap;
      const baseX = Math.round((cssW - totalW) / 2);
      const baseY = Math.round(cssH * 0.46 + grooveY);

      // pulse global après intro
      const settledFor = elapsed - lastLetterLand;
      const pulse = settledFor > 0 ? 0.5 + 0.5 * Math.sin(settledFor * 2.4) : 0;

      ctx!.imageSmoothingEnabled = false;

      // halo derrière le titre une fois posé
      if (settledFor > -0.2) {
        ctx!.save();
        ctx!.globalCompositeOperation = "lighter";
        ctx!.globalAlpha = 0.08 + 0.06 * pulse;
        const g = ctx!.createLinearGradient(0, baseY - u, 0, baseY + GH * u + u);
        g.addColorStop(0, "rgba(255,220,120,0.0)");
        g.addColorStop(0.5, "rgba(255,200,80,1)");
        g.addColorStop(1, "rgba(255,160,40,0.0)");
        ctx!.fillStyle = g;
        ctx!.fillRect(baseX - u * 2, baseY - u * 2, totalW + u * 4, GH * u + u * 4);
        ctx!.restore();
      }

      // Géométrie des lettres collectée pour le reflet (shine) et la bbox du mot
      const shineLetters: { spr: LetterSprite; ox: number; dy: number; w: number; h: number }[] = [];
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;

      const dropDist = cssH * 0.42;
      for (let i = 0; i < WORD.length; i++) {
        const { p } = letterAlpha(elapsed, i);
        if (p <= 0) continue;
        const e = easeOutBack(p);
        const dy = -dropDist * (1 - e);
        // squash à l'atterrissage
        let squashY = 1;
        if (p > 0.82) {
          const k = (p - 0.82) / 0.18;
          squashY = 1 + Math.sin(k * Math.PI) * 0.16; // étirement bref
        }
        // détection d'atterrissage
        if (p >= 1 && !landed[i]) {
          landed[i] = true;
          trauma = Math.min(1, trauma + 0.45);
        }
        const sinceLand = landed[i] ? (elapsed - (LETTERS_START + i * LETTER_STAGGER + LETTER_FALL)) : -1;
        const glow = sinceLand >= 0 ? Math.max(0, 1 - sinceLand / 0.4) : Math.min(1, p);

        const spr = getLetterSprite(WORD[i]!);
        if (!spr) continue;
        // bonk d'impact : ressort vertical (knock) + vitesse (knockV) pour le juice
        const knockY = knock[i];
        const knockVel = knockV[i];
        // squash & stretch : enfoncée (knockY>0) → plus large + plus courte ; en
        // rebond (knockY<0) → plus fine + plus haute. Conserve ~le volume.
        const sq = Math.max(-0.32, Math.min(0.45, knockY * 0.011));
        const popScale = 1 + flash[i] * 0.16 + groovePop; // pop d'échelle (impact + groove)
        const scaleX = (1 + sq * 0.55) * popScale;
        const scaleY = squashY * (1 - sq) * popScale;     // squashY = étirement d'atterrissage
        // flottement idle en vague : fond doucement une fois le logo posé
        const floatFade = settledFor > 0 ? Math.min(1, settledFor / 0.7) : 0;
        const floatOffset = Math.sin(settledFor * Math.PI * 1.2 + i * 0.45) * 3 * floatFade;
        const idleRot = Math.sin(settledFor * Math.PI * 0.9 + i * 0.6) * 0.018 * floatFade;
        const rot = Math.max(-0.22, Math.min(0.22, knockVel * 0.00048)) + idleRot;

        const naturalW = spr.cols * u;
        const naturalH = spr.rows * u;
        const ox = baseX + i * (letterW + gap) - u;       // coin haut-gauche (marge contour incl.)
        const cx = ox + naturalW / 2;                     // centre horizontal
        const by = baseY + dy - u + knockY + naturalH + floatOffset; // bord bas + flottement

        // Hitbox + géométrie du reflet (approx. axis-aligned, rotation ignorée)
        const w = naturalW * scaleX;
        const h = naturalH * scaleY;
        const left = cx - w / 2;
        const top = by - h;
        letterRects[i] = { x: left, y: top, w, h };
        const rl = Math.round(left), rt = Math.round(top), rw = Math.round(w), rh = Math.round(h);
        shineLetters.push({ spr, ox: rl, dy: rt, w: rw, h: rh });
        if (rl < bx0) bx0 = rl;
        if (rt < by0) by0 = rt;
        if (rl + rw > bx1) bx1 = rl + rw;
        if (rt + rh > by1) by1 = rt + rh;

        // Dessin transformé : rotation + squash autour du bord bas-centre
        ctx!.save();
        ctx!.imageSmoothingEnabled = false;
        ctx!.translate(cx, by);
        ctx!.rotate(rot);
        ctx!.scale(scaleX, scaleY);
        ctx!.globalAlpha = Math.min(1, p * 2.5);
        ctx!.drawImage(spr.cv, -naturalW / 2, -naturalH, naturalW, naturalH);
        // éclat de glow récent + flash d'impact (additif, dans le même repère)
        const additive = Math.max(glow * 0.45, flash[i] * 1.15);
        if (additive > 0.01) {
          ctx!.globalAlpha = Math.min(1, additive);
          ctx!.globalCompositeOperation = "lighter";
          ctx!.drawImage(spr.cv, -naturalW / 2, -naturalH, naturalW, naturalH);
        }
        ctx!.restore();
      }

      // ─── Reflet (shine) déclenché à chaque impact d'œuf ────────────────────────
      // Une bande lumineuse diagonale traverse les lettres au moment de l'impact,
      // clippée pile à leur forme via un offscreen (destination-in).
      if (shineCtx && shineCv && settledFor > 0 && shineLetters.length && bx1 > bx0) {
        const sweepDur = 0.42;
        const tt = elapsed - lastImpactT;
        if (tt >= 0 && tt < sweepDur) {
          const pad = u * 2;
          const bx = Math.floor(bx0 - pad);
          const by = Math.floor(by0 - pad);
          const bw = Math.ceil(bx1 + pad) - bx;
          const bh = Math.ceil(by1 + pad) - by;
          if (bw > 0 && bh > 0) {
            if (shineCv.width !== bw) shineCv.width = bw;
            if (shineCv.height !== bh) shineCv.height = bh;
            // Progression accélérée (ease-in) → le reflet « whoosh » vers la droite
            // et claque pile sur le 98 où le glint l'attend. Plus satisfaisant.
            const lin = tt / sweepDur;
            const sp = lin * lin * (2 - lin); // smootherstep-ish, biais accel
            shineCtx.setTransform(1, 0, 0, 1, 0, 0);
            shineCtx.clearRect(0, 0, bw, bh);
            shineCtx.imageSmoothingEnabled = false;
            // 1) Masque = UNION des lettres (source-over → on les empile). Crucial :
            //    un destination-in en boucle intersecterait les lettres (régions
            //    disjointes) → masque vide. On bâtit donc l'union d'abord.
            shineCtx.globalCompositeOperation = "source-over";
            for (const L of shineLetters) {
              shineCtx.drawImage(L.spr.cv, L.ox - bx, L.dy - by, L.w, L.h);
            }
            // 2) Bande blanche diagonale, peinte uniquement DANS l'union (source-in)
            const band = bw * 0.3;
            const cx = -band + sp * (bw + band * 2);
            const grad = shineCtx.createLinearGradient(cx - band, 0, cx + band, bh);
            grad.addColorStop(0, "rgba(255,210,90,0)");
            grad.addColorStop(0.34, "rgba(255,228,150,0.45)"); // liseré doré chaud
            grad.addColorStop(0.5, "rgba(255,255,255,1)");      // cœur blanc surex
            grad.addColorStop(0.66, "rgba(255,228,150,0.45)");
            grad.addColorStop(1, "rgba(255,210,90,0)");
            shineCtx.globalCompositeOperation = "source-in";
            shineCtx.fillStyle = grad;
            shineCtx.fillRect(0, 0, bw, bh);
            shineCtx.globalCompositeOperation = "source-over";
            // Dépose le reflet en additif, fondu doux aux extrémités du passage.
            // Double passe : un cœur blanc large + un re-dépôt « lighter » pour
            // pousser la brillance vers le surex → streak bien juteux.
            ctx!.save();
            ctx!.globalCompositeOperation = "lighter";
            ctx!.imageSmoothingEnabled = false;
            ctx!.globalAlpha = Math.sin(sp * Math.PI);
            ctx!.drawImage(shineCv, bx, by);
            ctx!.globalAlpha = 0.5 * Math.sin(sp * Math.PI);
            ctx!.drawImage(shineCv, bx, by);
            ctx!.restore();
          }
        }
      }

      // ─── Étincelles scintillantes (burst après impact d'œuf) ─────────────────
      if (settledFor > 0) {
        const timeSinceImpact = elapsed - lastImpactT;
        const sparkleDur = 1.4;
        if (timeSinceImpact >= 0 && timeSinceImpact < sparkleDur) {
          const fade = Math.pow(1 - timeSinceImpact / sparkleDur, 0.6);
          const sphScale = Math.max(1, Math.round(u * 0.6));
          ctx!.save();
          ctx!.globalCompositeOperation = "lighter";
          for (const s of titleSparkles) {
            const tw = Math.sin(timeSinceImpact * s.sp * 7 + s.ph * 2);
            if (tw <= 0) continue;
            const a = tw * tw * fade;
            const x = Math.round(baseX + s.fx * totalW);
            const y = Math.round(baseY + s.fy * (GH * u));
            const r = sphScale;
            ctx!.fillStyle = s.col;
            ctx!.globalAlpha = a;
            ctx!.fillRect(x - r, y, r * 2 + 1, 1);
            ctx!.fillRect(x, y - r, 1, r * 2 + 1);
            ctx!.globalAlpha = a * 0.8;
            ctx!.fillRect(x - 1, y - 1, 2, 2);
          }
          ctx!.restore();
        }
      }

      // Badge "98" en pop, en haut à droite du mot (taille proportionnelle à `u`)
      if (elapsed >= BADGE_AT) {
        const bp = Math.min(1, (elapsed - BADGE_AT) / 0.4);
        const scl = easeOutBack(bp);
        if (bp >= 1 && !badgePopped) {
          badgePopped = true;
          trauma = Math.min(1, trauma + 0.3);
        }
        const bu = Math.max(2, Math.round(u * 0.62));
        const bGap = bu * 2;
        const bW = BADGE.length * GW * bu + (BADGE.length - 1) * bGap;
        const bH = bu * GH;
        // posé en exposant sur le coin haut-droit, clampé pour ne jamais déborder
        const margin = Math.max(4, Math.round(u * 0.5));
        const bx = Math.min(baseX + totalW - GW * u * 0.4, cssW - bW - margin);
        const by = baseY - bu * GH * 0.6;

        // Bounce indépendant du badge : squash/stretch + wobble piloté par son
        // propre ressort (badgeKnock/badgeKnockV/badgeFlash). Combiné au pop d'intro.
        const sq = Math.max(-0.32, Math.min(0.45, badgeKnock * 0.011));
        const badgeFloatFade = bp >= 1 ? Math.min(1, (elapsed - BADGE_AT - 0.4) / 0.7) : 0;
        const pop = (1 + badgeFlash * 0.16 + badgePulse * badgeFloatFade) * scl;
        const bScaleX = (1 + sq * 0.55) * pop;
        const bScaleY = (1 - sq) * pop;
        const badgeFloat = Math.sin(settledFor * Math.PI * 1.4 + 1.2) * 2.8 * badgeFloatFade;
        const badgeIdleRot = Math.sin(settledFor * Math.PI * 1.0 + 2.0) * 0.022 * badgeFloatFade;
        const badgeGrooveRot = Math.max(-0.15, Math.min(0.15, grooveBadgeRot)) * badgeFloatFade;
        const bRot = Math.max(-0.22, Math.min(0.22, badgeKnockV * 0.00048)) + badgeIdleRot + badgeGrooveRot;
        const acx = bx + bW / 2;                 // centre horizontal
        const aby = by + bH + badgeKnock + badgeFloat; // bord bas + enfoncement + flottement

        // Hitbox du badge (approx. axis-aligned, rotation ignorée)
        const hbW = bW * bScaleX;
        const hbH = bH * bScaleY;
        badgeRect = { x: acx - hbW / 2, y: aby - hbH, w: hbW, h: hbH };

        ctx!.save();
        ctx!.globalAlpha = Math.min(1, bp * 2);
        ctx!.imageSmoothingEnabled = false;
        ctx!.translate(acx, aby);
        ctx!.rotate(bRot);
        ctx!.scale(bScaleX, bScaleY);
        ctx!.translate(-bW / 2, -bH);             // origine = coin haut-gauche du badge
        for (let i = 0; i < BADGE.length; i++) {
          const spr = getLetterSprite(BADGE[i]!, true);
          if (!spr) continue;
          const ox = i * (GW * bu + bGap) - bu;
          ctx!.drawImage(spr.cv, Math.round(ox), -bu, spr.cols * bu, spr.rows * bu);
          // flash d'impact additif
          if (badgeFlash > 0.01) {
            ctx!.save();
            ctx!.globalAlpha = Math.min(1, badgeFlash * 1.15);
            ctx!.globalCompositeOperation = "lighter";
            ctx!.drawImage(spr.cv, Math.round(ox), -bu, spr.cols * bu, spr.rows * bu);
            ctx!.restore();
          }
        }
        ctx!.restore();

        // ─── Glint « bling » sur le 98 ─────────────────────────────────────────
        // Calé sur la fin du balayage du reflet, une étincelle éclate pile sur le
        // coin haut-droit du badge : flash + anneau + étoile 8 branches qui claque,
        // par-dessus le « 98 » (rendu après lui) → effet bijou. ✨
        if (settledFor > 0 && badgeRect) {
          const sweepDur = 0.42;
          const glintAt = sweepDur * 0.74; // calé sur la fin du whoosh
          const glintDur = 0.5;
          const tt = elapsed - lastImpactT;
          if (tt >= glintAt && tt < glintAt + glintDur) {
            const gp = (tt - glintAt) / glintDur;                 // 0..1
            // Attaque quasi-instantanée puis decay → claque sec et satisfaisant
            const pop = Math.pow(1 - gp, 0.6);                    // pic immédiat, fond lent
            const snap = Math.pow(1 - gp, 2.4);                   // cœur + anneau ultra-bref
            // Coin haut-droit du badge
            const gx = Math.round(badgeRect.x + badgeRect.w * 0.82);
            const gy = Math.round(badgeRect.y + badgeRect.h * 0.16);
            const arm = u * (4 + 9 * pop);                        // grandes branches
            const thick = Math.max(1, Math.round(u * 0.7));

            ctx!.save();
            ctx!.globalCompositeOperation = "lighter";
            ctx!.imageSmoothingEnabled = false;

            // Halo rond chaud
            const halo = ctx!.createRadialGradient(gx, gy, 0, gx, gy, arm);
            halo.addColorStop(0, `rgba(255,255,255,${0.95 * pop})`);
            halo.addColorStop(0.35, `rgba(255,235,160,${0.5 * pop})`);
            halo.addColorStop(1, "rgba(255,210,90,0)");
            ctx!.fillStyle = halo;
            ctx!.fillRect(gx - arm, gy - arm, arm * 2, arm * 2);

            // Étoile 8 branches : 4 cardinales longues + 4 diagonales courtes
            const rays: [number, number, number][] = [
              [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
              [0.7, 0.7, 0.5], [-0.7, 0.7, 0.5], [0.7, -0.7, 0.5], [-0.7, -0.7, 0.5],
            ];
            // Rotation stylée : spin continu + coup de boost pendant le pop
            const spin = elapsed * 1.1 + (1 - pop) * 1.6;
            const cs = Math.cos(spin), sn = Math.sin(spin);
            ctx!.globalAlpha = pop;
            for (const [dx, dy, len] of rays) {
              const rx = dx * cs - dy * sn;   // direction tournée
              const ry = dx * sn + dy * cs;
              const ex = gx + rx * arm * len;
              const ey = gy + ry * arm * len;
              const gr = ctx!.createLinearGradient(gx, gy, ex, ey);
              gr.addColorStop(0, "rgba(255,255,255,0.95)");
              gr.addColorStop(1, "rgba(255,235,170,0)");
              ctx!.strokeStyle = gr;
              ctx!.lineWidth = Math.max(1, thick * len);
              ctx!.beginPath();
              ctx!.moveTo(gx, gy);
              ctx!.lineTo(ex, ey);
              ctx!.stroke();
            }

            // Anneau de choc qui se dilate puis s'efface
            const ringR = u * (1.5 + 7 * gp);
            ctx!.globalAlpha = snap * 0.8;
            ctx!.strokeStyle = "rgba(255,245,200,1)";
            ctx!.lineWidth = Math.max(1, Math.round(u * 0.4));
            ctx!.beginPath();
            ctx!.arc(gx, gy, ringR, 0, Math.PI * 2);
            ctx!.stroke();

            // Cœur blanc dense
            const core = Math.max(1, Math.round(thick * (1 + snap)));
            ctx!.globalAlpha = 1;
            ctx!.fillStyle = "#ffffff";
            ctx!.fillRect(gx - core, gy - core, core * 2 + 1, core * 2 + 1);

            ctx!.restore();
          }
        }
      }
    }

    function drawBackdrop(elapsed: number) {
      const skyReveal = easeOutCubic(bgP(elapsed, 0.00, 0.38));

      // Ciel nocturne — dégradé bleu nuit → horizon teal lumineux → sol forêt
      const g = ctx!.createLinearGradient(0, 0, 0, cssH);
      g.addColorStop(0,    "#020916");
      g.addColorStop(0.22, "#051228");
      g.addColorStop(0.46, "#07203c");
      g.addColorStop(0.60, "#0b2b1f"); // horizon teal — les cimes se silhouettent dessus
      g.addColorStop(0.73, "#062015");
      g.addColorStop(0.86, "#040d04");
      g.addColorStop(1,    "#020502");
      ctx!.globalAlpha = skyReveal;
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, cssW, cssH);
      ctx!.globalAlpha = 1;

      // Étoiles — chacune pop à son propre moment avec un éclat pixel bref
      ctx!.save();
      for (let si = 0; si < _stars.length; si++) {
        const st   = _stars[si]!;
        const popT = 0.04 + fhash(si * 13 + 88) * 0.54; // 0.04..0.58s, déterministe
        const dt   = elapsed - popT;
        if (dt < 0) continue;
        const popP  = Math.min(1, dt / 0.20);
        const flash = Math.max(0, 1 - dt / 0.10); // éclat très bref au pop
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * st.speed + st.phase));
        // Scintillement aigu : chaque étoile flashe sur les charleys/cymbales, avec
        // un seuil propre (via sa phase) → elles ne s'allument pas toutes en même
        // temps mais clignotent comme un ciel qui « danse » sur les hi-hats.
        const trebTwinkle = treble * (0.5 + 0.5 * Math.sin(st.phase * 3.1 + elapsed * 6));
        const sx = Math.round(st.nx * cssW);
        const sy = Math.round(st.ny * cssH * 0.55);
        const rFlash = st.r + Math.round(flash * 5) + (trebTwinkle > 0.45 ? 1 : 0); // élargi à l'impact / sur un aigu fort
        ctx!.fillStyle = st.col;
        ctx!.globalAlpha = Math.min(1, tw * st.bright * popP + flash * 2.8 + trebTwinkle * st.bright * 1.1);
        ctx!.fillRect(sx - (rFlash - st.r), sy - (rFlash - st.r), rFlash * 2, rFlash * 2);
        if (flash < 0.01 && st.r > 1) {
          ctx!.globalAlpha = tw * st.bright * 0.20 * popP;
          ctx!.fillRect(sx - 1, sy - 1, st.r + 2, st.r + 2);
        }
      }
      ctx!.restore();

      // Lune — oscillation élastique (gonfle → rebondit → se stabilise) + bloom
      {
        const moonRevealP = bgP(elapsed, 0.14, 0.72); // plus long = rebonds visibles
        if (moonRevealP > 0) {
          const moonScale = easeOutElastic(moonRevealP) * (1 + beat * 0.14); // pulse sur le beat
          const moonAlpha = Math.min(1, moonRevealP * 6.0); // alpha rapide
          // Bloom intense calé sur le premier pic d'overshoot (~p=0.10 = t+0.07s)
          const bloom = Math.sin(bgP(elapsed, 0.14, 0.24) * Math.PI) * 1.1;

          const pulse = 0.96 + 0.04 * Math.sin(elapsed * 0.38);
          const moonX = cssW * 0.88 + Math.sin(elapsed * 0.45) * 2;
          const moonY = cssH * 0.06 + Math.sin(elapsed * 0.70) * 3;
          const moonR = Math.max(5, cssH * 0.028) * pulse;

          const R = Math.round(moonR);

          ctx!.save();
          ctx!.translate(moonX, moonY);
          ctx!.scale(moonScale, moonScale);
          ctx!.translate(-moonX, -moonY);

          // Bloom additif au moment du scale-in (carrés concentriques)
          if (bloom > 0.01) {
            ctx!.save();
            ctx!.globalCompositeOperation = "lighter";
            for (let k = 0; k < 4; k++) {
              const br = Math.round(R * (2.5 + k * 1.5));
              ctx!.globalAlpha = bloom * moonAlpha * (0.13 - k * 0.025);
              ctx!.fillStyle = "#88aaff";
              roundGlowRect(ctx!, Math.round(moonX - br), Math.round(moonY - br), br * 2);
            }
            ctx!.restore();
          }

          // Halo permanent (carrés concentriques décroissants, coins arrondis)
          for (let k = 0; k < 5; k++) {
            const hr = Math.round(R * (1.5 + k * 0.7));
            ctx!.globalAlpha = moonAlpha * (0.15 - k * 0.024) * (1 + beat * 1.2);
            ctx!.fillStyle = "#c0d4f8";
            roundGlowRect(ctx!, Math.round(moonX - hr), Math.round(moonY - hr), hr * 2);
          }

          // Corps nacré avec dégradé vertical — coins arrondis 1px (lignes extrêmes rentrées)
          ctx!.globalAlpha = moonAlpha;
          for (let dy = -R; dy <= R; dy++) {
            const t = (dy + R) / (R * 2);
            ctx!.fillStyle = t < 0.3 ? "#e8f0ff" : t < 0.65 ? "#d5e8f8" : "#c0d8ee";
            const inset = (dy === -R || dy === R) ? 1 : 0;
            ctx!.fillRect(Math.round(moonX - R) + inset, Math.round(moonY + dy), R * 2 - inset * 2, 1);
          }

          // Cratères
          ctx!.globalAlpha = 0.13 * moonAlpha;
          ctx!.fillStyle = "#587898";
          ctx!.fillRect(Math.round(moonX - moonR * 0.28), Math.round(moonY - moonR * 0.1), Math.round(moonR * 0.36), Math.round(moonR * 0.26));
          ctx!.fillRect(Math.round(moonX + moonR * 0.18), Math.round(moonY + moonR * 0.22), Math.round(moonR * 0.22), Math.round(moonR * 0.17));

          // ─── Catchlight : éclat permanent (halo + étoile 8 branches qui tourne) ─
          {
            const shinePop  = 0.55 + 0.45 * Math.sin(elapsed * 1.4);  // pulsation douce
            const shineSpin = elapsed * 0.28;                           // rotation lente
            const gx  = moonX + moonR * 0.36;
            const gy  = moonY - moonR * 0.40;
            const arm = moonR * (0.50 + 0.30 * shinePop);
            const core = Math.max(1, Math.round(moonR * 0.07));

            ctx!.save();
            ctx!.globalCompositeOperation = "lighter";

            // Halo doux autour du catchlight
            ctx!.globalAlpha = moonAlpha * shinePop * 0.55;
            const sg = ctx!.createRadialGradient(gx, gy, 0, gx, gy, arm * 1.6);
            sg.addColorStop(0,   "rgba(255,255,255,0.8)");
            sg.addColorStop(0.5, "rgba(200,230,255,0.2)");
            sg.addColorStop(1,   "rgba(180,220,255,0)");
            ctx!.fillStyle = sg;
            ctx!.fillRect(gx - arm * 1.7, gy - arm * 1.7, arm * 3.4, arm * 3.4);

            // Étoile 8 branches (4 longues + 4 courtes en diagonale)
            const rays: [number, number, number][] = [
              [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
              [0.707, 0.707, 0.45], [-0.707, 0.707, 0.45], [0.707, -0.707, 0.45], [-0.707, -0.707, 0.45],
            ];
            const cs = Math.cos(shineSpin), sn = Math.sin(shineSpin);
            ctx!.globalAlpha = moonAlpha * shinePop;
            for (const [dx, dy, len] of rays) {
              const rx = dx * cs - dy * sn;
              const ry = dx * sn + dy * cs;
              const ex = gx + rx * arm * len;
              const ey = gy + ry * arm * len;
              const gr = ctx!.createLinearGradient(gx, gy, ex, ey);
              gr.addColorStop(0, "rgba(255,255,255,0.95)");
              gr.addColorStop(1, "rgba(200,230,255,0)");
              ctx!.strokeStyle = gr;
              ctx!.lineWidth = Math.max(1, Math.round(moonR * 0.05 * len));
              ctx!.beginPath();
              ctx!.moveTo(gx, gy);
              ctx!.lineTo(ex, ey);
              ctx!.stroke();
            }

            // Cœur pixel blanc dense
            ctx!.globalAlpha = moonAlpha;
            ctx!.fillStyle = "#ffffff";
            ctx!.fillRect(Math.round(gx) - core, Math.round(gy) - core, core * 2 + 1, core * 2 + 1);

            ctx!.restore();
          }

          ctx!.restore();
        }
      }

    }

    // ─── Écran "Gunther Studio présente" ──────────────────────────────────────
    function drawStudioScreen(elapsed: number) {
      const fadeIn  = Math.min(1, elapsed / 0.50);
      const fadeOut = elapsed > STUDIO_DUR - 0.70
        ? Math.max(0, 1 - (elapsed - (STUDIO_DUR - 0.70)) / 0.70)
        : 1;
      const masterA = easeOutCubic(fadeIn) * fadeOut;
      if (masterA <= 0) return;

      ctx!.fillStyle = "#000000";
      ctx!.fillRect(0, 0, cssW, cssH);

      ctx!.save();
      ctx!.imageSmoothingEnabled = false;

      // ── Grand "G" pixel-art en or, centré ──────────────────────────────────
      const GS = getLetterSprite("G", false); // tuile 9×9 en gold
      if (GS) {
        const scale = Math.max(4, Math.round(cssW * 0.016)); // ~10 px/cellule à 600
        const pulse = 1 + 0.055 * Math.sin(elapsed * 3.4);
        const rotG = Math.sin(elapsed * 0.8) * 0.04; // léger balancement
        const logoW = GS.cols * scale;
        const logoH = GS.rows * scale;
        const lx = Math.round(cssW / 2);
        const ly = Math.round(cssH * 0.36);

        // Halo derrière le logo
        ctx!.save();
        ctx!.globalCompositeOperation = "lighter";
        ctx!.globalAlpha = masterA * 0.22 * pulse;
        const hg = ctx!.createRadialGradient(lx, ly, 0, lx, ly, logoW * 0.9);
        hg.addColorStop(0, C.goldMid);
        hg.addColorStop(1, "rgba(255,180,40,0)");
        ctx!.fillStyle = hg;
        ctx!.fillRect(lx - logoW, ly - logoH, logoW * 2, logoH * 2);
        ctx!.restore();

        // Le "G" lui-même
        ctx!.save();
        ctx!.globalAlpha = masterA * Math.min(1, elapsed / 0.35);
        ctx!.translate(lx, ly);
        ctx!.rotate(rotG);
        ctx!.scale(scale * pulse, scale * pulse);
        // taille logique explicite (cols×rows) : le canvas a SS× plus de pixels.
        ctx!.drawImage(GS.cv, -GS.cols / 2, -GS.rows / 2, GS.cols, GS.rows);
        ctx!.restore();

        // 6 petites étoiles qui orbitent autour du logo
        ctx!.save();
        ctx!.globalCompositeOperation = "lighter";
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + elapsed * 1.3;
          const r = logoW * 0.72 * (1 + 0.12 * Math.sin(elapsed * 2.1 + i));
          const sx2 = lx + Math.cos(a) * r;
          const sy2 = ly + Math.sin(a) * r * 0.65;
          const twinkle = 0.5 + 0.5 * Math.sin(elapsed * (2.4 + i * 0.7) + i * 1.8);
          ctx!.globalAlpha = masterA * twinkle * 0.9;
          ctx!.fillStyle = i % 2 === 0 ? C.goldTop : C.goldMid;
          const sr = Math.max(1, Math.round(scale * 0.25));
          ctx!.fillRect(Math.round(sx2) - sr, Math.round(sy2) - sr, sr * 2, sr * 2);
          // croix 4 branches
          ctx!.fillRect(Math.round(sx2) - sr * 3, Math.round(sy2), sr * 6, 1);
          ctx!.fillRect(Math.round(sx2), Math.round(sy2) - sr * 3, 1, sr * 6);
        }
        ctx!.restore();

        // Filet de séparation doré sous le G
        ctx!.save();
        const sepY = ly + logoH * 0.65 + 6;
        const sepW = logoW * 1.6;
        const segG = ctx!.createLinearGradient(lx - sepW / 2, sepY, lx + sepW / 2, sepY);
        segG.addColorStop(0, "rgba(255,180,40,0)");
        segG.addColorStop(0.3, "rgba(255,210,80,0.7)");
        segG.addColorStop(0.7, "rgba(255,210,80,0.7)");
        segG.addColorStop(1, "rgba(255,180,40,0)");
        ctx!.globalAlpha = masterA * Math.min(1, (elapsed - 0.4) / 0.3);
        ctx!.fillStyle = segG;
        ctx!.fillRect(Math.round(lx - sepW / 2), Math.round(sepY), Math.ceil(sepW), 1);
        ctx!.restore();

        // ── Textes ────────────────────────────────────────────────────────────
        const textSize = Math.max(9, Math.round(cssW * 0.036));
        const studioY = ly + logoH * 0.65 + 20 + textSize * 0.6;
        const STUDIO_TEXT = "GUNTHER STUDIO";
        const LETTER_REVEAL_START = 0.55;
        const LETTER_DELAY = 0.07;
        const LETTER_DUR = 0.22;

        // Measure full text width for centering + sweep
        ctx!.font = `bold ${textSize}px "Courier New", monospace`;
        ctx!.textAlign = "left";
        ctx!.textBaseline = "middle";
        const fullTextW = ctx!.measureText(STUDIO_TEXT).width;
        const textStartX = lx - fullTextW / 2;
        const textRevealEnd = LETTER_REVEAL_START + (STUDIO_TEXT.length - 1) * LETTER_DELAY + LETTER_DUR;

        // Pre-compute char x positions (1 measureText per char instead of O(ci²))
        const charXPositions: number[] = [];
        {
          let cumW = 0;
          for (let ci = 0; ci < STUDIO_TEXT.length; ci++) {
            charXPositions.push(textStartX + cumW);
            cumW += ctx!.measureText(STUDIO_TEXT[ci]!).width;
          }
        }

        // "GUNTHER STUDIO" — reveal lettre par lettre avec flash + slide-up
        ctx!.save();
        for (let ci = 0; ci < STUDIO_TEXT.length; ci++) {
          const revStart = LETTER_REVEAL_START + ci * LETTER_DELAY;
          const revP = Math.max(0, Math.min(1, (elapsed - revStart) / LETTER_DUR));
          if (revP <= 0) continue;
          const charA = easeOutCubic(revP);
          const charY = studioY + (1 - charA) * 9; // glisse vers le haut
          const charX = charXPositions[ci]!;
          // flash doré au pop
          const flashA = Math.max(0, 1 - (elapsed - revStart) / 0.28);
          if (flashA > 0.01) {
            ctx!.save();
            ctx!.globalCompositeOperation = "lighter";
            ctx!.globalAlpha = masterA * flashA * 0.75;
            ctx!.fillStyle = C.goldMid;
            ctx!.fillText(STUDIO_TEXT[ci]!, charX, charY);
            ctx!.restore();
          }
          ctx!.globalAlpha = masterA * charA;
          ctx!.fillStyle = "#c8d4e0";
          ctx!.fillText(STUDIO_TEXT[ci]!, charX, charY);
        }
        ctx!.restore();

        // Sweeps lumineux (deux passages — après le reveal complet, puis vers la fin)
        const SWEEP_DUR = 0.52;
        for (const sweepAt of [textRevealEnd + 0.12, 3.6] as const) {
          const tt = elapsed - sweepAt;
          if (tt < 0 || tt >= SWEEP_DUR) continue;
          const sp = tt / SWEEP_DUR;
          const sm = sp * sp * (3 - 2 * sp); // smoothstep
          ctx!.save();
          ctx!.beginPath();
          ctx!.rect(
            Math.floor(textStartX) - 2,
            Math.floor(studioY - textSize * 0.8),
            Math.ceil(fullTextW) + 4,
            Math.ceil(textSize * 1.6),
          );
          ctx!.clip();
          ctx!.globalCompositeOperation = "lighter";
          const band = fullTextW * 0.32;
          const sweepX = textStartX - band + sm * (fullTextW + band * 2);
          const sweepGrad = ctx!.createLinearGradient(sweepX - band, 0, sweepX + band, 0);
          sweepGrad.addColorStop(0, "rgba(255,220,140,0)");
          sweepGrad.addColorStop(0.5, `rgba(255,248,220,${(0.65 * Math.sin(sp * Math.PI)).toFixed(3)})`);
          sweepGrad.addColorStop(1, "rgba(255,220,140,0)");
          ctx!.fillStyle = sweepGrad;
          ctx!.globalAlpha = masterA;
          ctx!.fillRect(sweepX - band, studioY - textSize, band * 2, textSize * 2);
          ctx!.restore();
        }

        // "présente" — italic, légère dérive horizontale en entrée
        const pResReveal = Math.min(1, Math.max(0, (elapsed - 1.6) / 0.50));
        if (pResReveal > 0) {
          ctx!.save();
          const presA = easeOutCubic(pResReveal);
          ctx!.globalAlpha = masterA * presA;
          const presSize = Math.max(7, Math.round(textSize * 0.62));
          ctx!.font = `italic ${presSize}px "Courier New", monospace`;
          ctx!.fillStyle = "#a09050";
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          const presX = lx + (1 - presA) * 18; // drift depuis la droite
          ctx!.fillText("présente", presX, studioY + textSize * 1.0);
          ctx!.restore();
        }

        // Ornements pixel — petites étoiles 4 branches qui scintillent
        const ornReveal = Math.min(1, Math.max(0, (elapsed - 2.2) / 0.5));
        if (ornReveal > 0) {
          ctx!.save();
          ctx!.globalCompositeOperation = "lighter";
          for (const side of [-1, 1] as const) {
            const margin = fullTextW / 2 + textSize * 1.05;
            const ox = Math.round(lx + side * margin);
            const oy = Math.round(studioY);
            const tw = 0.55 + 0.45 * Math.abs(Math.sin(elapsed * 2.8 + (side > 0 ? 0 : 2.1)));
            ctx!.globalAlpha = masterA * easeOutCubic(ornReveal) * tw;
            ctx!.fillStyle = "#c8a830";
            ctx!.fillRect(ox - 3, oy, 7, 1);
            ctx!.fillRect(ox, oy - 3, 1, 7);
            ctx!.fillRect(ox - 1, oy - 1, 3, 3);
          }
          ctx!.restore();
        }
      }

      ctx!.restore();

      // ── Letterbox cinématographique (dessiné après restore, par-dessus tout) ─
      {
        const LB_IN_END = 0.55;
        const LB_OUT_START = STUDIO_DUR - 0.85;
        let lbP: number;
        if (elapsed < LB_IN_END) {
          lbP = easeOutCubic(elapsed / LB_IN_END);
        } else if (elapsed > LB_OUT_START) {
          lbP = Math.max(0, 1 - easeOutCubic(Math.min(1, (elapsed - LB_OUT_START) / 0.55)));
        } else {
          lbP = 1;
        }
        if (lbP > 0.005) {
          const barH = Math.round(cssH * 0.082 * lbP);
          ctx!.save();
          ctx!.globalAlpha = 1;
          ctx!.fillStyle = "#000000";
          ctx!.fillRect(0, 0, cssW, barH);
          ctx!.fillRect(0, cssH - barH, cssW, barH);
          ctx!.restore();
        }
      }
    }

    // ─── Séquence de peeks — tête d'aigle (eagleFace) ────────────────────────
    // Crâne toujours orienté vers le centre de l'écran :
    //   bord GAUCHE  → rotation +π/2   bord DROIT → rotation -π/2
    //   bord BAS     → rotation 0      bord HAUT  → rotation +π
    // Bords et positions le long du bord tirés aléatoirement dans _peekConfigs.
    function drawPigeonSequence(pigElapsed: number) {
      // Fond noir
      ctx!.fillStyle = "#000000";
      ctx!.fillRect(0, 0, cssW, cssH);

      // Quelques étoiles discrètes
      ctx!.save();
      for (let si = 0; si < 18; si++) {
        const st = _stars[si]!;
        const tw = 0.25 + 0.35 * Math.abs(Math.sin(pigElapsed * st.speed * 0.5 + st.phase));
        ctx!.fillStyle = st.col;
        ctx!.globalAlpha = tw * st.bright * 0.45;
        ctx!.fillRect(Math.round(st.nx * cssW), Math.round(st.ny * cssH * 0.65), st.r, st.r);
      }
      ctx!.globalAlpha = 1;
      ctx!.restore();

      // Échelle : face ≈ 18 % de la largeur de l'écran (boîte ±14 px à 1×)
      const peekScale = Math.max(2, Math.min(6, Math.round(cssW * 0.18 / 28)));
      const headR     = 16 * peekScale; // rayon demi-hauteur en px écran

      const easeIn3 = (p: number) => p * p * p;

      // Rotation skull-vers-centre selon le bord d'entrée
      function rotationForSide(side: PeekSide): number {
        if (side === "left")   return  Math.PI / 2;   // skull → droite
        if (side === "right")  return -Math.PI / 2;   // skull → gauche
        if (side === "top")    return  Math.PI;        // skull → bas (vers centre)
        return 0;                                      // bottom : skull → haut (normal)
      }

      // Coordonnée écran de départ (hors-écran) pour un bord donné
      function offscreenStart(side: PeekSide, pos: number): [number, number] {
        if (side === "left")   return [-headR, pos * cssH];
        if (side === "right")  return [cssW + headR, pos * cssH];
        if (side === "top")    return [pos * cssW, -headR];
        return [pos * cssW, cssH + headR]; // bottom
      }

      // Coordonnée de la position "visible" (depth en px depuis le bord)
      function peekPos(side: PeekSide, pos: number, depth: number): [number, number] {
        if (side === "left")   return [-headR + depth, pos * cssH];
        if (side === "right")  return [cssW + headR - depth, pos * cssH];
        if (side === "top")    return [pos * cssW, -headR + depth];
        return [pos * cssW, cssH + headR - depth]; // bottom
      }

      // Helper dessin d'une tête orientée
      function drawPeekHead(
        sx: number, sy: number,
        rotation: number, bob: number,
        mood: FaceMood,
      ) {
        ctx!.save();
        ctx!.translate(sx, sy);
        ctx!.rotate(rotation + bob);
        ctx!.scale(peekScale, peekScale);
        ctx!.imageSmoothingEnabled = false;
        eagleFace(ctx!, 0, 0, mood);
        ctx!.restore();
      }

      // Timings des peeks (PEEK_STARTS remonté au niveau module — partagé avec les cris)
      const PEEK_IN     = 0.30;
      const PEEK_HOLD   = 1.04;
      const PEEK_OUT    = 0.28;
      // Profondeur d'entrée : le centre de la tête avance de headR*DEPTH_FACTOR
      // → facteur ≥ 1.5 pour voir vraiment la face (skull + yeux + bec)
      const DEPTH_FACTOR = 1.65;

      for (let pi = 0; pi < PEEK_COUNT; pi++) {
        const AT  = PEEK_STARTS[pi]!;
        const END = AT + PEEK_IN + PEEK_HOLD + PEEK_OUT;
        const cfg = _peekConfigs[pi]!;
        const isLast = (pi === PEEK_COUNT - 1);

        if (pigElapsed < AT) continue;

        const ph    = pigElapsed - AT;
        const depth = headR * DEPTH_FACTOR;
        const [entryX, entryY] = offscreenStart(cfg.side, cfg.pos);
        const [tx, ty]         = peekPos(cfg.side, cfg.pos, depth);
        const [exitX, exitY]   = offscreenStart(cfg.exitSide, cfg.exitPos);

        // Interpolation position courante
        let cx2: number, cy2: number;
        if (ph < PEEK_IN) {
          const fwd = easeOutBack(ph / PEEK_IN);
          cx2 = entryX + (tx - entryX) * fwd;
          cy2 = entryY + (ty - entryY) * fwd;
        } else if (ph < PEEK_IN + PEEK_HOLD) {
          cx2 = tx; cy2 = ty;
        } else if (ph < END - AT) {
          const op = (ph - PEEK_IN - PEEK_HOLD) / PEEK_OUT;
          const back = easeIn3(op);
          cx2 = tx + (exitX - tx) * back;
          cy2 = ty + (exitY - ty) * back;
        } else {
          cx2 = exitX; cy2 = exitY;
        }

        // Pour le dernier peek : suivi de la position pour le départ de l'aigle
        if (isLast) { lastPigeonX = cx2; lastPigeonY = cy2; }

        if (pigElapsed >= END) continue; // hors écran, ne pas dessiner

        const hf  = Math.max(0, (ph - PEEK_IN) / PEEK_HOLD);
        // Balancement : nul à l'entrée, oscillant pendant le hold. Pendant la
        // sortie, on FIGE la valeur du balancement au moment où la rétractation
        // commence et on la ramène à 0 en douceur — au lieu de laisser le sinus
        // continuer à osciller, ce qui faisait pencher la tête sur le côté en
        // se recachant. Résultat : elle se recache bien droite, comme à l'entrée.
        let bob: number;
        if (ph < PEEK_IN + PEEK_HOLD) {
          bob = (hf > 0 ? 1 : 0) * Math.sin(pigElapsed * 4.5) * 0.06;
        } else {
          const op = Math.min(1, (ph - PEEK_IN - PEEK_HOLD) / PEEK_OUT);
          const bobAtRetreat = Math.sin((AT + PEEK_IN + PEEK_HOLD) * 4.5) * 0.06;
          bob = bobAtRetreat * (1 - easeOutCubic(op));
        }
        const peekCtx = buildIntroFaceCtx(peekMoodIds[pi]!, pigElapsed);
        peekCtx.screech = currentScreech; // bec ouvert sur le petit cri du peek
        const mood = getFaceMood(peekCtx);
        // Le bec ne suit QUE l'enveloppe du petit cri : sans ça, les moods qui
        // gardent la bouche entrouverte au repos (won, burst, bâillement, smug)
        // laissaient le bec ouvert tout le peek, bien après la fin du cri.
        mood.open = currentScreech;

        drawPeekHead(cx2, cy2, rotationForSide(cfg.side), bob, mood);
      }
    }

    function drawVignette() {
      // La vignette « respire » avec l'intensité globale : plus la musique pompe,
      // plus elle s'ouvre (scène qui s'éclaire), plus elle se referme dans les creux.
      const dark = 0.55 - level * 0.18;
      const g = ctx!.createRadialGradient(cssW / 2, cssH * 0.42, cssH * 0.2, cssW / 2, cssH / 2, cssH * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${dark.toFixed(3)})`);
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, cssW, cssH);
    }

    function frame(now: number) {
      syncSize();
      if (!startT) {
        // skipIntro (retour menu) : saute toute la pré-intro + le générique
        startT = skipIntroRef.current
          ? now - (INTRO_OFFSET + MENU_AT + 0.2) * 1000
          : now;
        if (skipIntroRef.current) {
          lastPigeonX = cssW + 40;
          lastPigeonY = cssH * 0.38;
        }
        prevMs = now;
      }
      const dt = Math.min(0.05, (now - prevMs) / 1000);
      prevMs = now;
      const elapsed = (now - startT) / 1000;

      // ── Pré-intro (studio + pigeon) ─────────────────────────────────────────
      if (elapsed < INTRO_OFFSET) {
        ctx!.clearRect(0, 0, cssW, cssH);
        if (elapsed < STUDIO_DUR) {
          drawStudioScreen(elapsed);
        } else {
          const pigElapsed = elapsed - STUDIO_DUR;
          // Petit cri quand chaque tête émerge (≈ mi-entrée), une fois chacune.
          // Fenêtre 0.4 s → un saut d'intro ne rejoue pas les cris ratés.
          for (let i = 0; i < PEEK_STARTS.length; i++) {
            const at = PEEK_STARTS[i]! + 0.14;
            if (!criedPeek[i] && pigElapsed >= at && pigElapsed < at + 0.4) {
              criedPeek[i] = true;
              // Pitch qui escalade peek après peek (0.82 → 1.18) + jitter aléatoire
              // → teaser qui monte en tension, chaque cri nettement distinct.
              const rate = 0.82 + i * 0.18 + (Math.random() - 0.5) * 0.1;
              fireCry("short", now, rate);
            }
          }
          currentScreech = screechOpen(now); // doit être prêt avant le dessin des têtes
          drawPigeonSequence(pigElapsed);
        }
        raf = requestAnimationFrame(frame);
        return;
      }

      // ── Générique principal ──────────────────────────────────────────────────
      const mainElapsed = elapsed - INTRO_OFFSET;
      currentElapsed = mainElapsed;

      // Gros cri : l'aigle débarque vraiment. Fenêtre courte → pas de cri tardif
      // au retour menu (skipIntro saute déjà loin au-delà de 0.6 s).
      if (!criedBig && mainElapsed >= 0.05 && mainElapsed < 0.6) {
        criedBig = true;
        fireCry("long", now);
      }
      currentScreech = screechOpen(now); // bec ouvert tant que le cri résonne

      // shake
      trauma = Math.max(0, trauma - dt * 2.2);
      const shake = trauma * trauma;
      const sx = (Math.random() - 0.5) * 10 * shake;
      const sy = (Math.random() - 0.5) * 10 * shake;

      // recul + écartement des pattes après une ponte → reviennent à 0
      recoil = Math.max(0, recoil - dt * 28);
      ponte = Math.max(0, ponte - dt * 1.8);

      // Pendule amorti des pattes : rappel élastique vers 0 + frottement.
      legSwingV += -legSwing * 80 * dt;
      legSwingV *= Math.exp(-3.2 * dt);
      legSwing += legSwingV * dt;

      // Rebonds différés des lettres voisines (onde qui traverse le mot)
      for (let k = pendingKnocks.length - 1; k >= 0; k--) {
        const pk = pendingKnocks[k]!;
        pk.delay -= dt;
        if (pk.delay <= 0) {
          knockV[pk.i] += pk.force;
          flash[pk.i] = Math.max(flash[pk.i], pk.fl);
          pendingKnocks.splice(k, 1);
        }
      }

      // Ressorts d'impact des lettres (bonk) + extinction du flash
      for (let i = 0; i < WORD.length; i++) {
        knockV[i] += (-175 * knock[i] - 8 * knockV[i]) * dt;
        knock[i] += knockV[i] * dt;
        if (flash[i] > 0) flash[i] = Math.max(0, flash[i] - dt * 3.5);
      }

      // Ressort propre au badge "98"
      badgeKnockV += (-175 * badgeKnock - 8 * badgeKnockV) * dt;
      badgeKnock += badgeKnockV * dt;
      if (badgeFlash > 0) badgeFlash = Math.max(0, badgeFlash - dt * 3.5);

      // Ponte périodique, seulement une fois l'aigle posé en idle
      if (mainElapsed > EAGLE_IN + 0.3) {
        nextEggAt -= dt;
        if (nextEggAt <= 0) {
          layEgg();
          nextEggAt = 3 + Math.random() * 4;
        }
      }

      // Échantillon musical — décompose en bandes ; les draw functions lisent
      // `beat`/`kick`/`midBand`/`treble`/`level` en closure.
      const bands = getBeatRef.current?.();
      beat = bands?.bass ?? 0;     // basse soutenue → respiration du décor (alias historique)
      kick = bands?.kick ?? 0;     // onset sub-basse → rebond du titre + headbang
      midBand = bands?.mid ?? 0;   // onset médium → wiggle du badge
      treble = bands?.treble ?? 0; // onset aigu → scintillements
      level = bands?.level ?? 0;   // intensité globale → vignette/glow

      // Groove du titre — piloté par le KICK : chaque coup de grosse caisse donne
      // une impulsion au ressort (sous-amorti, overshoot juteux) → le mot rebondit
      // pile sur le beat puis se stabilise. L'aigle hoche du chef sur le même kick.
      const kickRise = Math.max(0, kick - prevKick);
      prevKick = kick;
      if (kickRise > 0.04) {
        grooveV -= kickRise * 240;                 // impulsion vers le haut
        grooveV = Math.max(grooveV, -220);         // borne le coup le plus fort
        groovePop = Math.min(0.16, groovePop + kickRise * 0.26);
        headBangV += kickRise * 150;               // l'aigle plonge la tête sur le kick
      }
      // Badge — piloté par les MÉDIUMS (caisse claire / synthés) : dodeline gauche/droite
      const midRise = Math.max(0, midBand - prevMid);
      prevMid = midBand;
      if (midRise > 0.05) {
        grooveBadgeRotV += grooveBadgeDir * midRise * 6.5;
        grooveBadgeDir = -grooveBadgeDir;
        badgePulse = Math.min(0.16, badgePulse + midRise * 0.24);
      }
      // Ressort du titre (k=110, c=8) → mouvement ample et smooth.
      grooveV += (-110 * grooveY - 8 * grooveV) * dt;
      grooveY += grooveV * dt;
      groovePop *= Math.pow(0.02, dt);                // retombe en douceur entre les beats
      // Ressort du headbang de l'aigle (un peu plus raide → hochement net)
      headBangV += (-170 * headBang - 10 * headBangV) * dt;
      headBang += headBangV * dt;
      // Ressort de rotation du badge (indépendant)
      grooveBadgeRotV += (-150 * grooveBadgeRot - 9 * grooveBadgeRotV) * dt;
      grooveBadgeRot += grooveBadgeRotV * dt;
      badgePulse *= Math.pow(0.02, dt);

      ctx!.save();
      ctx!.clearRect(0, 0, cssW, cssH);
      drawBackdrop(mainElapsed);
      updateAndDrawShootingStars(mainElapsed, dt);
      drawForest(mainElapsed);
      ctx!.translate(sx, sy);
      drawEagle(mainElapsed);
      updateAndDrawEggs(dt);
      drawTitle(mainElapsed);
      updateAndDrawShards(dt);
      ctx!.restore();
      drawVignette();

      if (!revealedRef.current && mainElapsed >= MENU_AT) {
        revealedRef.current = true;
        onRevealRef.current();
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        cursor: "pointer",
        zIndex: 1,
      }}
    />
  );
}
