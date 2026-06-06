export const PEAGLE_CURRENT_VERSION = "0.3.0";

export interface PeagleRelease {
  version: string;
  releasedAt: string;
  notes: string[];
}

export const PEAGLE_VERSIONS: PeagleRelease[] = [
  {
    version: "0.3.0",
    releasedAt: "2026-06-06",
    notes: [
      "Rework complet des textes flottants : plus diegésiques et lisibles",
      "Exclamations (JUICY!, TASTY!…) : pixel burst + dérive latérale organique",
      "Box combo → badge banner sombre avec bandes colorées",
      "Multiplicateur ×N affiché en doré dans les scores",
      "Overlay patch notes in-game depuis le menu principal",
    ],
  },
  {
    version: "0.2.0",
    releasedAt: "2026-06-04",
    notes: [
      "Nouveau moteur de physique déterministe + génération procédurale seedée",
      "Mascotte aigle animée : menu, HUD, pause, game over",
      "Ambiance jour/nuit + mode Fever avec lucioles dans la canopée",
      "Bumpers punchés, bonus TABLEAU VIDE (×niveau)",
      "Stinger game over + vrai crossfade musical",
      "Juice pass : textes flottants squash & stretch, ticker de score",
      "Classement mondial affiché sur l'écran de fin de partie",
      "Réglage de seed personnalisé (A-Z, 0-9)",
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
