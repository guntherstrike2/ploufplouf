import type { OsRelease } from "@/types";

/** Current GunthOS version — shown on the desktop badge and in Settings. */
export const CURRENT_VERSION = "0.2.1";

/**
 * Release history — the single source of truth for the changelog.
 * Newest first. Add a new entry at the top when you ship and bump
 * {@link CURRENT_VERSION} to match.
 */
export const OS_VERSIONS: OsRelease[] = [
  {
    version: "0.2.1",
    releasedAt: "2026-06-06",
    changelog: `🎮 Peagle 98 — finitions & gameplay
• Bumpers reworkés : plus nombreux, plus punchés, visuellement distincts
• Bonus TABLEAU VIDE : 10 000 × niveau quand tous les pegs sont détruits
• Bonus de série pour rattrapages au panier consécutifs
• Clutch mode : l'aigle réagit à la situation (regard, expressions)
• Stinger game over + crossfade musical deux pistes simultanées
• Juice pass : textes flottants squash & stretch + ticker de score
• Réactivité musicale multi-bande sur le titre
• Notes de mise à jour intégrées dans Peagle (changelog autonome)
• Perf : loop rAF gelée hors-écran, canopées baked, canvas opaque`,
  },
  {
    version: "0.2.0",
    releasedAt: "2026-06-04",
    changelog: `🦅 Peagle 98 — le grand chantier
• Nouveau moteur de jeu déterministe + génération de niveaux façon pachinko
• Mascotte aigle animée partout : menu, lanceur, HUD et game over
• Cri de l'aigle, expressions du visage et véritable écran de game over
• Classement du Kiff affiché directement sur l'écran de fin de partie
• Ambiance jour/nuit, mode fever et lucioles dans la canopée
• Seed personnalisé (A-Z, 0-9) pour rejouer un niveau précis`,
  },
  {
    version: "0.1.0",
    releasedAt: "2026-05-01",
    changelog: `Première version publique de GunthOS.
Le bureau, les fenêtres déplaçables, MSN, la radio, le solitaire,
l'annuaire et tout le tralala rétro 98.`,
  },
];
