// ─── DMD · Démo-scène du verre JUICY (gauche) ────────────────────────────────
//
// Le verre de GAUCHE ne dessine PLUS de sprite (l'aigle a été retiré). Il tourne une
// BOUCLE DE DÉMO 100% TEXTE façon borne d'arcade : une succession de CARTES qui se
// relaient, chacune jouant le MÊME jeu de mots avec un EFFET différent (chute en
// cascade, marquee défilant, vague, glitch CRT, zoom élastique, scroll vertical…).
// Le but : « du texte et des effets dans tous les sens ».
//
// RÉACTIF AU JEU : le pilote ne tourne PAS une boucle d'horloge aveugle. Il reçoit un
// `DemoMood` dérivé du GameState (cf. hud.ts) et choisit le PROGRAMME de cartes en
// conséquence : intro de niveau, ambiance en visée, tension « dernier œuf », ou
// « presque fini ». Chaque humeur a sa propre playlist ; le fondu d'entrée/sortie
// reste géré ici. Aucune carte ne touche au canvas hors de la bande.
//
// Tout est composé en dots dans une BANDE persistante (afterglow plasma) — cf.
// bands.ts. Une carte = une fonction `(DemoCtx) => void` qui stampe sa frame.

import { beginBand, bandText, type Band } from "./bands";
import { textCols, GLYPH_W } from "./font";
import { type DmdFace } from "./sprites";
import { type DmdInk, type DmdGeom, stampDot, composite } from "./raster";

// Lignes de référence dans le verre (15 lignes de haut, glyphe = 7 lignes).
const MID_ROW = 4;             // une ligne unique CENTRÉE verticalement : (15-7)/2 = 4
const TOP_ROW = 0;             // bi-lignes : haut (0-6) + bas (8-14) = symétrique
const BOT_ROW = 8;
const COL_ADV = GLYPH_W + 1;   // avance par lettre (5 + 1 gap)
const GLYPH_H = 7;             // hauteur d'un glyphe (pour le clip vertical du scroll)

// ── Humeur de la démo (dérivée du GameState par le HUD) ───────────────────────
// Pilote le choix de PROGRAMME (playlist de cartes). Le HUD calcule l'humeur ; la
// démo n'a aucune connaissance du moteur — juste ces quelques champs.
export interface DemoMood {
  kind: "intro" | "aim" | "lastEgg" | "almost";
  level: number;       // niveau courant (pour la carte d'intro)
  balls: number;       // œufs restants (carte « dernier œuf »)
  orangeLeft: number;  // cibles orange restantes (carte « presque fini »)
}

// ── Contexte passé à chaque carte ────────────────────────────────────────────
export interface DemoCtx {
  band: Band;
  cols: number;
  rows: number;
  geom: DmdGeom;
  now: number;        // performance.now()/1000
  local: number;      // 0..1 dans la carte
  best: number;       // meilleur score (0 = aucun)
  bestStr: string;    // best formaté
  mood: DemoMood;     // humeur courante (état de jeu condensé)
}

type Card = { key: string; frames: number; draw: (d: DemoCtx) => void };

// ── Helpers ──────────────────────────────────────────────────────────────────

function centerCol(text: string, cols: number): number {
  return Math.max(0, Math.floor((cols - textCols(text)) / 2));
}

// Stampe du texte CENTRÉ sur une ligne, à intensité `v` (silencieux si trop large).
function textLine(d: DemoCtx, text: string, row: number, v = 1): void {
  if (textCols(text) > d.cols) return;
  bandText(d.band, text, centerCol(text, d.cols), row, v);
}

// Hash stable [0,1) par cellule (pas de Math.random : un scintillement aléatoire est
// désagréable et casserait la reproductibilité). Sert au glitch.
function hash(c: number, r: number): number {
  const h = Math.sin(c * 41.13 + r * 7.71) * 9137.17;
  return h - Math.floor(h);
}

// Mots courts qui tiennent dans le verre étroit (≤ ~6 lettres). Le marquee, lui,
// défile donc peut être long.
const WORDS = ["PEAGLE", "EAGLE", "COMBO", "RAPTOR", "FRENZY", "AIM", "GO"];
// Choisit un mot qui rentre, déterministe selon un index (pas de random).
function pickWord(d: DemoCtx, seed: number): string {
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[(seed + i) % WORDS.length]!;
    if (textCols(w) <= d.cols) return w;
  }
  return "GO";
}

// ── CARTE · CHUTE ─────────────────────────────────────────────────────────────
// Chaque lettre TOMBE du haut en cascade (rebond easeOutBack à l'atterrissage).
function cardDrop(d: DemoCtx): void {
  const word = pickWord(d, 0);
  const c0 = centerCol(word, d.cols);
  for (let i = 0; i < word.length; i++) {
    const start = i * 0.06;
    const k = Math.max(0, Math.min(1, (d.local - start) / 0.22));
    if (k <= 0) continue;
    const c1 = 2.2, c3 = c1 + 1, p = k - 1;
    const eased = 1 + c3 * p * p * p + c1 * p * p;   // easeOutBack
    const dy = Math.round((1 - eased) * -8);
    bandText(d.band, word[i]!, c0 + i * COL_ADV, MID_ROW + dy, Math.min(1, k * 1.4));
  }
}

// ── CARTE · MARQUEE ───────────────────────────────────────────────────────────
// Un ruban DÉFILE en continu (droite→gauche), avec des chevrons en parallaxe dessous.
const MARQUEE_MSG = "EAGLE PINBALL   *   AIM THE PEGS   *   CHAIN COMBOS   *   ";
function cardMarquee(d: DemoCtx): void {
  const msg = MARQUEE_MSG;
  const span = textCols(msg) + 6;
  const head = Math.floor(d.now * 14) % span;
  bandText(d.band, msg, d.cols - head, TOP_ROW, 0.95);
  bandText(d.band, msg, d.cols - head + span, TOP_ROW, 0.95);
  const chev = "»»»»»»»»»»»»»»»»»»»»";
  const co = Math.floor(d.now * 8) % 6;
  bandText(d.band, chev, -co, BOT_ROW, 0.4);
}

// ── CARTE · VAGUE ───────────────────────────────────────────────────────────
// Le mot ONDULE : chaque lettre monte/descend en sinus à phase décalée, la brillance
// respire le long de la vague (marquee qui danse).
function cardWave(d: DemoCtx): void {
  const word = pickWord(d, 1);
  let col = centerCol(word, d.cols);
  for (let i = 0; i < word.length; i++) {
    const ph = d.now * 3 - i * 0.6;
    const dy = Math.round(Math.sin(ph) * 1.6);
    const lvl = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(ph));
    bandText(d.band, word[i]!, col, MID_ROW + dy, Math.min(1, lvl));
    col += COL_ADV;
  }
}

// ── CARTE · GLITCH ─────────────────────────────────────────────────────────
// Le mot « bug » façon CRT : décalages horizontaux par à-coups + lignes parasites.
function cardGlitch(d: DemoCtx): void {
  const word = pickWord(d, 2);
  const c0 = centerCol(word, d.cols);
  const beat = Math.floor(d.now * 9);
  const glitching = hash(beat, 3) > 0.55;
  const shift = glitching ? (hash(beat, 7) > 0.5 ? 1 : -1) : 0;
  bandText(d.band, word, c0 + shift, MID_ROW, glitching ? 0.6 : 1);
  if (glitching) {
    for (let r = 0; r < d.rows; r++) {
      if (hash(beat, r) > 0.7) {
        for (let c = 0; c < d.cols; c++) {
          if (hash(c + beat, r) > 0.85) stampDot(d.band.buf, c, r, 0.5);
        }
      }
    }
  }
}

// ── CARTE · ZOOM ──────────────────────────────────────────────────────────────
// Le mot apparaît lettre par lettre depuis le CENTRE (révélation symétrique), puis
// pulse. Effet « réacteur qui s'allume ».
function cardZoom(d: DemoCtx): void {
  const word = pickWord(d, 3);
  const reveal = Math.max(0, Math.min(1, d.local / 0.5));
  const shownLen = Math.round(word.length * reveal);
  const start = Math.floor((word.length - shownLen) / 2);
  const shown = word.slice(start, start + shownLen);
  const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(d.now * 6));
  // Stampe centré sur la position d'origine (pas recentré) → ça « grandit » du milieu.
  const c0 = centerCol(word, d.cols);
  let col = c0 + start * COL_ADV;
  for (const ch of shown) {
    bandText(d.band, ch, col, MID_ROW, Math.min(1, pulse));
    col += COL_ADV;
  }
}

// ── CARTE · LEVEL (intro de niveau) ──────────────────────────────────────────
// « LEVEL » (haut) + le numéro de niveau qui PULSE en gros (bas). Jouée en début de
// niveau pour annoncer où on en est. Réactive : lit mood.level.
function cardLevel(d: DemoCtx): void {
  textLine(d, "LEVEL", TOP_ROW, 0.6 + 0.4 * Math.min(1, d.local * 4));
  const num = String(d.mood.level);
  const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(d.now * 5));
  textLine(d, num, BOT_ROW, Math.min(1, pulse));
}

// ── CARTE · LAST EGG (tension : peu d'œufs) ───────────────────────────────────
// « LAST » / « EGGS xN » qui clignotent fort, avec un petit balayage rouge-chaud.
// Jouée quand il reste ≤2 œufs. Réactive : lit mood.balls.
function cardLastEgg(d: DemoCtx): void {
  const on = Math.sin(d.now * 7 * Math.PI) > -0.2;
  const label = d.mood.balls <= 1 ? "LAST" : "FEW";
  textLine(d, label, TOP_ROW, on ? 1 : 0.2);
  textLine(d, `EGGS ${d.mood.balls}`, BOT_ROW, on ? 0.25 : 1);
}

// ── CARTE · FINISH (presque fini : peu de cibles) ─────────────────────────────
// « ALMOST! » qui ondule + « xN LEFT » dessous. Jouée quand il reste ≤2 cibles orange.
// Réactive : lit mood.orangeLeft.
function cardFinish(d: DemoCtx): void {
  const word = "ALMOST";
  let col = centerCol(word, d.cols);
  for (let i = 0; i < word.length; i++) {
    const ph = d.now * 3.5 - i * 0.5;
    const dy = Math.round(Math.sin(ph) * 1.4);
    bandText(d.band, word[i]!, col, TOP_ROW + dy, Math.min(1, 0.7 + 0.3 * Math.sin(ph)));
    col += COL_ADV;
  }
  const blink = Math.sin(d.now * 6 * Math.PI) > 0 ? 1 : 0.3;
  textLine(d, `${d.mood.orangeLeft} LEFT`, BOT_ROW, blink);
}

// ── CARTE · SCROLL VERTICAL ─────────────────────────────────────────────────
// Trois lignes défilent du bas vers le haut (générique de fin / palmarès).
const VLINES = ["EAGLE", "PINBALL", "98"];
function cardVScroll(d: DemoCtx): void {
  // Position de défilement : tout monte de `rows+…` lignes sur la durée de la carte.
  const travel = (d.rows + VLINES.length * 4) * d.local;
  for (let i = 0; i < VLINES.length; i++) {
    const row = Math.round(d.rows + i * 4 - travel);
    if (row < -GLYPH_H || row > d.rows) continue;
    textLine(d, VLINES[i]!, row, 0.9);
  }
}

// ── Cartes (table par clé) ────────────────────────────────────────────────────
const CARDS: Record<string, Card> = {
  drop:    { key: "drop",    frames: 150, draw: cardDrop },
  marquee: { key: "marquee", frames: 220, draw: cardMarquee },
  wave:    { key: "wave",    frames: 160, draw: cardWave },
  glitch:  { key: "glitch",  frames: 140, draw: cardGlitch },
  zoom:    { key: "zoom",    frames: 150, draw: cardZoom },
  vscroll: { key: "vscroll", frames: 170, draw: cardVScroll },
  level:   { key: "level",   frames: 140, draw: cardLevel },
  lastEgg: { key: "lastEgg", frames: 120, draw: cardLastEgg },
  finish:  { key: "finish",  frames: 130, draw: cardFinish },
};

// ── Programmes (playlists) par humeur ─────────────────────────────────────────
// Le HUD condense le GameState en une humeur (cf. DemoMood) ; à chacune sa playlist.
//   intro    → annonce du niveau, puis ambiance
//   lastEgg  → carte de tension récurrente entre deux respirations d'ambiance
//   almost   → carte « presque fini » mise en avant
//   aim      → rotation d'ambiance standard (le repos « normal »)
// Une playlist est une suite de clés de CARDS ; le pilote la déroule par horloge,
// MAIS l'humeur peut changer à tout moment et bascule alors de playlist.
const PROGRAMS: Record<DemoMood["kind"], string[]> = {
  intro:   ["level", "marquee", "drop"],
  lastEgg: ["lastEgg", "wave", "lastEgg", "glitch"],
  almost:  ["finish", "marquee", "finish", "zoom"],
  aim:     ["drop", "marquee", "wave", "glitch", "zoom", "vscroll"],
};

// ── Pilote ───────────────────────────────────────────────────────────────────
// Réactif : la playlist suit `mood.kind`. On garde une horloge LOCALE par humeur pour
// que changer d'humeur reparte proprement au début de la nouvelle playlist (pas de
// saut au milieu d'une carte). `frame` reste l'horloge libre globale (rythme).
let _activeKind: DemoMood["kind"] | null = null;
let _kindStartFrame = 0;

export function drawDemo(
  ctx: CanvasRenderingContext2D, geom: DmdGeom, cols: number, rows: number,
  ink: DmdInk, intensity: number, phase: number,
  frame: number, _face: DmdFace, best: number, bestStr: string,
  mood: DemoMood,
): void {
  // Bascule de playlist quand l'humeur change → on recale l'horloge locale.
  if (mood.kind !== _activeKind) { _activeKind = mood.kind; _kindStartFrame = frame; }

  const keys = PROGRAMS[mood.kind];
  const playlist = keys.map((k) => CARDS[k]!);
  const cycle = playlist.reduce((s, c) => s + c.frames, 0);
  let f = (frame - _kindStartFrame) % cycle;
  let card = playlist[0]!;
  for (const c of playlist) {
    if (f < c.frames) { card = c; break; }
    f -= c.frames;
  }
  const local = f / card.frames;
  // Fondu d'entrée/sortie aux extrémités de la carte (8 frames) → pas de claquement.
  const fade = Math.min(1, Math.min(f, card.frames - f, 8) / 8);
  const a = intensity * fade;

  const band = beginBand("demo", geom, cols, rows);
  const d: DemoCtx = { band, cols, rows, geom, now: performance.now() / 1000, local, best, bestStr, mood };
  card.draw(d);
  // Compose : afterglow plasma + bloom. La bande "demo" persiste sa rémanence.
  composite(ctx, band.buf, band.geom, ink, a, true, phase, true);
}
