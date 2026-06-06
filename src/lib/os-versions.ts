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
    changelog: `🎮 Peagle 98 — l'aigle s'emballe
• Vide tout le tableau → bonus géant : 10 000 × le numéro du niveau
• Enchaîne les rattrapages au panier pour des bonus en série
• L'aigle suit ton œuf des yeux et panique vraiment en mode clutch
• Les bumpers ont beaucoup plus de punch
• La musique s'enchaîne proprement selon l'ambiance — plus de coupure brutale
• Les scores explosent à l'écran avec du style
• Le classement s'affiche en fin de partie sans quitter le jeu
• Saisis un code pour rejouer exactement le même niveau qu'un ami`,
  },
  {
    version: "0.2.0",
    releasedAt: "2026-06-04",
    changelog: `🦅 Peagle 98 — le grand chantier
• Nouveau jeu dans GunthOS : Peagle 98, un Peggle rétro avec une boucle roguelite
• L'aigle est vivant — il réagit, crie, et a un vrai écran de game over
• La forêt s'anime : lucioles le soir, ambiance jour/nuit, mode fever
• Ton score va dans le classement mondial affiché directement en fin de partie
• Code de 6 caractères pour rejouer le même niveau qu'un autre joueur`,
  },
  {
    version: "0.1.0",
    releasedAt: "2026-05-01",
    changelog: `Première version publique de GunthOS.
Le bureau, les fenêtres déplaçables, MSN, la radio, le solitaire,
l'annuaire et tout le tralala rétro 98.`,
  },
];
