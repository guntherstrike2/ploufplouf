export const PEAGLE_CURRENT_VERSION = "0.2.0";

export interface PeagleRelease {
  version: string;
  releasedAt: string;
  notes: string[];
}

export const PEAGLE_VERSIONS: PeagleRelease[] = [
  {
    version: "0.2.0",
    releasedAt: "2026-06-06",
    notes: [
      "Nouveau moteur de physique déterministe + génération procédurale seedée",
      "Mascotte aigle animée partout : menu, HUD, pause, game over",
      "Ambiance jour/nuit + mode Fever avec lucioles dans la canopée",
      "Clutch mode : expressions du visage de l'aigle + suivi de regard selon la balle",
      "Bumpers reworkés : plus nombreux, plus punchés, ombre distincte",
      "Bonus TABLEAU VIDE : 10 000 × niveau quand tous les pegs sont détruits",
      "Bonus de série pour rattrapages au panier consécutifs",
      "Stinger game over + vrai crossfade musical deux pistes simultanées",
      "Juice pass : textes flottants squash & stretch, aberration chromatique, ticker de score",
      "Réactivité musicale multi-bande (beat reactivity sur le titre)",
      "Classement mondial affiché directement sur l'écran de fin de partie",
      "Réglage de seed personnalisé (A-Z, 0-9)",
      "Perf : loop rAF gelée hors-écran, canvas opaque, canopées baked",
      "Notes de mise à jour intégrées dans le jeu",
    ],
  },
  {
    version: "0.1.0",
    releasedAt: "2026-05-01",
    notes: [
      "Première version de Peagle 98",
      "Peggle classique avec boucle roguelite",
      "Upgrades entre les niveaux",
      "Classement mondial (GuntherBoard)",
    ],
  },
];
