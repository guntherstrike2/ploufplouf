// ─── Astuces Peagle — affichées aléatoirement (loading, pause, game over) ────
// Rédigées pour refléter les vraies mécaniques du jeu.

export const PEAGLE_TIPS: string[] = [
  "Enchaîne les hits sans pause pour grimper le multiplicateur de combo.",
  "Vider toutes les cibles orange rapporte 10 000 × le numéro du niveau.",
  "Les bumpers ronds propulsent ton œuf fort — utilise-les pour atteindre les coins.",
  "Le panier se déplace : anticipe l'angle de sortie pour récupérer ton œuf.",
  "En mode CLUTCH (≤ 3 œufs), l'aigle panique. Toi, reste calme.",
  "Les pegs normaux disparaissent eux aussi et rapportent des points bonus.",
  "Les rebonds sur les bords sont élastiques — les angles rasants sont tes amis.",
  "Avec Œil de Lynx, la ligne de visée est 60 % plus longue : essentiel aux niveaux hauts.",
  "Œuf Lourd rebondit 30 % plus fort : idéal pour cascader entre bumpers.",
  "Gros Œuf facilite les impacts, mais modifie les trajectoires sur les rebonds serrés.",
  "Le seed de 6 caractères dans Réglages permet de rejouer la même partie.",
  "Vise d'abord les cibles orange les plus hautes — elles sont souvent les plus dures à atteindre.",
  "Chaque combo battu donne plus de points : les longues chaînes font la différence.",
  "Attraper l'œuf avec le panier peut te sauver un tour critique.",
  "Planifie tes upgrades : Œuf en plus est roi si tu peines à finir les niveaux.",
];

/** Renvoie une astuce aléatoire. */
export function randomTip(): string {
  return PEAGLE_TIPS[Math.floor(Math.random() * PEAGLE_TIPS.length)]!;
}
