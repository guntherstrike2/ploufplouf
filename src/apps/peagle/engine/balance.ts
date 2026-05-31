// Valeurs d'équilibrage centralisées — ajuste librement pour régler le feeling.
export const BALANCE = {
  combo: {
    interval: 3,        // 1 palier de multiplicateur tous les 3 pegs touchés
  },
  wall: {
    traumaPerHit: 0.06, // screenshake quand l'œuf tape un mur
  },
  peg: {
    popStartAlpha: 0.25,
    popStartScale: 1.7,
  },
  score: {
    orangeBase: 100,
    normalBase: 10,
    ballBonus: 1000,    // points par œuf restant en fin de niveau
  },
  trauma: {
    normalPeg: 0.08,
    orangePeg: 0.35,
    bucketCatch: 0.15,
  },
  flash: {
    orangePeg: 0.5,
  },
  particles: {
    maxCount: 200,
  },
} as const;
