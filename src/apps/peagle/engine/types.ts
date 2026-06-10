import type { UpgradeId } from "./roguelite";
import type { PegKind } from "./peg-kinds";
import type { Rng } from "./rng";
import type { ScorePayout } from "./payout";

export type { UpgradeId, PegKind };

// PegType = catégorie VISUELLE (couleur d'anneau d'explosion). Le bumper, non
// destructible, ne « pop » jamais : il est mappé sur "normal" par défaut.
// La catégorie GAMEPLAY d'un peg est son `kind` (voir peg-kinds.ts).
export type PegType = "orange" | "normal";

export interface Peg {
  x: number;
  y: number;
  kind: PegKind;
  hit: boolean;
  popping: boolean;
  popAlpha: number;
  scale: number;
  // Obstacles permanents (bumper) : frames avant de pouvoir re-toucher + flash
  // d'impact (0..1) qui décroît chaque frame.
  cooldown: number;
  bump: number;
  revealT: number;  // animClock au moment où ce peg doit apparaître (intro niveau)
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  trail: { x: number; y: number; speed: number }[];
  trailHead: number; // ring buffer write pointer (oldest slot)
  tint?: string;
  // Squash d'impact (0..1) : pulse déclenché à chaque collision, décroît chaque
  // frame. Le rendu écrase l'œuf perpendiculairement à sa trajectoire → bounce juicy.
  squash: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  combo: boolean;
  fontSize?: number;
  // Exclamation « hype » (JUICY!, AIGLE ROYAL!…) : rendu spécial avec contour
  // pixel, glow et pop élastique. `spin` = graine d'inclinaison/oscillation.
  exclaim?: boolean;
  spin?: number;
}

// Expression « hype » de combo (RAPACE!, AIGLE ROYAL!…) ancrée À CÔTÉ du peg
// qui vient d'éclater, décalée en DIAGONALE vers l'espace libre pour rester
// lisible sans masquer l'action. Elle dérive doucement (vx/vy) en s'envolant,
// puis s'estompe. `tier` = palier de combo (pilote taille/couleur), `spin` =
// graine d'inclinaison/oscillation pour le wobble.
export interface HypeText {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  fontSize: number;
  tier: number;
  spin: number;
}

export interface Star {
  x: number;
  y: number;
  layer: 0 | 1 | 2;
  size: number;
  phase: number;
}

// Easter egg « peagle » : chaque peg touché peut faire surgir un oiseau qui
// traverse le ciel en battant des ailes. Transient — vit le temps d'une
// traversée d'écran, puis est retiré.
export interface BgBird {
  x: number;
  y: number;
  vx: number;        // px/frame ; le signe donne la direction de vol
  wingPhase: number;
  flap: number;      // vitesse de battement d'ailes
  scale: number;
  tint: string;
}

// Onde de choc dessinée par-dessus le décor à chaque impact de peg : un anneau
// carré pixel-art qui se propage vers l'extérieur en s'estompant → le décor
// « ressent » l'impact.
export interface ImpactRing {
  x: number;
  y: number;
  life: number;       // 1 → 0
  maxLife: number;    // durée totale en frames
  maxRadius: number;  // rayon atteint en fin de vie
  intensity: number;  // 0..1 — module la lueur localisée (bloom) au point d'impact
  color: string;
}

export interface GameState {
  pegs: Peg[];
  ball: Ball | null;
  balls: number;
  score: number;
  phase: "intro" | "aim" | "firing" | "lost" | "won";
  introEndT: number;   // animClock à partir duquel "intro" → "aim"
  bucket: number;
  bucketDir: number;
  bucketFlash: number;
  message: string;
  combo: number;
  // Nombre de bumpers touchés dans le tir en cours — pour le score escaladant et FRENZY.
  bumperChainShot: number;
  // Série de rattrapages au panier consécutifs ayant chacun touché ≥1 peg.
  // Un panier sans peg touché, ou un œuf manqué (hors écran), remet à 0.
  bucketStreak: number;
  particles: Particle[];
  floatingTexts: FloatingText[];
  hypeTexts: HypeText[];
  impactRings: ImpactRing[];
  clutchPulse: number;
  animClock: number;
  trauma: number;
  shakeX: number;
  shakeY: number;
  flashWhite: number;
  slowMoFrames: number;
  timeWarp: number;   // vitesse du temps lissée (1 = normal, →0 = ralenti) pour un ease juicy
  level: number;
  hitFreezeFrames: number;

  // Lanceur (aigle) déplaçable horizontalement par drag
  launcherX: number;        // position rendue (où l'œuf apparaît)
  launcherTargetX: number;  // cible suivie par ressort (mise à jour au drag)
  launcherVx: number;       // vélocité du ressort → lean / squash juicy
  launcherDragging: boolean;
  launcherGrab: number;     // 0..1 anim de saisie (pop + lueur)
  launcherHovered: boolean; // souris dans le rayon de saisie (mis à jour par le game loop)

  stars: Star[];
  birds: BgBird[];
  turnScoreStart: number;
  orangeLeft: number;

  // Score « bleu × orange » :
  //   • turnBluePts     = points bleus du TOUR (pegs normaux + bumpers, combo inclus).
  //                       Reset à chaque œuf lancé ; versé à la fin de chaque tour.
  //   • turnOrangeCount = multiplicateur orange ACCUMULÉ. Il grimpe à chaque cible
  //                       touchée et N'EST PAS reset au lancer tant qu'on enchaîne les
  //                       rattrapages au panier (streak). Un œuf perdu (hors écran) le
  //                       remet à 0. À chaque tour : score += turnBluePts × (1 + turnOrangeCount).
  // Le HUD les affiche en live (ligne haute du DMD score).
  turnBluePts: number;
  turnOrangeCount: number;
  // Œuf perdu hors écran CE tour-ci : le multiplicateur orange s'applique quand même au
  // versement de ce tour (endOfTurn), puis est remis à 0 pour le tour suivant. On ne peut
  // PAS reset turnOrangeCount dès la sortie d'écran : endOfTurn tourne après, dans le même
  // tick, et lirait alors un mult de 1 (→ multiplication perdue). Cf. state/ball.ts.
  orangeLostThisTurn: boolean;

  // Dernier versement de fin de tour (breakdown des bonus) — produit par endOfTurn,
  // consommé par le HUD pour jouer la scène DMD « payout ». `payoutAt` est l'animClock
  // du versement : le HUD détecte le front montant pour déclencher la scène une fois.
  // null/0 = aucun versement encore (intro, ou tour totalement raté → rien à verser).
  lastPayout: ScorePayout | null;
  payoutAt: number;

  // Bonus encaissés EN LIVE pendant le tir (jackpot, série de paniers) mis en attente
  // pour être versés via une PayoutLine à endOfTurn → le DMD payout les rejoue proprement
  // et `scoreBefore + payout.total === score` reste vrai. Remis à 0 après versement.
  pendingJackpot: number;       // bonus jackpot du tir (0 = aucun)
  pendingJackpotBalls: number;  // œufs offerts par le jackpot, à créditer à endOfTurn

  // Nombre d'œufs au départ du niveau (pour la progression pré-fever)
  startBalls: number;

  // Progression visuelle 0→1 de l'assombrissement pré-fever (lissée par lerp).
  // Freezée quand la fièvre s'enclenche pour laisser la transition fever prendre le relais.
  duskProgress: number;

  // Run modifiers (dérivés des upgrades par makeInitialState)
  runUpgrades: UpgradeId[];
  effectiveBallR: number;
  effectiveClutchThreshold: number;
  effectiveAimSteps: number;
  effectivePegBounce: number;

  // Nombre de pegs touchés au dernier tour (-1 = aucun tour joué). Utilisé par
  // gameFaceCtx pour déclencher l'expression "inquiet" si le joueur a tout raté.
  lastTurnHitCount: number;

  // animClock au moment où la phase "aim" a commencé — pour calculer l'inactivité (sleepy face).
  aimStartClock: number;

  // revealT du dernier peg ayant déclenché un "ploc" d'apparition (intro) — sert à
  // doser la cadence des sons de pop pour qu'ils ne se superposent pas en bouillie.
  lastRevealSfxT: number;

  // Réactions de la tête d'aigle pendant le tir (pilotent les expressions de face.ts) :
  // animClock du dernier peg touché, sa nature (orange = proie), le moment où l'œuf a
  // été lancé (détection « vol dans le vide »), et le moment d'un tour totalement raté.
  lastHitClock: number;        // -999 = aucun peg touché de la partie
  lastHitWasOrange: boolean;   // le dernier peg touché était-il une cible orange ?
  fireStartClock: number;      // animClock au lancer de l'œuf en cours
  whiffAt: number;             // animClock d'un tour fini sans toucher un seul peg (0 = aucun)

  // Seed used to generate the procedural forest background (per run, derived from runState.seed)
  forestSeed: number;

  // animClock value at the moment the level was won (0 = not yet won)
  levelWonAt: number;

  // animClock au moment du game over (0 = pas encore perdu) — pilote le cri + la
  // tête dégoûtée de l'aigle pendant la défaite.
  lostAt: number;

  // RNG seedé de la simulation : tout l'aléatoire gameplay/cosmétique (particules,
  // oiseaux, jitter des textes, étoiles) passe par ici plutôt que Math.random(),
  // pour que la partie soit reproductible à seed + entrées identiques. Re-seedé
  // par niveau dans makeInitialState (hashSeed(runState.seed, level)).
  rng: Rng;
}

export interface UiState {
  balls: number;
  score: number;
  orangeLeft: number;
  orangeTotal: number;
  phase: string;
  message: string;
  combo: number;
  level: number;
  stars: number;
  /** Fièvre/nuit : peu d'œufs restants à lancer (= s.balls <= effectiveClutchThreshold). */
  clutch: boolean;
  /** Vrai uniquement si le score de cette partie dépasse strictement l'ancien record. */
  isNewRecord: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  username: string | null;
  displayUsername: string | null;
  name: string;
  score: number;
  won: boolean;
  createdAt: string;
}
