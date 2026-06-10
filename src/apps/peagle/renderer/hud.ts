import { W, HUD_H } from "../engine/constants";
import { BALANCE } from "../engine/balance";
import { getActiveBall } from "../engine/assets";
import type { BallStyle } from "../engine/assets";
import type { GameState } from "../engine/types";
import type { GameTheme, PegTheme } from "../engine/game-theme";
import type { PayoutLine } from "../engine/payout";
import { isClutchActive } from "../engine/clutch";
import { ROLE } from "../engine/palette";
import { getFaceMood, gameFaceCtx } from "./face";
import { cornerHighlightL, chunkPlate, alpha, pixelGlow3, roundGlowRect } from "./helpers";
import {
  // Rendu de base + encres.
  DMD_AMBER, DMD_HOT, DMD_BLUE, DMD_ORANGE, DMD_GOLD, blitGrid, decayUntouched, getBuffer,
  GLYPH_ROWS, textCols, type DmdInk, type DotBuffer,
  // Sprites.
  eagleBigDots, EAGLE_BIG_W, EAGLE_BIG_H, type DmdFace,
  // Bandes persistantes (idle/score) + scènes + layout.
  beginBand, bandText, bandMatrix, endBand,
  computeLayout, SceneDirector, type ScreenLayout, type SceneDef,
  SCENE_PRIO, FROZEN_SCENES,
  streakScene, frenzyScene, clutchScene,
  jackpotScene, recordScene, levelWonScene, gameOverScene,
  drawDemo, type DemoMood,
} from "./dmd/index";
// Fonte pixel 5×5 « Press Start 2P » dédiée au HUD (inserts/boutons) — voir dmd/font-pixel.ts.
// Volontairement une fonte-DONNÉE (tableau de pixels) blittée en fillRect, SANS ctx.font :
// zéro dépendance au moteur de texte du navigateur → portable tel quel (Lua/natif).
// Primitives du peg-bouton canvas — SOURCE UNIQUE partagée avec les boutons d'écran
// (menu/pause/game over). La plaque, le texte gravé et les fontes vivent désormais
// dans renderer/ui/peg-button.ts ; le HUD les réutilise tels quels (zéro duplication).
import {
  pegPlate, pegText, pegTextWidth, PEG_INK, FONT_SMALL,
} from "./ui/peg-button";

// Phase de bruit plasma, dérivée de performance.now() pour rester cohérente avec le HUD.
function noisePhase(): number {
  return performance.now() / 700;
}

// ─── HUD in-canvas — « Plateau d'inserts + DMD héros » ───────────────────────
//
// On a abandonné le caisson backglass monolithique : le HUD est désormais un
// PLATEAU D'INSERTS chunky éclatés posés sur le ciel, avec UN DMD héros au centre.
//
//   ┌─────────────────────────────────────────────────────────────────┐
//   │ ╭──────╮   ╭─────────────────────────────────────╮   ╭────╮╭────╮ │
//   │ │ 🟠×11│   │░░░░░░░░░░░░░░░ DMD ░░░░░░░░░░░░░░░░░░░│   │ ⚡ ││ ❚❚ │ │
//   │ │TARGTS│   │░  SCORE     12845    + scènes      ░│   ╰────╯╰────╯ │
//   │ ╰──────╯   │░                                   ░│   ╭──────────╮ │
//   │ ╭──────╮   │░   (scènes plein-DMD sur events)   ░│   │   LVL    │ │
//   │ │ 🥚×3 │   │░                                   ░│   │    3     │ │
//   │ │ EGGS │   ╰─────────────────────────────────────╯   ╰──────────╯ │
//   │ ╰──────╯                                                          │
//   └──────────────────────────────────────────────────────────────────┘
//
// • INSERTS (2 colonnes G/D) : chaque info vit dans sa propre plaque chunky qui
//   « s'allume » sur son event (glow + bevel chaud + pop), façon insert de flipper.
//     CIBLES (haut-G) · EGGS (bas-G) affichent « sprite ×N » (un seul peg/œuf + compteur).
//     Colonne droite : CONTRÔLES power + pause côte à côte (haut), puis LVL (bas).
//     Le MULT a été retiré (déjà affiché dans le verre DMD) ; le DMD récupère toute
//     la largeur de l'ancienne colonne contrôles.
// • DMD HÉROS (centre) : UN seul grand verre plasma. Au repos = SCORE en gros dots
//   + aigle ; sur event = le SceneDirector joue la scène en PLEIN verre. Tout le
//   moteur de scènes (combo/jackpot/clutch/gameOver…) est conservé tel quel.
// • PAUSE : pastille chunky isolée, hors du verre (libère toute la largeur du DMD).
// La DA reste 100% chunky : chunkPlate + cornerHighlightL + sprites œuf/peg réutilisés.

// Géométrie (espace canvas). HUD_H=72 → plateau 65px de haut.
const HX = 6, HW = W - 12;
const PLATE_Y = 4;
const PLATE_H = HUD_H - 7;                     // hauteur du plateau (= 65)

// — Deux colonnes d'inserts (gauche/droite), les CONTRÔLES logés sous l'insert LVL —
const INS_GAP = 5;                             // gouttière entre inserts
const COL_W = 62;                              // largeur d'une colonne d'inserts
const INS_H = Math.floor((PLATE_H - INS_GAP) / 2);   // hauteur d'un insert (2 par colonne)
const INS_TOP_Y = PLATE_Y;                     // rangée haute d'inserts
const INS_BOT_Y = PLATE_Y + INS_H + INS_GAP;   // rangée basse d'inserts

// Colonnes d'inserts : gauche au bord, droite collée au bord droit du plateau.
const COL_L_X = HX;
const COL_R_X = HX + HW - COL_W;

// CONTRÔLES (pause + power) : logés CÔTE À CÔTE dans la rangée HAUTE de la colonne
// droite (au-dessus de l'insert LVL). La colonne contrôles dédiée a disparu → le DMD
// récupère toute cette largeur.
const CTRL_GAP = 4;                            // gouttière entre les deux pastilles
const CTRL_W = Math.floor((COL_W - CTRL_GAP) / 2);   // largeur d'une pastille
const CTRL_H = INS_H;                          // pleine hauteur de la rangée haute
// Power / super-tir (gauche) — exportée pour le hit-test futur (bouton encore inactif).
export const POWER_HIT = { x: COL_R_X, y: INS_TOP_Y, w: CTRL_W, h: CTRL_H } as const;
// Pause (droite) — exportée pour le hit-test (cf. useGameLoop).
export const PAUSE_HIT = { x: COL_R_X + CTRL_W + CTRL_GAP, y: INS_TOP_Y, w: CTRL_W, h: CTRL_H } as const;

// DMD héros : grand verre central, entre les deux colonnes d'inserts.
const DMD_X = COL_L_X + COL_W + INS_GAP;
const DMD_W = COL_R_X - INS_GAP - DMD_X;
const DMD_Y = PLATE_Y + 2;
const DMD_H = PLATE_H - 4;                      // pleine hauteur du plateau (gros verre héros)

// Couleurs de texte du HUD — dérivées des rôles « Bosquet » (plus de hex arcade en dur).
const INK = {
  cream: ROLE.cream, label: ROLE.leaf, green: ROLE.accentHi,
  orange: ROLE.orange, warn: ROLE.gold, dim: ROLE.leafDim,
} as const;

// Palette de l'enseigne chunky — alignée sur les PEGS du menu OPTIONS (`.pg-pm-btn`,
// cf. PegBtn) : bloc VERT VIF plein (`--pg-green` = ROLE.accent), arête claire haut/gauche
// (`--pg-green-hi` = accentHi) + arête sombre bas/droite (`--pg-green-deep` = accentDeep),
// contour `ink` net + ombre dure portée. Plus de surface sombre translucide : les plaques
// du HUD sont désormais des pegs verts vifs, exactement comme les boutons du menu.
const PLATE = {
  fill: ROLE.accent, light: ROLE.accentHi,
  dark: ROLE.accentDeep, outline: ROLE.ink,
  sep: alpha(ROLE.ink, 0.55), sepHi: alpha(ROLE.bevelHi, 0.30),
} as const;

// (PEG_INK — encre sombre du peg — est désormais importée de ui/peg-button.ts.)

// Ombre dure portée (le « 4px 4px » des cartes/pegs du menu OPTIONS) : un décalage net
// sombre sous la plaque pour la faire « flotter » posée sur le ciel. (x,y,w,h) = boîte.
const DROP = alpha(ROLE.ink, 0.78);
function dropShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, off = 3): void {
  ctx.fillStyle = DROP;
  roundGlowRect(ctx, x + off, y + off, w, h);
}

// Mélange OPAQUE de deux hex — pour dériver les bevels d'un peg allumé (clair = +blanc,
// sombre = +ink) sans recourir à des alphas. `t` = dose de `b` (0 = a pur, 1 = b pur).
function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    let s = h.replace("#", "");
    if (s.length === 3) s = s[0]! + s[0]! + s[1]! + s[1]! + s[2]! + s[2]!;
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
}

// (pegPlate — la plaque pixel du peg — est désormais importée de ui/peg-button.ts.)

// ── Score ticker + pop animation (module-level pour persister entre les frames) ──
let _displayedScore = -1;   // score affiché (monte vers s.score par ticker)
let _scorePop = 0;          // 0→1 au déclenchement, décroît vers 0 (spring-pop)

// ── Compteurs « bleu × orange » du verre score : pop+glow à chaque hausse (live) ──
let _prevTurnBlue = -1, _bluePop = 0;       // pop du compteur bleu (peg normal touché)
let _prevTurnOrange = -1, _orangePop = 0;   // pop du compteur orange (cible touchée)

// ── Jauges animées des lanes (Phase 4) : feedback immédiat sur chaque event ──
let _prevLevel = -1, _lvlPop = 0;             // niveau : pop + flash au changement
let _prevHit = -1;                            // cibles : index du dernier pip tombé
const _targetPop: number[] = [];              // pop décroissant par pip de cible tombée

// ── DmdDirector : machine à scènes cinématique du DMD (façon flipper) ─────────
// Le DMD a deux régimes : IDLE (score + aigle) et SCÈNE (un event prioritaire prend
// le verre, joue une mini-animation déclarative — cf. dmd/scenes.ts —, puis rend la
// main). Le `SceneDirector` du moteur gère la priorité/transition/sortie ; ICI on se
// contente de DÉTECTER les fronts montants du GameState et de pousser la bonne scène.
const _director = new SceneDirector();
let _dmdPulse = 0;          // 0→1 pulse global de brillance (gros event)

// ── Flash du CADRE du DMD à chaque peg touché (juicy) ────────────────────────
// Front montant de s.lastHitClock → le bezel du DMD s'illumine brièvement, teinté
// par la nature du peg : VERT (peg normal) / ORANGE (cible). `_hitFlash` décroît
// 1→0 ; `_hitFlashOrange` mémorise la couleur du dernier hit.
let _prevHitClock = -999;
let _hitFlash = 0;
let _hitFlashOrange = false;

// Pousse une scène via le directeur (front montant à la charge de l'appelant).
function play(name: string, def: SceneDef): void {
  _director.play(name, def, SCENE_PRIO[name as keyof typeof SCENE_PRIO] ?? 0);
  _dmdPulse = 1;
}

// GameState courant, posé par drawBackglass pour que le verre SCORE lise les
// compteurs bleu/orange du tour (évite de threader `s` dans tout le chemin de rendu).
let _scoreState: GameState | null = null;

// Pop du TOTAL au versement de fin de tour : le score encaisse le produit bleu×orange
// d'un coup → on déclenche un pop juicy quand _displayedScore rattrape une hausse.
let _totalPop = 0;

// Fronts montants suivis frame-à-frame pour la détection par polling.
let _prevCombo = -1, _prevStreak = -1, _prevBucketFlash = 0,
    _prevBumperChain = -1, _prevLevelWonAt = 0, _prevLostAt = 0, _prevPhase = "";
// Fronts du clutch (entrée en fever) et du record (best-score battu en jeu).
let _prevClutch = false, _prevNewRecord = false;
// Versement de fin de tour : front montant de s.payoutAt. Les BONUS du versement sont
// affichés brièvement à la place du « bleu × orange » dans le verre score (_payoutShow
// décroît 1→0). Pas de scène plein écran : le verre score reste visible.
// Après les bonus, on montre le RÉSULTAT de la multiplication du tour (« = total »)
// avant qu'il ne se cumule au score global via le ticker du bas.
let _prevPayoutAt = 0;
let _payoutBonuses: PayoutLine[] = [];
let _payoutShow = 0;
let _payoutSlice = -1;  // tranche de bonus affichée (suivi pour relancer le pop à chaque changement)
let _payoutPop = 0;     // pop élastique 1→0 (apparition d'une tranche / du résultat)
// Versement en deux temps, façon « count-up » classique de JV :
//   • HOLD : le haut montre le RÉSULTAT entier, le total du bas est gelé (_payoutHold true).
//   • TRANSFERT : le bas se débloque ; le restant en haut se vide pendant que le bas monte.
let _payoutActive = false;  // versement en cours (du HOLD jusqu'à la fin du transfert)
let _payoutHold = 0;        // temps de pause AVANT le transfert (1→0) ; le ticker du bas est gelé tant que >0
let _payoutRemaining = 0;   // points restant à verser = s.score − total affiché en bas (se vide → 0)
let _revivePop = 0;         // pop de réveil quand « vert × orange » revient après le versement

// ── Bus audio du count-up (renderer → React) ─────────────────────────────────
// Le count-up vit ENTIÈREMENT dans le renderer (variables ci-dessus), hors moteur/events.
// Pour le sonoriser sans React ni toucher au moteur, on POUSSE des cues ici ; useGameLoop
// les DRAINE après drawFrame et les joue (cf. drainCountupCues / usePeagleSounds).
//   • "tick:<p>"   — égrènement pendant le transfert, p∈[0,1] = progression (pitch qui monte)
//   • "finish"     — clac final quand « vert × orange » revient
export type CountupCue = string;
const _countupCues: CountupCue[] = [];
let _payoutSpan = 0;        // total à verser, figé au début du transfert (pour la progression du pitch)
let _payoutTick = 0;        // compteur de frames de transfert → cadence le BATTEMENT du pop
// Durée du remplissage : proportionnelle au total mais bornée → rapide. À 60 fps :
// PAY_MIN_FRAMES ≈ 0.1s (petit gain), PAY_MAX_FRAMES ≈ 0.67s (gros gain). PAY_PTS_PER_FRAME
// fixe la pente entre les deux (≈ combien de points « défilent » par frame en régime normal).
const PAY_MIN_FRAMES = 6;
const PAY_MAX_FRAMES = 40;
const PAY_PTS_PER_FRAME = 60;

// Vidé chaque frame par useGameLoop pour jouer les sons du count-up.
export function drainCountupCues(): CountupCue[] {
  if (_countupCues.length === 0) return _EMPTY_CUES;
  const out = _countupCues.slice();
  _countupCues.length = 0;
  return out;
}
const _EMPTY_CUES: CountupCue[] = [];

// Meilleur score courant — alimente la carte BEST de la démo-scène (verre juicy).
let _attractBest = 0;

// L'expression d'aigle courante (posée chaque frame pour les scènes qui en ont besoin).
let _faceForScene: DmdFace = { brow: "flat", open: 0, blink: false, star: false, wide: false, look: 0 };

// easeOutBack locale — même recette que effects.ts, c1 doux pour le HUD.
function hudEob(x: number): number {
  const c1 = 2.8, c3 = c1 + 1, p = x - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}


// ── Caches dépendants du contexte (invalidés quand le canvas change) ──
let _gradCtx: CanvasRenderingContext2D | null = null;

function ensureHudGrads(ctx: CanvasRenderingContext2D): void {
  if (_gradCtx === ctx) return;
  _gradCtx = ctx;
  _dmdVignetteCache.clear();   // les gradients de vignette dépendent du contexte
}

// Vignette de verre du DMD : un dégradé radial sombre par taille de dalle (w×h),
// caché dans une Map (même esprit que _gridSprites), invalidé si le contexte change.
const _dmdVignetteCache = new Map<string, CanvasGradient>();

function dmdVignetteFor(ctx: CanvasRenderingContext2D, w: number, h: number): CanvasGradient {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  let g = _dmdVignetteCache.get(key);
  if (!g) {
    // Radial centré, transparent au cœur → sombre aux coins (cuvette de verre).
    const cx = w / 2, cy = h / 2, r = Math.hypot(w, h) / 2;
    g = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
    g.addColorStop(0, alpha(ROLE.ink, 0));
    g.addColorStop(1, alpha(ROLE.ink, 0.38));
    _dmdVignetteCache.set(key, g);
  }
  return g;
}

// ── Sprites réutilisés (mêmes recettes que ball.ts / pegs.ts) ────────────────

function eggSprite(ctx: CanvasRenderingContext2D, cx: number, cy: number, st: BallStyle, r: number): void {
  const bx = Math.round(cx), by = Math.round(cy);
  ctx.fillStyle = st.body;
  ctx.fillRect(bx - r + 1, by - r, r * 2 - 2, r * 2);
  ctx.fillRect(bx - r, by - r + 1, r * 2, r * 2 - 2);
  ctx.fillStyle = "#ffffff";          // reflet pur — langage signature (non tokenisé)
  ctx.fillRect(bx - r + 1, by - r, r * 2 - 2, 1);
  ctx.fillRect(bx - r, by - r + 1, 1, r * 2 - 2);
  ctx.fillStyle = alpha(ROLE.ink, 0.5);
  ctx.fillRect(bx - r + 1, by + r - 1, r * 2 - 2, 1);
  ctx.fillRect(bx + r - 1, by - r + 1, 1, r * 2 - 2);
  cornerHighlightL(ctx, bx - r, by - r, 0.9);
}

// Peg orange du HUD — mêmes coins arrondis 1px que les pegs du jeu (cf. renderer/pegs.ts
// pixelRoundBody) : corps = union d'un rect vertical + un rect horizontal, bevel rogné.
// `lit` = cible encore à toucher (brillante) ; éteinte → gris sunken (drop-target tombée).
function pegSprite(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  t: PegTheme, clutch: boolean, lit = true,
): void {
  const s = Math.round(r * 2), x = Math.round(cx - r), y = Math.round(cy - r);
  const fill = !lit ? alpha(ROLE.surface2, 0.85) : clutch ? t.orangeClutch : t.orange;
  const hi   = !lit ? alpha(ROLE.bevelHi, 0.45)  : clutch ? t.orangeGlow : t.orangeHi;
  const dk   = !lit ? alpha(ROLE.ink, 0.7)       : t.orangeDark;
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y, s - 2, s);     // colonne centrale (pleine hauteur)
  ctx.fillRect(x, y + 1, s, s - 2);     // ligne centrale (pleine largeur)
  // Drop-target tombée : bevel inversé (sunken) ; cible vive : bevel relevé.
  if (lit) {
    ctx.fillStyle = hi;
    ctx.fillRect(x + 1, y, s - 2, 1); ctx.fillRect(x, y + 1, 1, s - 2);
    ctx.fillStyle = dk;
    ctx.fillRect(x + 1, y + s - 1, s - 2, 1); ctx.fillRect(x + s - 1, y + 1, 1, s - 2);
    cornerHighlightL(ctx, x, y);
  } else {
    ctx.fillStyle = dk;
    ctx.fillRect(x + 1, y, s - 2, 1); ctx.fillRect(x, y + 1, 1, s - 2);
    ctx.fillStyle = hi;
    ctx.fillRect(x + 1, y + s - 1, s - 2, 1); ctx.fillRect(x + s - 1, y + 1, 1, s - 2);
  }
}

// ── Texte ─────────────────────────────────────────────────────────────────────
// Tout le texte des plaques passe désormais par `pegText` (encre gravée sur peg vert,
// cf. plus bas) — le texte « clair à contour sombre » (value/label) n'a plus lieu d'être
// puisque les plaques sont des pegs lumineux, pas des caissons sombres sur le ciel.

// (BitmapFont, FONT_BIG/SMALL, pegTextWidth et pegText sont désormais importés de
//  ui/peg-button.ts — source unique partagée avec les boutons d'écran.)

function fmt(n: number): string {
  // Locale FIXE (en-US) → séparateur de milliers = virgule, jamais un espace insécable
  // (qui, selon la locale du navigateur, créerait un trou invisible dans le nombre DMD).
  return n >= 100000 ? `${Math.floor(n / 1000)}k` : n.toLocaleString("en-US");
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  orangeLeft: number,
  orangeTotal: number,
  theme: GameTheme,
  bestScore = 0,
  isNewRecord = false,
): void {
  const inClutch = isClutchActive(s);
  const lowBalls = s.balls > 0 && s.balls <= 2;
  const egg = getActiveBall();
  const face = getFaceMood(gameFaceCtx(s));

  // ── Ticker + pop du score ──
  // Le score n'augmente plus qu'en fin de tour (versement du produit bleu×orange),
  // d'un seul coup → on déclenche un pop juicy plus appuyé sur le TOTAL à ce moment.
  if (_displayedScore < 0 || s.score < _displayedScore) {
    _displayedScore = s.score; _scorePop = 0; _totalPop = 0;
  }
  _scorePop = Math.max(0, _scorePop - 0.07);
  _totalPop = Math.max(0, _totalPop - 0.045);   // décroît plus lentement (versement marquant)
  // Le total du bas ne monte PAS pendant le HOLD (le haut montre d'abord le résultat entier).
  // Une fois le HOLD écoulé, on transfère : le bas grimpe vers s.score, le haut se vide en miroir.
  if (_displayedScore < s.score && _payoutHold <= 0) {
    const d = s.score - _displayedScore;
    // _payoutSpan = total à verser, figé au début du transfert.
    if (_payoutSpan <= 0) _payoutSpan = d;
    // Remplissage à VITESSE LINÉAIRE proportionnelle au total : on vise une durée bornée
    // (PAY_MIN_FRAMES pour un petit gain → PAY_MAX_FRAMES pour un gros). Plus il y a de points,
    // plus le compteur tourne longtemps — mais ça reste rapide (≤ ~0.7s) et toujours proportionnel.
    const frames = Math.max(PAY_MIN_FRAMES, Math.min(PAY_MAX_FRAMES, _payoutSpan / PAY_PTS_PER_FRAME));
    const stepPerFrame = Math.max(1, Math.ceil(_payoutSpan / frames));
    _displayedScore = Math.min(s.score, _displayedScore + stepPerFrame);
    // BATTEMENT juicy : le pop ne reste pas plat, il PULSE par à-coups (re-boost tous les
    // ~3 frames) → le nombre « tape » au rythme des pièces qui rentrent au lieu de gonfler une
    // fois. Entre deux pics, _totalPop redescend (décroissance en haut de drawHud) : ça respire.
    _payoutTick++;
    if (_payoutTick % 3 === 0) { _totalPop = 0.75; _scorePop = Math.max(_scorePop, 0.6); }
    else _totalPop = Math.max(_totalPop, 0.25);   // plancher pour garder un peu de tenue
    // Égrènement sonore : boucle « pièces » ultra-rapide (un tick CHAQUE frame), pitch qui
    // MONTE avec la progression → brrrr de comptage classique. Voir playCountTick.
    const prog = _payoutSpan > 0 ? 1 - d / _payoutSpan : 1;   // 0 au début → 1 à la fin
    _countupCues.push(`tick:${prog.toFixed(3)}`);
  } else {
    _payoutTick = 0;
  }

  // ── Pop live des compteurs bleu/orange (verre score) ──
  // Hausse de turnBluePts (peg bleu) ou turnOrangeCount (cible) → pop élastique sur
  // le nombre concerné. Reset au début d'un tir (les compteurs retombent à 0).
  if (_prevTurnBlue >= 0 && s.turnBluePts > _prevTurnBlue) _bluePop = 1;
  _prevTurnBlue = s.turnBluePts;
  _bluePop = Math.max(0, _bluePop - 0.07);
  if (_prevTurnOrange >= 0 && s.turnOrangeCount > _prevTurnOrange) _orangePop = 1;
  _prevTurnOrange = s.turnOrangeCount;
  _orangePop = Math.max(0, _orangePop - 0.06);

  // ── Jauges animées des lanes : détection des fronts + décroissances (Phase 4) ──
  if (_prevLevel >= 0 && s.level !== _prevLevel) _lvlPop = 1;
  _prevLevel = s.level;
  _lvlPop = Math.max(0, _lvlPop - 0.05);

  // Cible tombée : front montant de `hit` → pop décroissant sur le pip concerné.
  const _total = Math.max(orangeTotal, orangeLeft);
  const _hit = Math.max(0, _total - orangeLeft);
  if (_prevHit >= 0 && _hit > _prevHit) {
    for (let i = _prevHit; i < _hit; i++) _targetPop[i] = 1;
  }
  if (_hit < _prevHit || _prevHit < 0) _targetPop.length = 0;   // reset (nouveau niveau)
  _prevHit = _hit;
  for (let i = 0; i < _targetPop.length; i++)
    if (_targetPop[i]) _targetPop[i] = Math.max(0, _targetPop[i]! - 0.06);

  // Expression d'aigle courante (DMD) → posée pour les scènes qui en ont besoin.
  _faceForScene = toDmdFace(face);

  // ── DmdDirector : détection des moments forts par POLLING de fronts montants ──
  // Ordre de priorité décroissante ; le directeur tranche les collisions de la frame
  // (la scène la plus prioritaire l'emporte). Chaque event pousse une SCÈNE déclarative
  // (cf. dmd/scenes.ts) plutôt qu'un blob de paramètres impératifs.
  if (s.lostAt > 0 && s.lostAt !== _prevLostAt) play("gameOver", gameOverScene(_faceForScene));
  _prevLostAt = s.lostAt;

  // Versement de fin de tour : front montant de s.payoutAt. Pas de scène plein écran —
  // le verre SCORE reste visible. Le « count-up » classique de JV se joue dans la bande HAUTE :
  //   1) BONUS (s'il y en a) : défilement bref des bonus (œufs, tableau vide…) sur _payoutShow.
  //   2) HOLD : le RÉSULTAT entier s'affiche en haut, calmement ; le total du bas est GELÉ.
  //   3) TRANSFERT : le total du bas grimpe vers s.score et le restant en haut se vide en miroir
  //      (synchronisés sur le même ticker) — on « verse » le haut dans le bas.
  if (s.payoutAt > 0 && s.payoutAt !== _prevPayoutAt && s.lastPayout) {
    _payoutBonuses = s.lastPayout.lines.filter(l => l.kind === "bonus");
    _payoutShow = _payoutBonuses.length > 0 ? 1 : 0;   // phase bonus seulement s'il y en a
    _payoutSlice = -1;   // force un pop sur la première tranche
    _payoutActive = true;
    _payoutHold = 1;     // ~0.6s de pause sur le résultat entier avant de le déverser vers le bas
  }
  _prevPayoutAt = s.payoutAt;

  _payoutShow = Math.max(0, _payoutShow - 0.012);   // ~1.4s pour faire défiler les bonus
  _payoutPop = Math.max(0, _payoutPop - 0.05);       // ~0.33s de pop d'apparition
  // Le HOLD ne s'écoule qu'une fois les bonus passés → le résultat reste affiché entier ~0.6s,
  // puis le transfert démarre (le ticker du bas est gelé tant que _payoutHold > 0, cf. plus haut).
  if (_payoutShow <= 0) _payoutHold = Math.max(0, _payoutHold - 0.028);

  // RESTANT À VERSER : ce qui n'est pas encore monté dans le total du bas. Le haut l'affiche
  // pendant le HOLD (entier) puis le transfert (décroît → 0). Le versement se termine quand les
  // bonus sont passés, le HOLD écoulé, et le ticker a rattrapé le score.
  _payoutRemaining = Math.max(0, s.score - Math.round(_displayedScore));
  if (_payoutActive && _payoutShow <= 0 && _payoutHold <= 0 && _payoutRemaining <= 0) {
    _payoutActive = false;
    _revivePop = 1;   // le « vert × orange » revient → petit pop de réveil (cf. drawBlueTimesOrange)
    _payoutSpan = 0;  // prêt pour le prochain versement
    _payoutTick = 0;
    _totalPop = 1; _scorePop = 1;        // GROS pop final sur le total → la récompense « claque »
    _countupCues.push("finish");         // clac final synchro avec le réveil visuel
  }
  _revivePop = Math.max(0, _revivePop - 0.06);   // ~0.28s

  if (s.levelWonAt > 0 && s.levelWonAt !== _prevLevelWonAt)
    play("levelWon", levelWonScene(_faceForScene, s.level));
  _prevLevelWonAt = s.levelWonAt;

  // Record : le score LIVE franchit le meilleur score connu, en cours de partie.
  const liveRecord = (bestScore > 0 && s.score > bestScore) || isNewRecord;
  if (liveRecord && !_prevNewRecord && s.phase !== "lost" && s.phase !== "won")
    play("record", recordScene(_faceForScene, fmt(Math.max(s.score, bestScore))));
  _prevNewRecord = liveRecord;

  // Jackpot : front montant de bucketFlash quand le tableau orange est vidé.
  if (s.bucketFlash === 1 && _prevBucketFlash !== 1 && s.orangeLeft === 0)
    play("jackpot", jackpotScene());
  _prevBucketFlash = s.bucketFlash;

  // Clutch : front montant de l'entrée en fever (dernière proie).
  if (inClutch && !_prevClutch && s.phase !== "lost")
    play("clutch", clutchScene(_faceForScene));
  _prevClutch = inClutch;

  // Bumper frenzy : 3e bumper d'un même tir.
  if (s.bumperChainShot === 3 && _prevBumperChain !== 3) play("frenzy", frenzyScene("FRENZY!"));
  _prevBumperChain = s.bumperChainShot;

  // Série de paniers (≥2 = qualifiante).
  if (s.bucketStreak >= 2 && s.bucketStreak > _prevStreak)
    play("streak", streakScene(s.bucketStreak));
  _prevStreak = s.bucketStreak;

  // Combo : on n'affiche PLUS de mot dans le DMD — juste un pulse de brillance à
  // chaque peg touché (le verre reste sur le score). Les mots « hype » vivent encore
  // sur le playfield (HypeText près des pegs), pas dans le verre.
  if (s.combo > _prevCombo) _dmdPulse = Math.max(_dmdPulse, 0.5);
  _prevCombo = s.combo;

  // Flash du cadre DMD : front montant de lastHitClock (un peg vient d'être touché).
  // Couleur = nature du peg (orange = cible). Effet juicy : pop net qui retombe vite.
  if (s.lastHitClock !== _prevHitClock && s.lastHitClock > -999) {
    _hitFlash = 1;
    _hitFlashOrange = s.lastHitWasOrange;
  }
  _prevHitClock = s.lastHitClock;
  _hitFlash = Math.max(0, _hitFlash - 0.075);  // ~0.22s de flash (juicy, claque puis s'éteint)

  // Reset propre vers idle au début d'un nouveau tour/niveau (gameOver reste figé).
  if (s.phase === "aim" && _prevPhase !== "aim" && _director.current !== "gameOver" && s.combo === 0)
    _director.reset();
  _prevPhase = s.phase;

  // Meilleur score courant → carte BEST de la démo-scène du verre juicy.
  _attractBest = bestScore;

  _dmdPulse = Math.max(0, _dmdPulse - 0.05);

  ensureHudGrads(ctx);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // ── CLIP GLOBAL anti-débordement : tout le HUD (glow, scènes, inserts, anneau
  //    fever) est borné à la bande du plateau → rien ne peut baver sur le playfield.
  //    Marge de 4px pour laisser respirer le glow/anneau sans atteindre la zone de jeu.
  ctx.beginPath();
  ctx.rect(HX - 4, PLATE_Y - 4, HW + 8, PLATE_H + 8);
  ctx.clip();

  // Plus de caisson monolithique : chaque insert + le DMD portent leur propre plaque
  // chunky. Le plateau est donc « éclaté », posé directement sur le ciel.

  // ════════════ DMD HÉROS (centre) ════════════
  drawBackglass(ctx, s, inClutch, face);

  // ════════════ INSERTS (2 colonnes G/D) + colonne contrôles ════════════
  drawInserts(ctx, s, orangeLeft, orangeTotal, inClutch, lowBalls, egg, theme);
  pauseButton(ctx);
  powerButton(ctx);   // super-tir — placeholder inactif (câblage à venir)

  ctx.restore();

  // Afterglow : éteint proprement la traîne des bandes persistantes non composées
  // cette frame (aigle idle masqué par une scène, etc.) → pas de ghost au retour.
  decayUntouched();
}

// ── DMD HÉROS : UN seul grand verre central ──────────────────────────────────
//   • Au repos  : le verre SCORE (« 🔵Bleu × 🟠Orange » en haut, TOTAL cumulé en bas).
//   • Sur event : le SceneDirector joue la scène en PLEIN verre (combo/streak/frenzy/
//     clutch/jackpot/record/levelWon/gameOver) — toutes en fullTakeover désormais.
// Plus de split juicy/score : le verre est unique et héros, l'aigle/la démo vivent
// dans les SCÈNES (qui prennent tout le verre) plutôt que dans un demi-verre permanent.
function drawBackglass(
  ctx: CanvasRenderingContext2D, s: GameState,
  inClutch: boolean,
  face: ReturnType<typeof getFaceMood>,
): void {
  _scoreState = s;
  // Une scène joue ? → verre plein dédié à la scène. Sinon → idle = verre SCORE.
  const role: DmdRole = _director.current !== null ? "scene" : "score";
  drawDmd(ctx, DMD_X, DMD_Y, DMD_W, DMD_H, inClutch, face, role);
}

// ── UN VERRE DMD ─────────────────────────────────────────────────────────────
// Caisson sunken noir + trame de dots éteints (blittée) + contenu allumé. Le rôle
// pilote le contenu : "juicy" (aigle/scènes légères), "score" (bleu×orange + total),
// "scene" (gros event plein largeur). Chrome de backglass autour (glow, vis, reflet).
type DmdRole = "juicy" | "score" | "scene";
function drawDmd(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  inClutch: boolean, face: ReturnType<typeof getFaceMood>, role: DmdRole,
): void {
  const ink = inClutch ? DMD_HOT : DMD_AMBER;
  const feverBreath = inClutch ? 0.12 * (0.5 + 0.5 * Math.sin(performance.now() / 120)) : 0;
  const intensity = Math.min(1, 0.9 + _dmdPulse * 0.4 + feverBreath);

  // — Chrome : glow ambre irradiant DERRIÈRE le verre (il « fuit » sa lumière) —
  // Respiration lente décorrélée (l'écran « vit » même au repos, jamais statique).
  const breath = 1 + 0.10 * Math.sin(performance.now() / 900);
  pixelGlow3(ctx, x, y, w, h, ink.glow, inClutch ? 6 : 4,
    inClutch ? [0.20, 0.10, 0.05] : [0.13 * breath, 0.07 * breath, 0.03 * breath]);

  // — Ombre dure portée (DA carte OPTIONS) : le verre flotte posé sur le ciel, comme
  //   les inserts. Posée APRÈS le glow (qui irradie, lui, tout autour) pour rester nette.
  dropShadow(ctx, x, y, w, h);

  // — Le verre + son contenu, sur DEUX ÉTAGES —
  drawDmdScreen(ctx, x, y, w, h, ink, (lay) => {
    if (role === "score") {
      // Verre SCORE : compteurs bleu×orange (haut) + total (bas). Jamais de scène.
      drawScoreGlass(ctx, _scoreState!, lay, ink, intensity);
    } else if (role === "scene") {
      // Verre plein-largeur dédié à une scène plein écran (jackpot/record/levelWon/gameOver).
      renderSceneOrIdle(ctx, lay, ink, intensity, face, "scene");
    } else {
      // Verre JUICY : démo-scène au repos, ou scène légère (combo/streak/frenzy/clutch).
      renderSceneOrIdle(ctx, lay, ink, intensity, face, "juicy");
    }
  });

  // (Vis & liseré de caisson retirés : le bezel relevé opaque de `drawDmdScreen` porte
  //  désormais le relief — même DA « carte OPTIONS » que les inserts, sans studs métal.)

  // — Anneau d'accent pulsant en fever : cadre lumineux 1px autour du verre —
  if (inClutch) {
    const p = 0.5 + 0.5 * Math.sin(performance.now() / 140);
    ctx.globalAlpha = 0.30 + 0.35 * p;
    ctx.fillStyle = ROLE.orangeGlow;
    frameRect(ctx, x - 1, y - 1, w + 2, h + 2, 1);
    ctx.globalAlpha = 1;
  }

  // — Flash du CADRE seul à chaque peg touché (juicy) : seul le bezel s'illumine,
  //   teinté VERT (peg normal) / ORANGE (cible) — l'écran intérieur n'est pas touché.
  //   Un seul flash par peg (front de lastHitClock) → claque puis s'éteint.
  if (_hitFlash > 0) {
    // Enveloppe MONOTONE décroissante (pas d'easeOutBack ici : son overshoot rendait
    // un double-flash). easeOutCubic → claque d'entrée puis décroît proprement, 1 fois.
    const f = Math.min(1, _hitFlash);
    const e = 1 - Math.pow(1 - f, 3);
    const glowCol = _hitFlashOrange ? ROLE.orangeGlow : ROLE.accentHi;
    ctx.fillStyle = glowCol;
    // 1) Halo en ANNEAUX concentriques VERS L'EXTÉRIEUR (faux flou) : des frameRect de
    //    plus en plus larges, jamais pleins → le centre (l'écran) reste intact.
    const rings = 3 + Math.round(e * 3);
    for (let i = 1; i <= rings; i++) {
      ctx.globalAlpha = (0.34 * e) * (1 - i / (rings + 1));
      frameRect(ctx, x - i, y - i, w + i * 2, h + i * 2, 1);
    }
    // 2) Liseré vif sur le bord du cadre (2px → 1px en retombant) : l'éclair net.
    ctx.globalAlpha = 0.45 + 0.5 * e;
    frameRect(ctx, x - 1, y - 1, w + 2, h + 2, e > 0.5 ? 2 : 1);
    ctx.globalAlpha = 1;
  }
}

// Cadre rectangulaire 1px aux coins ébréchés (roundStrokeRect n'accepte qu'un carré).
function frameRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lw: number,
): void {
  ctx.fillRect(x + 1, y, w - 2, lw);              // haut
  ctx.fillRect(x + 1, y + h - lw, w - 2, lw);     // bas
  ctx.fillRect(x, y + 1, lw, h - 2);              // gauche
  ctx.fillRect(x + w - lw, y + 1, lw, h - 2);     // droite
}

// Un verre DMD : caisson sunken + UNE grille de dots (DMD_ROWS_TOTAL rangées) dont la
// trame éteinte est blittée. Le contenu (idle/score/scène) reçoit le `ScreenLayout`
// calculé par le moteur — il y place ses dots via les bandes/scènes. Le verre est
// une grille UNIQUE : les deux « étages » de l'afficheur sont des régions (top/bot).
function drawDmdScreen(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  ink: DmdInk, content: (lay: ScreenLayout) => void,
): void {
  // — Bezel RELEVÉ opaque : VERT FONCÉ, exactement le fond du panneau OPTIONS
  //   (ROLE.surface) — le cadre du DMD n'est plus vert vif comme les inserts/boutons,
  //   mais sombre comme l'arrière-plan des options, pour faire « ressortir » l'écran.
  chunkPlate(ctx, x, y, w, h, {
    fill: ROLE.surface, light: ROLE.border, dark: ROLE.bevelLo,
    outline: ROLE.ink, highlightL: 0.3,
  });

  // — Écran plasma RECESSÉ dans le bezel : dalle sombre avec un bevel SUNKEN (inversé)
  //   → l'afficheur paraît creusé sous le cadre, comme un écran derrière sa vitre.
  const bez = 3;   // épaisseur du bezel relevé autour de l'écran
  const scX = x + bez, scY = y + bez, scW = w - bez * 2, scH = h - bez * 2;
  chunkPlate(ctx, scX, scY, scW, scH, {
    fill: ROLE.bgDeep, light: alpha(ROLE.bevelHi, 0.35), dark: alpha(ROLE.ink, 0.95),
    outline: alpha(ROLE.ink, 0.95), sunken: true, highlightL: false,
  });

  const padX = bez + 2, padY = bez + 1;
  const innerX = x + padX, innerY = y + padY;
  const innerW = w - padX * 2, innerH = h - padY * 2;
  const lay = computeLayout(innerX, innerY, innerW, innerH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();

  // Trame plasma blittée : une seule grille couvre tout le verre (les 2 bandes + gap).
  blitGrid(ctx, lay.geom, lay.cols, lay.rows, ink);

  content(lay);

  // — Verre : vignette de bord + reflet spéculaire qui balaie lentement.
  //   Pas de scanlines ici : le CrtOverlay DOM global les fournit pour tout le canvas.
  dmdGlassOverlay(ctx, innerX, innerY, innerW, innerH);

  ctx.restore();
}

// Hash déterministe 1-D → [0,1) : bruit pseudo-aléatoire reproductible à partir d'un
// entier (l'index du cycle de reflet). Pas d'état, pas de Math.random → stable.
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Reflet « sous verre » du DMD : assombrissement radial discret des bords (vignette)
// + un flash spéculaire diagonal qui ZÈBRE la dalle au hasard, peu souvent (gap long
// et irrégulier entre deux passages). Balayage net (position linéaire, inclinaison
// douce) + intensité en cloche (fade-in/out) → snap juicy d'ambiance.
function dmdGlassOverlay(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): void {
  // Vignette : dégradé radial sombre cuvé vers les bords (en espace local x,y).
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 1;
  ctx.fillStyle = dmdVignetteFor(ctx, w, h);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ── Flash spéculaire d'ambiance, au hasard mais espacé ──────────────────────
  // Temps découpé en cycles de durée VARIABLE (flash court + long gap pseudo-aléatoire).
  // On retrouve le cycle courant en cumulant les durées depuis t=0, puis on lit sa phase.
  const SHEEN_MS = 320;                       // durée de traversée d'un flash
  const GAP_MIN = 6000;                        // gap minimum après un flash (≥ 6 s → rare)
  const GAP_VAR = 8000;                        // amplitude aléatoire du gap (→ 6 s à 14 s)
  const now = performance.now();
  let cycleStart = 0, cycleIdx = 0;
  for (;;) {
    const dur = SHEEN_MS + GAP_MIN + hash01(cycleIdx) * GAP_VAR;
    if (cycleStart + dur > now) break;
    cycleStart += dur;
    cycleIdx++;
    if (cycleIdx > 100000) break;             // garde-fou
  }
  const local = now - cycleStart;             // ms écoulées dans le cycle courant
  if (local <= SHEEN_MS) {
    const p = local / SHEEN_MS;               // 0→1 progression du flash
    const sweep = p * 1.4 - 0.2;              // -0.2..1.2, position linéaire → UN seul passage net
    const bandX = x + sweep * w;
    // Intensité en cloche : fade-in puis fade-out (sin) → pas de coupure brutale.
    const bell = Math.sin(p * Math.PI);
    const bw = h * 0.5;                        // largeur de la bande
    const tilt = h * 0.3;                      // inclinaison douce (≪ h) → la bande traverse d'un bloc

    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.globalAlpha = 0.9 * bell;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(bandX, y);
    ctx.lineTo(bandX + bw, y);
    ctx.lineTo(bandX + bw - tilt, y + h);
    ctx.lineTo(bandX - tilt, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// Construit le sous-ensemble DmdFace à partir du FaceMood (mascotte → dots).
function toDmdFace(face: ReturnType<typeof getFaceMood>, over?: Partial<{ blink: boolean; star: boolean }>): DmdFace {
  return {
    brow: face.brow, open: face.open,
    blink: over?.blink ?? face.blink !== "none",
    star: over?.star ?? face.starEyes,
    wide: face.wide, look: face.look,
  };
}

// Bande BASSE : décalage de ligne (= bande "bot" du moteur).
const BOT_ROW = GLYPH_ROWS + 1;

// ── Pont director ↔ verre : joue la scène courante, sinon l'idle ──────────────
// Si le directeur a une scène en cours, on la rend (le moteur gère transition/sortie
// et redessine l'idle DERRIÈRE pendant le cross-fade de sortie). Sinon, idle/attract.
function renderSceneOrIdle(
  ctx: CanvasRenderingContext2D, lay: ScreenLayout,
  ink: DmdInk, intensity: number, face: ReturnType<typeof getFaceMood>,
  role: "juicy" | "scene",
): void {
  const phase = noisePhase();
  // Pendant le cross-fade de sortie, l'idle réapparaît derrière (le moteur renvoie
  // l'alpha de sortie pour qu'on dose cette réapparition).
  const out = _director.render(
    ctx, _renderBuf(lay), lay.geom, lay.cols, ink, intensity, phase, FROZEN_SCENES,
  );
  if (out === null) {
    // Aucune scène : verre au repos.
    drawIdle(ctx, lay, ink, intensity, face, role);
  } else if (out > 0) {
    // Scène en sortie : l'idle remonte en intensité derrière la scène.
    drawIdle(ctx, lay, ink, intensity * out, face, role);
  }
}

// Buffer de travail pour les passes de scène (clé fixe : une scène à la fois par verre).
// Pas de rémanence persistante (le moteur compose les scènes en mode net) → clé "scene".
function _renderBuf(lay: ScreenLayout): DotBuffer {
  return getBuffer("scene", lay.cols, lay.rows);
}

// ── Verre au repos (idle) ─────────────────────────────────────────────────────
// • Verre JUICY (gauche) : la DÉMO-SCÈNE prend le relais — boucle d'attraction façon
//   borne d'arcade (logo qui s'assemble, marquee défilant, aigle-créature, best,
//   glitch). Tout vit dans dmd/demo.ts ; ICI on ne fait que l'alimenter en horloge.
// • Verre SCENE (plein-largeur) : reste sur la grande tête d'aigle qui flotte (l'idle
//   d'un gros event en sortie), inchangé.
let _demoFrame = 0;   // horloge libre de la démo (avance tant que le verre juicy est au repos)

// Condense le GameState courant (_scoreState, posé par drawBackglass) en une HUMEUR
// qui pilote la playlist de la démo. Priorités : intro de niveau > presque fini >
// dernier œuf > visée standard. Robuste si l'état n'est pas encore posé (→ "aim").
function demoMood(): DemoMood {
  const s = _scoreState;
  if (!s) return { kind: "aim", level: 1, balls: 0, orangeLeft: 0 };
  const base = { level: s.level, balls: s.balls, orangeLeft: s.orangeLeft };
  if (s.phase === "intro") return { kind: "intro", ...base };
  if (s.orangeLeft > 0 && s.orangeLeft <= 2) return { kind: "almost", ...base };
  if (s.balls > 0 && s.balls <= 2) return { kind: "lastEgg", ...base };
  return { kind: "aim", ...base };
}

function drawIdle(
  ctx: CanvasRenderingContext2D, lay: ScreenLayout,
  ink: DmdInk, intensity: number, face: ReturnType<typeof getFaceMood>,
  role: "juicy" | "scene",
): void {
  const phase = noisePhase();
  if (role === "juicy") {
    // La démo tourne en continu sur le verre de gauche, mais sa playlist suit l'état
    // du jeu (intro de niveau, ambiance, dernier œuf, presque fini) — cf. demoMood.
    _demoFrame++;
    drawDemo(
      ctx, lay.geom, lay.cols, lay.rows, ink, intensity, phase,
      _demoFrame, toDmdFace(face), _attractBest, fmt(_attractBest), demoMood(),
    );
    return;
  }
  // Verre SCENE : grande tête centrée qui flotte (idle d'event plein écran).
  const now = performance.now() / 1000;
  const eagleCol = Math.max(0, Math.floor((lay.cols - EAGLE_BIG_W) / 2));
  const baseRow = Math.max(0, Math.floor((lay.rows - EAGLE_BIG_H) / 2));
  const eagleRow = baseRow + (Math.sin(now * 1.4) > 0.3 ? 0 : 1);
  const band = beginBand("idle:eagle", lay.geom, lay.cols, lay.rows);
  bandMatrix(band, eagleBigDots(toDmdFace(face)), eagleCol, eagleRow, 1);
  endBand(ctx, band, ink, intensity, true, phase);
}

// ── Verre SCORE (droite) — 2 lignes « bleu × orange » + total ─────────────────
// Bande HAUTE : compteurs du tour en LIVE → 🔵turnBluePts · « × » · 🟠(1+nbOrange·step).
// Bande BASSE : le TOTAL cumulé du run (ticker + pop juicy au versement de fin de tour).
// Le verre score est composé de TROIS encres (bleu/ambre/orange) + une bande total ;
// chaque couleur passe par sa propre bande persistante pour garder l'afterglow plasma.
function drawScoreGlass(
  ctx: CanvasRenderingContext2D, s: GameState, lay: ScreenLayout,
  ink: DmdInk, intensity: number,
): void {
  const phase = noisePhase();

  // — Bande HAUTE — Au versement (bonus défilants PUIS restant qui se vide), on l'affiche
  //   en or à la place du « bleu × orange ». Sinon : « bleu × orange » en live.
  if (_payoutShow > 0 || _payoutActive) {
    drawPayoutBonus(ctx, lay, phase);
  } else {
    drawBlueTimesOrange(ctx, s, lay, ink, intensity, phase);
  }

  // — Bande BASSE : « SCORE: » calé À GAUCHE, le TOTAL cumulé calé À DROITE —
  // JUICE pendant le versement (recettes game-feel : squash&stretch, flash couleur, jitter,
  // halo). « SCORE: » reste calme à gauche ; SEUL le nombre encaisse le juice, ancré à droite.
  const scoreStr = fmt(Math.round(_displayedScore));
  const label = "SCORE:";
  const pop = Math.max(_scorePop, _totalPop);
  const flash = Math.min(1, intensity + pop * 0.4);
  const valCol = Math.max(textCols(label) + 1, lay.cols - textCols(scoreStr));

  // Label à gauche — encre stable.
  const labBand = beginBand("score:label", lay.geom, lay.cols, lay.rows);
  bandText(labBand, label, 0, BOT_ROW, 1);
  endBand(ctx, labBand, DMD_AMBER, Math.min(1, intensity + pop * 0.2), true, phase);

  // Le NOMBRE — c'est lui qui « sent les points ». Juice actif pendant le versement.
  const juicing = _payoutActive || _revivePop > 0;
  // Flash de COULEUR : vire vers l'OR pendant le remplissage, revient au blanc à la fin.
  const numInk = juicing && _payoutActive ? DMD_GOLD : DMD_AMBER;
  const numBand = beginBand("score:num", lay.geom, lay.cols, lay.rows);
  bandText(numBand, scoreStr, valCol, BOT_ROW, 1);

  if (pop <= 0.01 && !juicing) {
    endBand(ctx, numBand, numInk, flash, true, phase);
    return;
  }

  // Géométrie du nombre (pour scale + jitter + halo centrés dessus).
  const nxPix = lay.geom.x + valCol * lay.geom.pitch;
  const nwPix = textCols(scoreStr) * lay.geom.pitch;
  const nyPix = lay.geom.y + BOT_ROW * lay.geom.pitch;
  const nhPix = GLYPH_ROWS * lay.geom.pitch;
  const ncx = nxPix + nwPix / 2, ncy = nyPix + nhPix / 2;

  // Halo doré qui pulse derrière le nombre (bloom proportionnel au pop).
  if (pop > 0.05) {
    ctx.globalAlpha = 0.3 * pop;
    ctx.fillStyle = numInk.glow;
    roundGlowRect(ctx, nxPix - lay.geom.pitch, nyPix - lay.geom.pitch, nwPix + lay.geom.pitch * 2, nhPix + lay.geom.pitch * 2);
    ctx.globalAlpha = 1;
  }

  // SQUASH & STRETCH : overshoot élastique à chaque saut (le nombre « gonfle » puis revient).
  const scale = 1 + (1 - hudEob(1 - pop)) * 0.28;
  // JITTER : micro-secousse pseudo-aléatoire (déterministe via animClock) qui s'éteint avec le pop.
  // Pas de Math.random au rendu → on dérive d'un sinus haute fréquence de l'horloge d'anim.
  const jit = pop * 1.4;
  const jx = Math.sin(s.animClock * 97.0) * jit;
  const jy = Math.cos(s.animClock * 89.0) * jit * 0.6;

  ctx.save();
  ctx.translate(ncx + jx, ncy + jy);
  ctx.scale(scale, scale);
  ctx.translate(-ncx, -ncy);
  endBand(ctx, numBand, numInk, flash, true, phase);
  ctx.restore();
}

// Bande haute « 🔵bleu × 🟠orange » (live) : trois encres, chacune sa bande persistante.
function drawBlueTimesOrange(
  ctx: CanvasRenderingContext2D, s: GameState, lay: ScreenLayout,
  ink: DmdInk, intensity: number, phase: number,
): void {
  const step = BALANCE.score.orangeMultStep;
  const mult = 1 + s.turnOrangeCount * step;
  const blueStr = fmt(s.turnBluePts);
  const multStr = `${mult}`;
  const sepCols = textCols("×");
  const gap = 1;

  // Le « × » reste ANCRÉ au centre du verre quoi qu'il arrive : la valeur bleue
  // grandit vers la gauche (alignée à droite du séparateur), l'orange vers la droite.
  // Ainsi le séparateur ne dérive plus quand le compteur bleu change de largeur.
  const sepCol = Math.floor((lay.cols - sepCols) / 2);

  // Au RÉVEIL (retour du versement), bleu et orange poppent ensemble : le « vert × orange »
  // réapparaît avec un petit ressaut élastique au lieu de surgir sec. N'écrase pas un pop live.
  const bluePop = Math.max(_bluePop, _revivePop);
  const orangePop = Math.max(_orangePop, _revivePop);

  // Compteur bleu — calé À DROITE, juste avant le séparateur. Pop élastique à la hausse.
  const blueCol = Math.max(0, sepCol - gap - textCols(blueStr));
  drawPopNumber(ctx, "score:blue", blueStr, blueCol, lay, DMD_BLUE, intensity, bluePop, phase);
  // Séparateur × (encre ambre) — respire avec les deux pops + le réveil.
  const sepGlow = intensity * (0.85 + 0.15 * Math.max(bluePop, orangePop));
  const sepBand = beginBand("score:sep", lay.geom, lay.cols, lay.rows);
  bandText(sepBand, "×", sepCol, 0, 1);
  endBand(ctx, sepBand, ink, sepGlow, false, phase);
  // Multiplicateur orange — calé À GAUCHE, juste après le séparateur. Pop quand une cible tombe.
  const orangeCol = sepCol + sepCols + gap;
  drawPopNumber(ctx, "score:orange", multStr, orangeCol, lay, DMD_ORANGE, intensity, orangePop, phase);
}

// Bande haute, MODE VERSEMENT — « count-up » classique de JV, tout en or et CENTRÉ :
//   1) BONUS : défilement bref des bonus « LABEL montant » par tranches de _payoutShow.
//   2) HOLD : le RÉSULTAT entier s'affiche calmement (un seul pop d'apparition, pas de clignotement).
//   3) TRANSFERT : « = restant » se vide vers 0 pendant que le total du bas se remplit en miroir
//      (synchronisé sur le ticker : _payoutRemaining = s.score − total affiché). Le haut décroît
//      doucement (scale qui se resserre légèrement à mesure qu'il se déverse) → effet « on verse ».
function drawPayoutBonus(
  ctx: CanvasRenderingContext2D, lay: ScreenLayout, phase: number,
): void {
  const bonusPhase = _payoutShow > 0 && _payoutBonuses.length > 0;
  let text: string;
  if (bonusPhase) {
    // Phase BONUS : on répartit le défilement des bonus sur la fenêtre _payoutShow (1→0).
    const n = _payoutBonuses.length;
    const idx = Math.min(n - 1, Math.floor((1 - _payoutShow) * n));
    const b = _payoutBonuses[idx]!;
    text = `${b.label} ${fmt(b.amount)}`;
    if (idx !== _payoutSlice) { _payoutSlice = idx; _payoutPop = 0.7; }
  } else {
    // Phase HOLD + TRANSFERT : le restant à verser. Entier pendant le HOLD, puis décroît → 0.
    text = `+${fmt(_payoutRemaining)}`;
    // Marqueur dédié (-2) → UN SEUL pop doux à l'apparition du résultat, puis plus rien (calme).
    if (_payoutSlice !== -2) { _payoutSlice = -2; _payoutPop = 0.8; }
  }

  // Texte TOUJOURS centré dans le verre (col recalculé selon la largeur du libellé).
  const col = Math.max(0, Math.floor((lay.cols - textCols(text)) / 2));
  const xPix = lay.geom.x + col * lay.geom.pitch;
  const wPix = textCols(text) * lay.geom.pitch;
  const hPix = GLYPH_ROWS * lay.geom.pitch;
  const cx = xPix + wPix / 2, cy = lay.geom.y + hPix / 2;

  // Halo doré discret qui se résorbe avec le pop d'apparition (pas de flash permanent).
  if (_payoutPop > 0.01) {
    ctx.globalAlpha = 0.32 * _payoutPop;
    ctx.fillStyle = DMD_GOLD.glow;
    roundGlowRect(ctx, xPix - lay.geom.pitch, lay.geom.y - lay.geom.pitch, wPix + lay.geom.pitch * 2, hPix + lay.geom.pitch * 2);
    ctx.globalAlpha = 1;
  }

  // Intensité STABLE (plus de clignotement) : pleine lumière + léger surcroît sur le pop.
  const flash = Math.min(1, 0.9 + _payoutPop * 0.1);

  const band = beginBand("score:bonus", lay.geom, lay.cols, lay.rows);
  bandText(band, text, col, 0, 1);

  if (_payoutPop <= 0.01) {
    endBand(ctx, band, DMD_GOLD, flash, true, phase);
    return;
  }
  // Scale élastique doux à l'apparition (déborde ~1.2 au pic → 1), centré → reste centré.
  const scale = 1 + (1 - hudEob(1 - _payoutPop)) * 0.2;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
  endBand(ctx, band, DMD_GOLD, flash, true, phase);
  ctx.restore();
}

// Nombre du verre score avec POP juicy : à la hausse (pop 1→0), il déborde (scale
// élastique), son intensité gonfle, et un halo claque derrière. Sans pop, rendu normal.
function drawPopNumber(
  ctx: CanvasRenderingContext2D, key: string, text: string, col: number, lay: ScreenLayout,
  ink: DmdInk, intensity: number, pop: number, phase: number,
): void {
  const flash = Math.min(1, intensity + pop * 0.4);
  const xPix = lay.geom.x + col * lay.geom.pitch;
  const wPix = textCols(text) * lay.geom.pitch;
  const hPix = GLYPH_ROWS * lay.geom.pitch;
  if (pop > 0.01) {
    // Halo localisé derrière le nombre (bloom qui éclate puis se résorbe).
    ctx.globalAlpha = 0.35 * pop;
    ctx.fillStyle = ink.glow;
    roundGlowRect(ctx, xPix - lay.geom.pitch, lay.geom.y - lay.geom.pitch, wPix + lay.geom.pitch * 2, hPix + lay.geom.pitch * 2);
    ctx.globalAlpha = 1;
  }
  const band = beginBand(key, lay.geom, lay.cols, lay.rows);
  bandText(band, text, col, 0, 1);
  if (pop <= 0.01) {
    endBand(ctx, band, ink, flash, true, phase);
    return;
  }
  // Scale élastique autour du centre du nombre (~1.35 au pic → 1).
  const scale = 1 + (1 - hudEob(1 - pop)) * 0.35;
  const cx = xPix + wPix / 2, cy = lay.geom.y + hPix / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
  endBand(ctx, band, ink, flash, true, phase);
  ctx.restore();
}


// ── Insert chunky « qui s'allume » — la brique du plateau ─────────────────────
// Une plaque chunky (DA pure) qui sert de cadre à une info. Quand son event est
// chaud (`lit`), l'insert s'allume : halo derrière + bevel réchauffé + léger pop de
// scale. `pop` (0→1) ajoute un sursaut élastique ponctuel (changement de valeur).
// Le `body` reçoit le centre (cx,cy) et la boîte interne pour y poser son contenu.
function drawInsert(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  opts: { title: string; lit?: boolean; litColor?: string; pop?: number },
  body: (cx: number, cy: number, innerY: number) => void,
): void {
  const { title, lit = false, litColor = ROLE.gold, pop = 0 } = opts;
  const cx = x + Math.round(w / 2);
  const cy = y + Math.round(h / 2) + 3;          // décalé bas (le titre prend le haut)

  // Halo derrière la plaque quand l'insert est allumé (event chaud).
  if (lit) {
    ctx.save();
    pixelGlow3(ctx, x, y, w, h, litColor, 5, [0.16, 0.09, 0.04]);
    ctx.restore();
  }

  // Pop élastique de la plaque entière (sursaut ponctuel).
  const scale = 1 + pop * 0.07;
  ctx.save();
  if (pop > 0.01) { ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy); }

  // Ombre dure portée (DA carte OPTIONS) — la plaque flotte posée sur le ciel.
  dropShadow(ctx, x, y, w, h);

  // La PEG-PLAQUE — réplique fidèle du bouton `.pg-pm-btn` (coins ronds, bevel 2px,
  // contour ink, reflet « L »). Allumée : le peg vire à la couleur d'event (or/orange).
  pegPlate(ctx, x, y, w, h,
    lit ? litColor : PLATE.fill,
    lit ? mixHex(litColor, "#ffffff", 0.4) : PLATE.light,
    lit ? mixHex(litColor, ROLE.ink, 0.45) : PLATE.dark);

  // Titre : capitale BITMAP COMPACTE 5×7 (FONT_SMALL) gravée, alignée à droite en haut.
  // Les titres sont longs (TARGETS) → la petite fonte tient dans la largeur de l'insert ;
  // les VALEURS, elles, prennent la grosse fonte « Game Boy » chunky (ci-dessous).
  pegText(ctx, title, x + w - 5, y + 8, 1, "right", FONT_SMALL);

  // Contenu spécifique de l'insert.
  body(cx, cy + 2, y + 16);

  ctx.restore();
}

// ── Plateau d'inserts : 4 plaques chunky (2 colonnes G/D) autour du DMD héros ──
// LVL (haut-G) · CIBLES (bas-G) · EGGS (haut-D) · MULT (bas-D). Chaque insert
// s'allume sur son moment fort (level-up, pré-jackpot, low-balls, fever).
function drawInserts(
  ctx: CanvasRenderingContext2D, s: GameState,
  orangeLeft: number, orangeTotal: number,
  inClutch: boolean, lowBalls: boolean,
  egg: BallStyle, theme: GameTheme,
): void {
  const VSIZE = 1;   // scale des valeurs en grosse fonte « Game Boy » 8×10 → glyphe 8×10px

  // ── INSERT CIBLES (haut-gauche) — UN peg + « ×N » (cibles restantes), or en pré-jackpot ──
  const total = Math.max(orangeTotal, orangeLeft);
  const preJackpot = orangeLeft === 0 && total > 0;
  const anyPop = _targetPop.reduce((m, p) => Math.max(m, p ?? 0), 0);
  drawInsert(ctx, COL_L_X, INS_TOP_Y, COL_W, INS_H,
    { title: "TARGETS", lit: preJackpot, litColor: ROLE.gold, pop: anyPop },
    (cx, cy) => drawSpriteCount(ctx, cx, cy, orangeLeft, VSIZE,
      (sx, sy) => pegSprite(ctx, sx, sy, 5, theme.peg, inClutch || preJackpot, true)));

  // ── INSERT EGGS (bas-gauche) — UN œuf + « ×N » (œufs restants), clignote en low-balls ──
  drawInsert(ctx, COL_L_X, INS_BOT_Y, COL_W, INS_H,
    { title: "EGGS", lit: lowBalls, litColor: ROLE.orange, pop: 0 },
    (cx, cy) => drawSpriteCount(ctx, cx, cy, s.balls, VSIZE,
      (sx, sy) => eggSprite(ctx, sx, sy, egg, 5)));

  // ── INSERT LVL (bas-droite) — flashe + pop au changement de niveau ──
  // Le MULT a été retiré (déjà affiché dans le verre DMD) → la colonne droite porte
  // les boutons de contrôle (haut) puis LVL (bas).
  drawInsert(ctx, COL_R_X, INS_BOT_Y, COL_W, INS_H,
    { title: "LVL", lit: _lvlPop > 0.1, litColor: ROLE.gold, pop: _lvlPop },
    (cx, cy) => pegText(ctx, `${s.level}`, cx, cy, VSIZE, "center"));
}

// « sprite ×N » centré sur (cx,cy) : un seul sprite (peg/œuf) suivi du compteur « ×N »
// — plus de rangée de pips. Le sprite est dessiné par le callback `drawSprite(sx,sy)`,
// le nombre en encre GRAVÉE (pegText) sur le peg vert. L'ensemble centré sur cx.
function drawSpriteCount(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number,
  sc: number,
  drawSprite: (sx: number, sy: number) => void,
): void {
  const SPR_R = 5, GAP = 4;
  const text = `×${n}`;
  const tw = pegTextWidth(text, sc);
  const totalW = SPR_R * 2 + GAP + tw;
  const sx = cx - totalW / 2 + SPR_R;        // centre du sprite
  drawSprite(Math.round(sx), Math.round(cy));
  pegText(ctx, text, sx + SPR_R + GAP, cy, sc);
}

// Plaque de bouton de contrôle — MÊME DA que le `PegBtn` du menu Options : PEG VERT VIF
// plein (ROLE.accent = --pg-green), bevel vert franc (accentHi/accentDeep), contour `ink`
// net + ombre dure portée. Allumé : le peg vire à la couleur d'event (or power chargé).
function ctrlPlate(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit = false, litColor = ROLE.gold,
): void {
  if (lit) pixelGlow3(ctx, x, y, w, h, litColor, 5, [0.16, 0.09, 0.04]);
  dropShadow(ctx, x, y, w, h);
  pegPlate(ctx, x, y, w, h,
    lit ? litColor : PLATE.fill,
    lit ? mixHex(litColor, "#ffffff", 0.4) : PLATE.light,
    lit ? mixHex(litColor, ROLE.ink, 0.45) : PLATE.dark);
}

// Bouton pause : peg vert vif (DA partagée) + deux barres SOMBRES gravées (encre peg),
// surlignées d'un liseré clair en haut → icône en relief sur le vert, façon glyphe de peg.
function pauseButton(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = PAUSE_HIT;
  ctrlPlate(ctx, x, y, w, h);
  const cx = x + Math.round(w / 2), cy = y + Math.round(h / 2);
  const bh = Math.round(h * 0.42), by = cy - Math.round(bh / 2);
  // Liseré clair (lumière rasante haut/gauche du glyphe gravé).
  ctx.fillStyle = alpha(ROLE.accentHi, 0.7);
  ctx.fillRect(cx - 5, by - 1, 3, 1); ctx.fillRect(cx + 2, by - 1, 3, 1);
  // Corps des barres : encre peg sombre (comme le texte #0a1a06 des `.pg-pm-btn`).
  ctx.fillStyle = PEG_INK;
  ctx.fillRect(cx - 5, by, 3, bh); ctx.fillRect(cx + 2, by, 3, bh);
}

// Bouton POWER (super-tir) : pastille chunky + éclair pixel chunky. Encore INACTIF
// (placeholder visuel grisé) — le câblage du super-tir viendra plus tard ; on réserve
// juste la zone. `ready` (futur) allumera la pastille en or quand le pouvoir est chargé.
function powerButton(ctx: CanvasRenderingContext2D, ready = false): void {
  const { x, y, w, h } = POWER_HIT;
  ctrlPlate(ctx, x, y, w, h, ready, ROLE.gold);
  const cx = x + Math.round(w / 2), cy = y + Math.round(h / 2);
  // Éclair gravé dans le peg : liseré clair en relief (haut/gauche) + corps encre sombre.
  // Prêt : l'éclair passe en or vif sur le peg doré ; sinon encre peg sur le peg vert.
  ctx.fillStyle = ready ? alpha("#ffffff", 0.5) : alpha(ROLE.accentHi, 0.7);
  drawBolt(ctx, cx, cy, 1);
  ctx.fillStyle = ready ? INK.warn : PEG_INK;
  drawBolt(ctx, cx, cy, 0);
}

// Éclair en blocs (pixel-art) centré sur (cx,cy). `o` = décalage de contour (1px).
function drawBolt(ctx: CanvasRenderingContext2D, cx: number, cy: number, o: number): void {
  // Branche haute (de haut-droite vers le centre) puis branche basse (centre vers bas-gauche).
  ctx.fillRect(cx - o, cy - 7 - o, 4, 3);       // tête
  ctx.fillRect(cx - 2 - o, cy - 4 - o, 4, 3);
  ctx.fillRect(cx - 4 - o, cy - 1 - o, 7, 2);   // barre centrale
  ctx.fillRect(cx - 1 - o, cy + 1 - o, 4, 3);
  ctx.fillRect(cx - 3 - o, cy + 4 - o, 4, 3);   // pointe basse
}
