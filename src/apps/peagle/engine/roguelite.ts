// ─── Roguelite layer ─────────────────────────────────────────────────────────
// Squelette minimal : une seule boucle "clear le niveau → choisis une amélioration".
// POINT D'EXTENSION PRINCIPAL : ajoute tes idées d'upgrades ici.
//   1. Ajoute un id dans UpgradeId
//   2. Ajoute son entrée dans UPGRADES (nom + description)
//   3. Applique son effet là où c'est pertinent (souvent engine/state/init.ts pour
//      les valeurs "effective*", ou engine/state/ball.ts pour la logique de tir)

export type UpgradeId =
  | "extra_ball"   // +1 œuf au démarrage de chaque niveau
  | "heavy_ball"   // rebond sur les pegs +30%
  | "bigger_ball"  // rayon de l'œuf +30%
  | "sharp_aim";   // ligne de visée +60%

export interface Upgrade {
  id: UpgradeId;
  name: string;
  desc: string;
}

export const UPGRADES: Record<UpgradeId, Upgrade> = {
  extra_ball:  { id: "extra_ball",  name: "Œuf en plus",  desc: "+1 œuf au démarrage de chaque niveau." },
  heavy_ball:  { id: "heavy_ball",  name: "Œuf lourd",    desc: "L'œuf rebondit 30% plus fort sur les cibles." },
  bigger_ball: { id: "bigger_ball", name: "Gros œuf",     desc: "Rayon de l'œuf +30%. Plus facile à toucher." },
  sharp_aim:   { id: "sharp_aim",   name: "Œil de lynx",  desc: "Ligne de visée 60% plus longue." },
};

// ─── Run state (persiste entre les niveaux d'une partie) ─────────────────────

export interface RunState {
  upgrades: UpgradeId[];
}

export function makeInitialRunState(): RunState {
  return { upgrades: [] };
}

// ─── Génération de l'offre d'upgrade (entre deux niveaux) ────────────────────

/** Renvoie jusqu'à 3 upgrades non encore possédées, tirées au hasard. */
export function generateUpgradeOffer(existing: UpgradeId[]): UpgradeId[] {
  const notOwned = (Object.keys(UPGRADES) as UpgradeId[]).filter(id => !existing.includes(id));
  const shuffled = [...notOwned].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}
