export const W = 480;
export const H = 640;
export const BALL_R = 6;
export const PEG_R = 4;
export const BUCKET_W = 80;
export const BUCKET_H = 20;
export const GRAVITY = 0.18;
export const LAUNCH_SPEED = 10;
export const WALL_BOUNCE = 0.72;
export const PEG_BOUNCE = 0.52;
export const FRICTION = 0.999;
export const FEVER_THRESHOLD = 3;
export const AIM_LINE_STEPS = 180;
export const SLOW_MO_DURATION = 50;   // burst court à la cassure ; le gros du ralenti se joue près du panier
export const LAUNCHER_X = W / 2;
export const LAUNCHER_Y = 74;            // descendu pour laisser la place au HUD haut
export const HUD_H = 44;                  // hauteur de la barre HUD in-canvas (en haut)
export const LAUNCHER_MARGIN = 28;       // marge bord ↔ centre de l'aigle (drag horizontal)
export const LAUNCHER_GRAB_R = 34;       // rayon de saisie de l'aigle (espace canvas)

export const START_BALLS = 12;     // œufs au démarrage d'une partie
export const BUCKET_SPEED = 1.4;   // vitesse du panier (px/frame)

export const MAX_SHAKE = 14;
export const TRAUMA_DECAY = 0.03;
export const HIT_FREEZE_NORMAL = 4;
export const HIT_FREEZE_ORANGE = 9;
export const STAR_COUNT = 55;

// ─── Intro level animation timing (animClock units; 0.03/frame ≈ 1.8/s) ─────
export const PEG_REVEAL_START    = 4.0;   // quand les couches de décor ont fini leur intro
export const PEG_REVEAL_STRIDE   = 0.013; // écart entre chaque peg (vague rapide)
export const PEG_REVEAL_ANIM_DUR = 0.22;  // durée du pop élastique de chaque peg
