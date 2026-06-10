// ─── Peagle 98 — Game theme ──────────────────────────────────────────────────
// Toutes les couleurs du canvas de jeu viennent d'ici. Le squelette n'a qu'un
// seul thème (Forêt). Pour en ajouter d'autres : crée d'autres GameTheme et
// fais-les choisir via resolveTheme.

import type { PegType } from "./types";
import { getActivePegPalette, getActiveBackground, getActiveAssetId } from "./assets";

export interface PegTheme {
  normal: string; normalHi: string; normalDark: string;
  // Halo « flou » des pegs normaux (façon glow des boutons). Optionnel : fallback
  // sur `normalHi` dans le renderer si absent.
  normalGlow?: string;
  orange: string; orangeHi: string; orangeDark: string;
  orangeClutch: string; orangeGlow: string;
  // Bumper (obstacle permanent) — optionnel : le renderer a un fallback doré.
  bumper?: string; bumperHi?: string; bumperDark?: string; bumperGlow?: string;
  // Couleur de l'anneau d'explosion par type de peg
  popRing: Record<PegType, string>;
}

export interface BgTheme {
  // Sky: gradient 12 bandes, haut → bas (normal + fièvre)
  skyTop:      readonly [number, number, number];
  skyBot:      readonly [number, number, number];
  skyTopClutch: readonly [number, number, number];
  skyBotClutch: readonly [number, number, number];
  // Bandes de sol
  groundColor:         string;
  groundColorClutch:    string;
  subGroundColor:      string;
  subGroundColorClutch: string;
  // Brume sol : deux profondeurs
  mistColor:          string;
  mistColorClutch:     string;
  mistFarColor:       string;
  mistFarColorClutch:  string;
  // Éléments décoratifs
  hasTrees:     boolean;
  hasFireflies: boolean;
  // Couleurs de décor procédural (Forêt uniquement pour l'instant). Optionnel :
  // les thèmes statiques (abîme/enfer/glace) n'en ont pas — le renderer a ses
  // propres constantes pour eux. Voir background.ts.
  decor?: ForetDecor;
}

// ─── Décor procédural Forêt ──────────────────────────────────────────────────
// Toutes les couleurs du décor multi-couches Forêt (collines, arbres, herbe,
// sol, soleil, nuages…). Avant, ces ~40 valeurs étaient codées en dur dans
// renderer/background.ts ; les centraliser ici permet de reworker la palette
// depuis un seul endroit. `day` = mode jour, `fever` = mode fièvre (clutch).
//
// Les rampes d'arbres sont des tableaux : le générateur en pioche une au hasard
// par arbre (variété). Garde la même longueur jour/fever.
export interface ForetTreeRamp {
  trunk:    readonly string[];
  leafDark: readonly string[];
  leafMid:  readonly string[];
  leafHi:   readonly string[];
  pineShadow: string;   // ombre basse des pins (couleur unique)
}

export interface ForetDecorMode {
  // Collines : 4 couches lointain → proche
  hills:      readonly [string, string, string, string];
  // Silhouettes d'arbres lointains
  forestSil:   string;
  forestSilHi: string;
  // Arbres du plan milieu (rampes piochées au hasard)
  trees:      ForetTreeRamp;
  // Nuages
  cloud:        string;
  cloudHi:      string;
  cloudShadow:  string; // ombre décalée derrière le nuage
  cloudReflect: string; // reflet sur le bas du nuage
}

export interface ForetDecor {
  day:   ForetDecorMode;
  fever: ForetDecorMode;
  // Sol jour (détails non animés, partagés) — fluo à calmer lors du rework.
  grass:       readonly string[]; // brins d'herbe (variété)
  grassTuft:   string;            // touffes hautes
  stoneTop:    string;            // pierres : face éclairée (bevel clair)
  stoneBody:   string;            // pierres : corps
  stoneShadow: string;            // pierres : arête sombre bas/droite (bevel + contour)
  stoneMoss:   string;            // mousse sur pierres
  // Soleil (mode jour) — cœur dégradé + rayons + halo
  sunCore:     readonly [string, string, string]; // clair → chaud (haut → bas)
  sunRay:      string;
  sunRayHot:   string;
  sunHalo:     string;
  // Halo chaud à l'horizon (lever de lumière)
  horizonGlow: string; // rgb sans alpha, ex "255,220,140"
  // Feuilles ambiantes qui dérivent (vie de la forêt)
  ambientLeaves:    readonly string[]; // teintes jour (piochées au hasard)
  ambientLeafFever: string;            // teinte unique en mode fièvre
  leafStem:         string;            // petite tige sous les grosses feuilles
}

export interface GameTheme {
  id:    string;
  name:  string;
  peg:   PegTheme;
  bg:    BgTheme;
  flash: { normal: string; clutch: string };
}

// Compose le thème courant à partir de la sélection active de la Galerie
// (palette de pegs + arrière-plan choisis par l'utilisateur).
function buildTheme(): GameTheme {
  const bgv = getActiveBackground();
  // L'id reflète l'arrière-plan choisi : sert de clé au cache du décor statique
  // (renderer/background.ts) et active ses calques spéciaux (abîme/enfer/glace).
  const bgId = getActiveAssetId("background");
  return {
    id: bgId,
    name: bgId,
    peg: getActivePegPalette(),
    bg: bgv.bg,
    flash: bgv.flash,
  };
}

// Mémoïsé au niveau module : resolveTheme() est appelé à chaque frame par la
// boucle rAF, or le thème ne change qu'au choix d'un asset dans la Galerie.
// Sans ce cache on allouait un GameTheme (+ deux list.find) à 60 fps pour rien.
// invalidateTheme() est appelé sur ASSETS_CHANGED_EVENT (cf. refreshAssetCache).
let _theme: GameTheme | null = null;

export function resolveTheme(): GameTheme {
  return (_theme ??= buildTheme());
}

/** Force la recomposition du thème (sélection d'asset changée). */
export function invalidateTheme(): void {
  _theme = null;
}
