// ─── Peagle 98 — Game theme ──────────────────────────────────────────────────
// Toutes les couleurs du canvas de jeu viennent d'ici. Le squelette n'a qu'un
// seul thème (Forêt). Pour en ajouter d'autres : crée d'autres GameTheme et
// fais-les choisir via resolveTheme.

import type { PegType } from "./types";
import { getActivePegPalette, getActiveBackground, getActiveAssetId } from "./assets";

export interface PegTheme {
  normal: string; normalHi: string; normalDark: string;
  orange: string; orangeHi: string; orangeDark: string;
  orangeFever: string; orangeGlow: string;
  // Couleur de l'anneau d'explosion par type de peg
  popRing: Record<PegType, string>;
}

export interface BgTheme {
  // Sky: gradient 12 bandes, haut → bas (normal + fièvre)
  skyTop:      readonly [number, number, number];
  skyBot:      readonly [number, number, number];
  skyTopFever: readonly [number, number, number];
  skyBotFever: readonly [number, number, number];
  // Bandes de sol
  groundColor:         string;
  groundColorFever:    string;
  subGroundColor:      string;
  subGroundColorFever: string;
  // Brume sol : deux profondeurs
  mistColor:          string;
  mistColorFever:     string;
  mistFarColor:       string;
  mistFarColorFever:  string;
  // Éléments décoratifs
  hasTrees:     boolean;
  hasFireflies: boolean;
}

export interface GameTheme {
  id:    string;
  name:  string;
  peg:   PegTheme;
  bg:    BgTheme;
  flash: { normal: string; fever: string };
}

export const THEME_FORET: GameTheme = {
  id: "foret",
  name: "Forêt",
  peg: {
    normal:   "#2233aa", normalHi:   "#4455ff", normalDark: "#000d44",
    orange:   "#ff5500", orangeHi:   "#ffdd44", orangeDark: "#882200",
    orangeFever: "#ff00cc", orangeGlow: "#ff88ee",
    popRing: {
      normal: "#4455ff", orange: "#ffaa00",
    },
  },
  bg: {
    skyTop:      [58, 110, 140], skyBot:      [106, 170, 68],
    skyTopFever: [8,  4,   28],  skyBotFever: [18,  10,  52],
    groundColor:        "#3a8c28", groundColorFever:      "#0a0a28",
    subGroundColor:     "#1e6016", subGroundColorFever:   "#050514",
    mistColor:         "rgba(180,240,160,0.07)",
    mistColorFever:    "rgba(100,80,200,0.06)",
    mistFarColor:      "rgba(180,240,160,0.04)",
    mistFarColorFever: "rgba(80,60,180,0.04)",
    hasTrees: true, hasFireflies: true,
  },
  flash: { normal: "#4455ff", fever: "#ff00cc" },
};

export const DEFAULT_THEME = THEME_FORET;

// Compose le thème courant à partir de la sélection active de la Galerie
// (palette de pegs + arrière-plan choisis par l'utilisateur).
export function resolveTheme(): GameTheme {
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
