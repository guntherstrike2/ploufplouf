// Valeurs d'équilibrage centralisées — ajuste librement pour régler le feeling.
export const BALANCE = {
  combo: {
    interval: 3,        // 1 palier de multiplicateur tous les 3 pegs touchés
  },
  // Bonus de SÉRIE de paniers : récompense les rattrapages consécutifs qui ont
  // chacun touché au moins un peg. Le bonus grimpe avec la longueur de la série.
  bucketStreak: {
    base: 250,          // bonus = base × (série − 1) × niveau (à partir de 2 d'affilée)
    eggEvery: 3,        // +1 œuf tous les N rattrapages consécutifs
  },
  wall: {
    traumaPerHit: 0.06, // screenshake quand l'œuf tape un mur
  },
  peg: {
    popStartAlpha: 0.25,
    popStartScale: 2.1,   // burst de pop plus généreux → plus juicy
  },
  impact: {
    maxRings: 24,         // plafond d'ondes de choc simultanées
    // Onde de choc spawnée à chaque hit (spawnImpactRing). Durée et rayon
    // interpolés entre base (peg bleu) et +full (cible/intensité 1). Une onde
    // qui vit un peu plus longtemps « voyage » et se lit mieux qu'un flash bref.
    ringLifeBase: 18,    // frames de vie à intensité 0
    ringLifeFull: 22,    // +frames à intensité 1 (→ 40 frames ≈ 0.66s au max)
    ringRadiusBase: 20,  // rayon final (px) à intensité 0
    ringRadiusFull: 54,  // +rayon à intensité 1
  },
  score: {
    orangeBase: 100,    // baseScore d'une cible orange — sert au pop/affichage (l'orange monte le MULT, cf. ball.ts)
    normalBase: 10,
    // Score « bleu × orange » : les points bleus (pegs normaux + bumpers) du TOUR
    // sont accumulés en live, puis multipliés par (1 + nbOrange × orangeMultStep)
    // et versés au total à la fin du tour (cf. state/turn.ts). orangeMultStep règle
    // la puissance d'une cible orange (1 = chaque orange ajoute +1 au multiplicateur).
    orangeMultStep: 1,
    // ── MULTIPLICATEUR ORANGE « streak bucket » (cf. state/ball.ts, turn.ts) ────
    // Règle simple : score d'un tour = bleu × (1 + nbOrange). Le compteur d'oranges
    // (turnOrangeCount) S'ACCUMULE de tour en tour TANT QU'on rattrape l'œuf au panier
    // (streak). Un œuf perdu (hors écran) le remet à 0. Plus on enchaîne les rattrapages,
    // plus le multiplicateur grimpe → tension risk/reward. Plafonné pour rester lisible.
    orangeMultMax: 12,         // plafond du multiplicateur (1 + nbOrange accumulés)
    ballBonus: 1000,         // points par œuf restant en fin de niveau
    // JACKPOT : l'œuf retombe dans le panier juste après la dernière proie.
    jackpotBase: 5000,       // bonus de score = jackpotBase × niveau
    jackpotBalls: 3,         // œufs bonus offerts par un jackpot
    // TABLEAU VIDE : tous les pegs destructibles effacés (oranges + bleus).
    clearBoardBonus: 10000,  // bonus = clearBoardBonus × niveau
  },
  trauma: {
    normalPeg: 0.08,
    orangePeg: 0.35,
    bucketCatch: 0.15,
  },
  flash: {
    // Plus de flash plein écran à chaque cible : le feedback passe par le bloom
    // localisé + les particules. Le flash écran reste réservé au moment fort
    // (dernière cible → slow-mo) déclenché directement dans state/ball.ts.
    orangePeg: 0,
  },
  particles: {
    maxCount: 200,
  },
} as const;
