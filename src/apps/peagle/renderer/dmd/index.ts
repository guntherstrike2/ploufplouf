// ─── DMD · API publique (barrel) ─────────────────────────────────────────────
//
// Moteur d'afficheur à points (dot-matrix display) façon flipper plasma 90s, refondu
// en couches composables :
//
//   raster   — DotBuffer (grille d'intensités) + compositor (afterglow/bloom/bruit)
//   font     — police 5×7
//   sprites  — mascotte aigle paramétrique, œuf qui éclot, étoile
//   tween    — moteur de timeline (pistes/keyframes/easing)
//   easing   — bibliothèque de courbes
//   effects  — effets composables (blink, jitter, scroll, gate, typewriter…)
//   scene    — modèle de scène DATA + hook `custom` créatif
//   screen   — SceneDirector + layout + résolution d'encres
//   bands    — bandes persistantes (idle/score) avec afterglow
//
// Le HUD consomme ce barrel ; il ne dessine plus jamais d'arc de dot lui-même.

// Encres + types de rendu.
export {
  DMD_AMBER, DMD_HOT, DMD_BLUE, DMD_ORANGE, DMD_GOLD,
  type DmdInk, type DmdGeom, type DotBuffer,
  getBuffer, blitGrid, composite, decayUntouched, markComposited,
  stampMatrix, stampDot,
} from "./raster";

// Police.
export { glyph, textCols, GLYPH_ROWS, GLYPH_W, GLYPH_GAP } from "./font";

// Sprites.
export {
  eagleDots, EAGLE_W, type DmdFace,
  eagleBigDots, EAGLE_BIG_W, EAGLE_BIG_H,
  eggDots, EGG_W, EGG_FRAME_COUNT, miniEagleDots, MINI_EAGLE_W,
  STAR_DOTS, STAR_W,
} from "./sprites";

// Timeline + easing.
export { timeline, Timeline, kf } from "./tween";
export * as ease from "./easing";
export { type Easing, type EasingName } from "./easing";

// Effects.
export {
  blink, pulse, jitter, shake, scroll, shift, bob, gate, typewriter, fadeIn, fadeOut, slideIn,
  applyEffects, type Effect, type EffectCtx,
} from "./effects";

// Scènes.
export {
  type SceneDef, type InkName, type SceneApi,
  DMD_ROWS_TOTAL, bandRow0, bandRows, stampText,
} from "./scene";

// Screen + director.
export {
  SceneDirector, computeLayout, type ScreenLayout,
} from "./screen";

// Bandes persistantes (idle/score).
export {
  beginBand, bandText, bandMatrix, endBand, type Band,
} from "./bands";

// Bibliothèque de scènes (data + hooks).
export {
  SCENE_PRIO, FROZEN_SCENES,
  streakScene, frenzyScene, clutchScene,
  jackpotScene, recordScene, levelWonScene, gameOverScene,
} from "./scenes";

// Démo-scène du verre juicy (gauche) — boucle d'attraction façon borne d'arcade.
export { drawDemo, type DemoMood } from "./demo";
