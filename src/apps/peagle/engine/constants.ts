export const W = 480;
export const H = 640;
export const BALL_R = 6;
export const PEG_R = 4;
export const BUCKET_W = 80;
export const BUCKET_H = 20;

// ─── Géométrie de capture du panier ──────────────────────────────────────────
// DOIT rester alignée sur le rendu du panier (renderer/ui.ts → drawNestBody) : le
// bloc déborde de BUCKET_W (nW = BUCKET_W + 16), est plat (hauteur 18px) et ancré
// au sol — son bas touche `bot = H - 2`, son ouverture est dans le tiers supérieur
// (slotTop = bot - 15). On dérive ici la même géométrie pour que la hitbox épouse
// exactement l'ouverture visible.
export const BUCKET_RIM_OVERHANG = 8;                                  // débord du rebord, chaque côté
export const BUCKET_CATCH_HALF_W = BUCKET_W / 2 + BUCKET_RIM_OVERHANG; // demi-largeur de capture (48)
export const BUCKET_RIM_Y = H - 2 - 15;                                // niveau de l'ouverture (H − 17)
export const GRAVITY = 0.18;
export const LAUNCH_SPEED = 10;
export const WALL_BOUNCE = 0.72;
export const PEG_BOUNCE = 0.52;
export const FRICTION = 0.999;
export const CLUTCH_THRESHOLD = 3;
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
export const PEG_REVEAL_STRIDE   = 0.020; // écart entre chaque peg (vague — chaque pop respire un peu)
export const PEG_REVEAL_ANIM_DUR = 0.28;  // durée du pop élastique de chaque peg (assez long pour lire le rebond)
