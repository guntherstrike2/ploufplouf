// ─── Astuces Peagle — affichées aléatoirement (loading, pause, game over) ────
// Rédigées pour refléter les vraies mécaniques du jeu.

export const PEAGLE_TIPS: string[] = [
  "Chain hits without pause to crank up your combo multiplier.",
  "Clearing every orange target scores 10,000 × the level number.",
  "Golden bumpers launch your egg hard — use them to reach the corners.",
  "The bucket moves: anticipate the exit angle to catch your egg.",
  "In CLUTCH mode (≤ 3 eggs), the eagle panics. You, stay calm.",
  "Normal pegs vanish too and rack up bonus points.",
  "Edge bounces are springy — grazing angles are your friends.",
  "With Eagle Eye, the aim line is 60% longer: essential on high levels.",
  "Heavy Egg bounces 30% harder off targets: perfect for chain ricochets.",
  "Big Egg makes impacts easier, but shifts trajectories on tight bounces.",
  "The 6-character seed in Settings lets you replay the same game.",
  "Aim for the highest orange targets first — they're often the hardest to reach.",
  "Every combo beaten scores more points: long chains make the difference.",
  "Catching the egg with the bucket can save you a critical turn.",
  "Plan your upgrades: Extra Egg is king if you struggle to finish levels.",
];

/** Renvoie une astuce aléatoire. */
export function randomTip(): string {
  return PEAGLE_TIPS[Math.floor(Math.random() * PEAGLE_TIPS.length)]!;
}
