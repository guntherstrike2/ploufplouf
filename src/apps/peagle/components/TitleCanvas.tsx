"use client";

import { useEffect, useRef } from "react";
import {
  EAGLE_BODY,
  EAGLE_WING,
  EAGLE_WING_PIVOT,
  EAGLE_WING_ANCHOR,
  getActiveBall,
} from "../engine/assets";
import { BALL_R } from "../engine/constants";

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
const C = {
  goldTop: "#fff3b0",
  goldMid: "#ffd24a",
  goldBot: "#f5a623",
  goldDeep: "#c87814",
  outline: "#241405",
  glow: "#ffcc33",
  badge: "#aaee66",
  badgeBot: "#66bb33",
  badgeDeep: "#3f8a1f",
  firefly: "#cdff66",
};

// ─── Timeline (secondes) ──────────────────────────────────────────────────────
const EAGLE_IN = 1.05;       // durée du vol d'arrivée
const LETTERS_START = 0.7;   // 1re lettre commence à tomber
const LETTER_STAGGER = 0.11; // décalage entre lettres
const LETTER_FALL = 0.5;     // durée de chute d'une lettre
const BADGE_AT = 1.85;       // le "98" pop
const MENU_AT = 2.35;        // révélation du menu

const lastLetterLand = LETTERS_START + (WORD.length - 1) * LETTER_STAGGER + LETTER_FALL;

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
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  if (!c) return null;

  const on = (r: number, cc: number) =>
    r >= 0 && r < rows && cc >= 0 && cc < cols && glyph[r]![cc] === "1";

  // 1) contour : toute cellule vide adjacente (8-voisins) à une cellule pleine
  c.fillStyle = C.outline;
  for (let r = -1; r <= rows; r++) {
    for (let cc = -1; cc <= cols; cc++) {
      if (on(r, cc)) continue;
      let touch = false;
      for (let dr = -1; dr <= 1 && !touch; dr++)
        for (let dc = -1; dc <= 1; dc++) if (on(r + dr, cc + dc)) { touch = true; break; }
      if (touch) c.fillRect(cc + 1, r + 1, 1, 1);
    }
  }

  // 2) remplissage dégradé + shading
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const base = t < 0.28 ? fill.top : t < 0.6 ? fill.mid : fill.bot;
    for (let cc = 0; cc < cols; cc++) {
      if (!on(r, cc)) continue;
      const x = cc + 1;
      const y = r + 1;
      // highlight : bord supérieur OU gauche exposé
      const topEdge = !on(r - 1, cc);
      const leftEdge = !on(r, cc - 1);
      const botEdge = !on(r + 1, cc);
      const rightEdge = !on(r, cc + 1);
      let col = base;
      if (topEdge || leftEdge) col = fill.top;
      else if (botEdge || rightEdge) col = fill.deep;
      c.fillStyle = col;
      c.fillRect(x, y, 1, 1);
    }
  }

  return { cv, cols: W, rows: H };
}

// Cache des sprites de lettres (gold pour le mot, vert pour le badge "98")
const GOLD = { top: C.goldTop, mid: C.goldMid, bot: C.goldBot, deep: C.goldDeep };
const GREEN = { top: "#d4ff99", mid: C.badge, bot: C.badgeBot, deep: C.badgeDeep };
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

interface TitleCanvasProps {
  onMenuReveal: () => void;
}

export function TitleCanvas({ onMenuReveal }: TitleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const revealedRef = useRef(false);
  const onRevealRef = useRef(onMenuReveal);
  onRevealRef.current = onMenuReveal;

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
    let skipped = false;
    let trauma = 0;
    let prevMs = 0;
    let cssW = 0;
    let cssH = 0;

    // Offscreen réutilisé pour le reflet (shine) qui balaie le titre en boucle.
    // On y peint une bande diagonale blanche puis on la masque par la forme des
    // lettres (destination-in) → un vrai glint pixel-net clippé au logo.
    const shineCv = typeof document !== "undefined" ? document.createElement("canvas") : null;
    const shineCtx = shineCv?.getContext("2d") ?? null;

    // Étincelles qui scintillent autour du logo (positions relatives au mot).
    const titleSparkles = [
      { fx: 0.06, fy: 0.12, ph: 0.0, sp: 1.7, col: "#fff3b0" },
      { fx: 0.95, fy: 0.08, ph: 1.2, sp: 2.1, col: "#ffd24a" },
      { fx: 0.5, fy: -0.16, ph: 2.4, sp: 1.4, col: "#ffffff" },
      { fx: 0.74, fy: 0.92, ph: 3.1, sp: 1.9, col: "#ffd24a" },
      { fx: 0.18, fy: 0.96, ph: 4.0, sp: 2.3, col: "#fff3b0" },
    ];

    // Lucioles déterministes
    const fireflies = Array.from({ length: 26 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
      drift: 0.4 + Math.random() * 0.8,
      r: Math.random() < 0.2 ? 2 : 1,
      seed: i,
    }));

    // Suivi des atterrissages de lettres (pour shake + flash)
    const landed = new Array(WORD.length).fill(false);
    let badgePopped = false;
    // Ressort d'impact propre au badge "98" — totalement indépendant de la vague
    // de PEAGLE : il ne bounce que quand un œuf le percute lui-même.
    let badgeKnock = 0;   // déplacement vertical (px)
    let badgeKnockV = 0;  // vitesse du ressort
    let badgeFlash = 0;   // 0..1 éclat à l'impact

    // ─── Œufs lâchés par l'aigle (gag idle) ──────────────────────────────────
    // De temps en temps, une fois posé en vol stationnaire, l'aigle « pond »
    // un œuf qui tombe en tournoyant et sort de l'écran par le bas. xD
    interface Egg { x: number; y: number; vx: number; vy: number; rot: number; vr: number; r: number; }
    const eggs: Egg[] = [];
    let nextEggAt = 1.4 + Math.random() * 1.6; // délai (s) avant le 1er œuf après l'intro
    let recoil = 0;          // sursaut de l'aigle au moment de la ponte
    let ponte = 0;           // 0 = repos, 1 = ponte (pattes écartées + aigle penché)
    let aimAngle = Math.PI / 2; // direction de tir courante (radians, +y = bas)
    let legSwing = 0;        // balancier des pattes (pendule amorti)
    let legSwingV = 0;       // vitesse angulaire du balancier
    // Position/échelle de l'aigle exposées par drawEagle pour ancrer la ponte
    let eagleX = 0, eagleY = 0, eagleScl = 1, eagleBob = 0;

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
      if (skipped) return;
      skipped = true;
      // Recale le temps de départ pour sauter à l'état final
      startT = performance.now() - (MENU_AT + 0.2) * 1000;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") skip();
    }
    canvas.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", onKey);

    function drawEagle(elapsed: number) {
      if (!body || !wing) return;
      const restX = cssW / 2;
      const restY = cssH * 0.21;
      const targetScale = Math.max(1.4, Math.min(4.2, (cssW * 0.34) / bodyCols));

      let ex: number;
      let ey: number;
      let scl: number;
      let flapSpeed: number;
      let flapAmp: number;

      if (elapsed < EAGLE_IN) {
        const p = easeOutCubic(elapsed / EAGLE_IN);
        // Vol courbe depuis le coin haut-gauche
        const sx = -bodyCols * targetScale * 0.7;
        const sy = restY - cssH * 0.18;
        ex = sx + (restX - sx) * p;
        ey = sy + (restY - sy) * p + Math.sin(p * Math.PI) * 26; // petit arc
        scl = targetScale * (0.55 + 0.45 * p);
        flapSpeed = 26;
        flapAmp = 0.55;
      } else {
        const idle = elapsed - EAGLE_IN;
        ex = restX;
        ey = restY + Math.sin(idle * 2.2) * 5 - recoil; // plane doucement (+ recul ponte)
        scl = targetScale;
        flapSpeed = recoil > 0.3 ? 22 : 6.5; // bat plus fort juste après la ponte
        flapAmp = recoil > 0.3 ? 0.5 : 0.3;
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
        const DARK = "#b97812";
        const OUT = "#1a120a";
        const spread = 0.16 + ponte * 0.85;          // grand écart pendant la ponte
        const wobble = Math.sin(phase) * 0.05;       // petit frémissement idle
        const drawTalon = (dir: number, hipX: number, ang: number, len: number) => {
          ctx!.save();
          ctx!.translate(dir * hipX, 0);
          ctx!.rotate(-dir * ang);
          ctx!.fillStyle = OUT; ctx!.fillRect(-2, -1, 4, len + 2);
          ctx!.fillStyle = ORANGE; ctx!.fillRect(-1.5, 0, 3, len);
          ctx!.fillStyle = DARK; ctx!.fillRect(0.3, 1, 1, len - 1);
          for (const toe of [-0.5, 0, 0.5]) {
            ctx!.save();
            ctx!.translate(0, len);
            ctx!.rotate(toe);
            ctx!.fillStyle = OUT; ctx!.fillRect(-1.5, 0, 3, 7);
            ctx!.fillStyle = ORANGE; ctx!.fillRect(-1, 0, 2, 6);
            ctx!.restore();
          }
          ctx!.restore();
        };
        // Tout le bassin balance autour de la hanche (pendule), puis chaque patte
        // s'ouvre vers l'extérieur.
        ctx!.save();
        ctx!.translate(0, bodyRows / 2 - 3);
        ctx!.rotate(legSwing + wobble);
        drawTalon(-1, 4, spread, 13);
        drawTalon(+1, 4, spread, 13);
        ctx!.restore();
      }

      // Corps
      ctx!.drawImage(body, -bodyCols / 2, -bodyRows / 2);
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
      badgeKnockV += 440 + Math.min(320, Math.abs(e.vy) * 0.45);
      badgeFlash = 1;
      trauma = Math.min(1, trauma + 0.3);
      burstShards(e);
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
      const uByW = (cssW * 0.76) / wordCells;
      const uByH = (cssH * 0.28) / GH;
      const u = Math.max(2, Math.floor(Math.min(uByW, uByH)));
      const gap = u * 2; // espace entre lettres
      const letterW = GW * u;
      const totalW = WORD.length * letterW + (WORD.length - 1) * gap;
      const baseX = Math.round((cssW - totalW) / 2);
      const baseY = Math.round(cssH * 0.46);

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
        const popScale = 1 + flash[i] * 0.16;             // pop d'échelle bref à l'impact
        const scaleX = (1 + sq * 0.55) * popScale;
        const scaleY = squashY * (1 - sq) * popScale;     // squashY = étirement d'atterrissage
        const rot = Math.max(-0.22, Math.min(0.22, knockVel * 0.00048)); // wobble piloté par la vitesse

        const naturalW = spr.cols * u;
        const naturalH = spr.rows * u;
        const ox = baseX + i * (letterW + gap) - u;       // coin haut-gauche (marge contour incl.)
        const cx = ox + naturalW / 2;                     // centre horizontal
        const by = baseY + dy - u + knockY + naturalH;    // bord bas (ancre du squash/rotation)

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

      // ─── Reflet (shine) qui balaie le titre en boucle ────────────────────────
      // Une fois le mot posé, une bande lumineuse diagonale traverse les lettres
      // toutes les ~4 s, clippée pile à leur forme via un offscreen (destination-in).
      if (shineCtx && shineCv && settledFor > 0 && shineLetters.length && bx1 > bx0) {
        const period = 4.2;     // intervalle entre deux passages
        const sweepDur = 0.95;  // durée d'un passage
        const tt = settledFor % period;
        if (tt < sweepDur) {
          const pad = u * 2;
          const bx = Math.floor(bx0 - pad);
          const by = Math.floor(by0 - pad);
          const bw = Math.ceil(bx1 + pad) - bx;
          const bh = Math.ceil(by1 + pad) - by;
          if (bw > 0 && bh > 0) {
            if (shineCv.width !== bw) shineCv.width = bw;
            if (shineCv.height !== bh) shineCv.height = bh;
            const sp = tt / sweepDur; // 0..1 progression du balayage
            shineCtx.setTransform(1, 0, 0, 1, 0, 0);
            shineCtx.clearRect(0, 0, bw, bh);
            shineCtx.imageSmoothingEnabled = false;
            // Bande blanche diagonale (transparent → blanc → transparent)
            const band = bw * 0.26;
            const cx = -band + sp * (bw + band * 2);
            const grad = shineCtx.createLinearGradient(cx - band, 0, cx + band, bh);
            grad.addColorStop(0, "rgba(255,255,255,0)");
            grad.addColorStop(0.5, "rgba(255,255,255,0.95)");
            grad.addColorStop(1, "rgba(255,255,255,0)");
            shineCtx.fillStyle = grad;
            shineCtx.fillRect(0, 0, bw, bh);
            // Masque par la forme exacte des lettres
            shineCtx.globalCompositeOperation = "destination-in";
            for (const L of shineLetters) {
              shineCtx.drawImage(L.spr.cv, L.ox - bx, L.dy - by, L.w, L.h);
            }
            shineCtx.globalCompositeOperation = "source-over";
            // Dépose le reflet en additif, fondu doux aux extrémités du passage
            ctx!.save();
            ctx!.globalCompositeOperation = "lighter";
            ctx!.globalAlpha = 0.85 * Math.sin(sp * Math.PI);
            ctx!.imageSmoothingEnabled = false;
            ctx!.drawImage(shineCv, bx, by);
            ctx!.restore();
          }
        }
      }

      // ─── Étincelles scintillantes autour du logo ─────────────────────────────
      if (settledFor > 0) {
        const sphScale = Math.max(1, Math.round(u * 0.6));
        ctx!.save();
        ctx!.globalCompositeOperation = "lighter";
        for (const s of titleSparkles) {
          const tw = Math.sin(elapsed * s.sp + s.ph);
          if (tw <= 0) continue;
          const a = tw * tw; // pic court, scintillement net
          const x = Math.round(baseX + s.fx * totalW);
          const y = Math.round(baseY + s.fy * (GH * u));
          const r = sphScale;
          ctx!.fillStyle = s.col;
          ctx!.globalAlpha = a;
          // croix pixel (4 branches) + cœur plus dense
          ctx!.fillRect(x - r, y, r * 2 + 1, 1);
          ctx!.fillRect(x, y - r, 1, r * 2 + 1);
          ctx!.globalAlpha = a * 0.8;
          ctx!.fillRect(x - 1, y - 1, 2, 2);
        }
        ctx!.restore();
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
        const pop = (1 + badgeFlash * 0.16) * scl;
        const bScaleX = (1 + sq * 0.55) * pop;
        const bScaleY = (1 - sq) * pop;
        const bRot = Math.max(-0.22, Math.min(0.22, badgeKnockV * 0.00048));
        const acx = bx + bW / 2;                 // centre horizontal
        const aby = by + bH + badgeKnock;         // bord bas (ancre) + enfoncement

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
      }
    }

    function drawBackdrop(elapsed: number) {
      // Dégradé forêt sombre
      const g = ctx!.createLinearGradient(0, 0, 0, cssH);
      g.addColorStop(0, "#0d2008");
      g.addColorStop(0.5, "#0a1806");
      g.addColorStop(1, "#040a02");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, cssW, cssH);

      // Rayons de lumière diagonaux
      ctx!.save();
      ctx!.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const x = cssW * (0.2 + i * 0.22) + Math.sin(elapsed * 0.3 + i) * 12;
        ctx!.globalAlpha = 0.03;
        ctx!.fillStyle = "#aaff66";
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x + 40, 0);
        ctx!.lineTo(x + 90, cssH);
        ctx!.lineTo(x + 50, cssH);
        ctx!.closePath();
        ctx!.fill();
      }
      ctx!.restore();

      // Lucioles
      ctx!.save();
      for (const f of fireflies) {
        const fx = ((f.x + Math.sin(elapsed * f.speed + f.phase) * 0.04) % 1) * cssW;
        const fy = (((f.y - elapsed * 0.012 * f.drift) % 1) + 1) % 1 * cssH;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(elapsed * (1 + f.seed * 0.05) + f.phase));
        ctx!.globalAlpha = tw * 0.8;
        ctx!.fillStyle = C.firefly;
        ctx!.fillRect(Math.round(fx), Math.round(fy), f.r, f.r);
        ctx!.globalAlpha = tw * 0.18;
        ctx!.fillRect(Math.round(fx) - 2, Math.round(fy) - 2, f.r + 4, f.r + 4);
      }
      ctx!.restore();
    }

    function drawVignette() {
      const g = ctx!.createRadialGradient(cssW / 2, cssH * 0.42, cssH * 0.2, cssW / 2, cssH / 2, cssH * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, cssW, cssH);
    }

    function frame(now: number) {
      syncSize();
      if (!startT) {
        startT = now;
        prevMs = now;
      }
      const dt = Math.min(0.05, (now - prevMs) / 1000);
      prevMs = now;
      const elapsed = (now - startT) / 1000;

      // shake
      trauma = Math.max(0, trauma - dt * 2.2);
      const shake = trauma * trauma;
      const sx = (Math.random() - 0.5) * 10 * shake;
      const sy = (Math.random() - 0.5) * 10 * shake;

      // recul + écartement des pattes après une ponte → reviennent à 0
      recoil = Math.max(0, recoil - dt * 28);
      ponte = Math.max(0, ponte - dt * 1.8);

      // Pendule amorti des pattes : rappel élastique vers 0 + frottement.
      // Le coup de pied donné à la ponte les fait osciller (effet « rigolo »).
      legSwingV += -legSwing * 80 * dt;     // raideur du ressort
      legSwingV *= Math.exp(-3.2 * dt);     // amortissement
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
        knockV[i] += (-175 * knock[i] - 8 * knockV[i]) * dt; // ressort rebondissant
        knock[i] += knockV[i] * dt;
        if (flash[i] > 0) flash[i] = Math.max(0, flash[i] - dt * 3.5);
      }

      // Ressort propre au badge "98" (même physique, indépendant)
      badgeKnockV += (-175 * badgeKnock - 8 * badgeKnockV) * dt;
      badgeKnock += badgeKnockV * dt;
      if (badgeFlash > 0) badgeFlash = Math.max(0, badgeFlash - dt * 3.5);

      // ponte périodique, seulement une fois l'aigle posé en idle
      if (elapsed > EAGLE_IN + 0.3) {
        nextEggAt -= dt;
        if (nextEggAt <= 0) {
          layEgg();
          nextEggAt = 3 + Math.random() * 4; // prochaine ponte dans 3–7 s
        }
      }

      ctx!.save();
      ctx!.clearRect(0, 0, cssW, cssH);
      drawBackdrop(elapsed);
      ctx!.translate(sx, sy);
      drawEagle(elapsed);
      updateAndDrawEggs(dt);
      drawTitle(elapsed);
      updateAndDrawShards(dt);  // éclats de coquille par-dessus le titre
      ctx!.restore();
      drawVignette();

      if (!revealedRef.current && elapsed >= MENU_AT) {
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
