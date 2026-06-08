import type { GameState } from "../engine/types";
import { isClutchActive } from "../engine/clutch";
import { W } from "../engine/constants";

// ─── Mascotte façon DOOM — tête d'aigle de face réactive ──────────────────────
// Partagée entre le HUD (top-left), l'aigle lanceur et l'écran-titre.

export const FACE = {
  head: "#f0e8d0", headHi: "#ffffff", headLo: "#cdbf9a", headLo2: "#a89c76",
  brow: "#8f7d52",
  beak: "#ffcc33", beakHi: "#ffe488", beakLo: "#d99a12", beakTip: "#a6760a",
  mouth: "#3a1d0a", tongue: "#d2563a",
  iris: "#f6d77a", irisRed: "#ff4433", irisStar: "#ffe066", pupil: "#141414", pupilRed: "#7a0d06",
  nape: "#6e4420", napeLo: "#452910",
  drop: "#9fd4ff",
} as const;

export interface FaceMood {
  blink: "none" | "both" | "wink-l" | "wink-r";
  open: number;                       // 0..1 ouverture du bec
  brow: "flat" | "angry" | "up" | "happy" | "smug" | "drowsy";
  eyeRed: boolean;                    // yeux rouges (fever / rage)
  wide: boolean;                      // yeux écarquillés (impact / surprise)
  look: number;                       // -1..1 décalage pupille (regard idle)
  pop: number;                        // 0..1 pulse d'échelle à l'impact
  starEyes: boolean;                  // yeux étoile (victoire)
  tears: boolean;                     // larmes (dernière balle)
  drowsyEyes: boolean;                // yeux mi-clos (somnolence)
  recoil: number;                     // 0..1 anticipation : la tête recule avant un cri
}

// ─── Contexte abstrait — découple getFaceMood de GameState ────────────────────
// Rempli par gameFaceCtx() en jeu ou titleFaceCtx() sur l'écran-titre.
export interface FaceContext {
  animClock: number;    // secondes écoulées (clignement, regard idle)
  hitMag: number;       // intensité de l'impact (0 = aucun ; hitFreezeFrames en jeu)
  inClutch: boolean;    // mode fever (yeux rouges, bec ouvert, sourcils féroces)
  lowBalls: boolean;    // 1-2 œufs restants (sourcils inquiets)
  zeroPeg: boolean;     // tour sans toucher aucun peg (goutte d'inquiétude)
  ponte: number;        // 0..1 ponte en cours (écran-titre uniquement ; 0 en jeu)
  won: boolean;         // niveau terminé (yeux étoile, sourcils heureux, jubilation)
  aimIdleSec: number;   // secondes en aim sans tirer (somnolence)
  bigCombo: boolean;    // combo ≥ 5 en cours (smug)
  oneBall: boolean;     // 1 seul œuf restant (larmes)
  screech: number;      // 0..1 cri en cours → force le bec grand ouvert
  lost: boolean;        // game over → tête dégoûtée (sourcils féroces + paupières lourdes)
  firing: boolean;      // œuf en vol → l'aigle suit la trajectoire du regard
  ballNx: number;       // -1..1 position horizontale de l'œuf (suivi des yeux)
  voidTime: number;     // secondes de vol sans toucher de peg (anticipation inquiète)
  orangeJoy: number;    // 0..1 jubilation décroissante après une cible orange touchée
  whiff: number;        // 0..1 dépit décroissant après un tour totalement raté
  whiffVariant: number; // graine stable d'un raté → choisit la tête (blasé/agacé/dépité/dédaigneux)
  anticip: number;      // 0..1 anticipation : pic bref juste avant un cri (recoil)
}

export function gameFaceCtx(s: GameState): FaceContext {
  const lost = s.phase === "lost";

  // Game over : l'aigle pousse un cri grave dégoûté → bec grand ouvert ~2.2s
  // (attaque vive, léger flutter, fermeture douce), puis il boude bec fermé.
  let screech = 0;
  // Anticipation (recoil) : la tête se ramasse sur les ~140ms d'attaque du cri,
  // puis le cri « explose » → effet ressort. Pic au tout début, retombe vite.
  let anticip = 0;
  if (lost && s.lostAt > 0) {
    const t = s.animClock - s.lostAt;
    if (t >= 0 && t < 2.2) {
      const atk = Math.min(1, t / 0.06);
      const rel = Math.min(1, (2.2 - t) / 0.3);
      const flutter = 0.85 + 0.15 * Math.sin(t * 26);
      screech = Math.max(0, Math.min(1, atk * rel * flutter));
      if (t < 0.14) anticip = Math.max(0, 1 - t / 0.14);
    }
  }

  // Réactions de tir : suivi de l'œuf du regard, jubilation « proie ! » sur orange,
  // anticipation quand l'œuf file dans le vide, dépit après un tour raté.
  const firing = s.phase === "firing" && !!s.ball?.active;
  const ballNx = s.ball ? Math.max(-1, Math.min(1, (s.ball.x - W / 2) / (W / 2))) : 0;
  // Temps écoulé depuis le dernier contact (ou depuis le lancer) tant que l'œuf vole.
  const voidTime = firing
    ? Math.min(s.animClock - s.lastHitClock, s.animClock - s.fireStartClock)
    : 0;
  const orangeJoy = s.lastHitWasOrange ? Math.max(0, 1 - (s.animClock - s.lastHitClock) / 0.5) : 0;
  const whiff = s.whiffAt > 0 ? Math.max(0, 1 - (s.animClock - s.whiffAt) / 1.1) : 0;
  // Graine stable par raté (hash de l'instant) → tête tirée au sort, sans clignoter.
  const h = Math.abs(Math.sin(s.whiffAt * 12.9898 + 78.233) * 43758.5453);
  const whiffVariant = Math.floor((h - Math.floor(h)) * 4);

  return {
    animClock: s.animClock,
    hitMag: s.hitFreezeFrames,
    inClutch: isClutchActive(s),
    lowBalls: s.balls > 0 && s.balls <= 2,
    zeroPeg: s.lastTurnHitCount === 0 && s.phase === "aim",
    ponte: 0,
    won: s.phase === "won",
    aimIdleSec: s.phase === "aim" ? s.animClock - s.aimStartClock : 0,
    bigCombo: s.combo >= 5,
    oneBall: s.balls === 1,
    screech,
    lost,
    firing,
    ballNx,
    voidTime,
    orangeJoy,
    whiff,
    whiffVariant,
    anticip,
  };
}

export function titleFaceCtx(elapsed: number, recoil: number, ponte: number): FaceContext {
  return {
    animClock: elapsed,
    hitMag: recoil,
    inClutch: false,
    lowBalls: false,
    zeroPeg: false,
    ponte,
    won: false,
    aimIdleSec: 0,
    bigCombo: false,
    oneBall: false,
    screech: 0,
    lost: false,
    firing: false,
    ballNx: 0,
    voidTime: 0,
    orangeJoy: 0,
    whiff: 0,
    whiffVariant: 0,
    anticip: 0,
  };
}

// Tête centrée sur (cx, cy). Boîte ≈ 28×32 px (de -14 à +14 en x, -16 à +16 en y).
export function eagleFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, m: FaceMood): void {
  ctx.save();
  // Recoil d'anticipation : avant un cri, la tête se ramasse vers le bas/arrière
  // (squash de préparation), comme un ressort qu'on comprime avant de relâcher.
  const recoilY = m.recoil * 2.5;
  ctx.translate(Math.round(cx), Math.round(cy + recoilY));

  // Squash & stretch « juicy » à l'impact (m.pop). Au lieu d'un zoom uniforme, la
  // tête s'ÉCRASE (large + plate) au pic du choc puis REBONDIT (étroite + haute) en
  // overshoot quand pop redescend — courbe en sin pour le rebond élastique.
  // L'anticipation (recoil) pré-écrase aussi un peu, dans le même langage.
  const squash = m.pop;                          // 0..1 intensité du choc
  const wobble = Math.sin(m.pop * Math.PI);      // pic à mi-course → rebond
  const sx = 1 + 0.14 * squash - 0.10 * m.recoil; // large à l'impact, ramassé au recoil
  const sy = 1 - 0.10 * wobble + 0.06 * squash;   // plate au pic, puis légèrement haute
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
  };

  // épaules brunes (derrière la tête) — restent accrochées au corps.
  px(-14, 7, 6, 9, FACE.nape);  px(-14, 7, 6, 1, "#8a5a2c");
  px(8, 7, 6, 9, FACE.nape);    px(8, 7, 6, 1, "#8a5a2c");
  px(-14, 14, 6, 2, FACE.napeLo); px(8, 14, 6, 2, FACE.napeLo);

  // La tête (crâne + traits) redescend de quelques px sur les épaules : elle est
  // plus courte depuis qu'elle est carrée, donc on la rabaisse pour qu'elle pose
  // bien sur le corps au lieu de flotter. Les épaules (ci-dessus) ne bougent pas.
  ctx.translate(0, 3);

  // Tête carrée à coins arrondis — silhouette chunky façon pegs & boutons : boîte
  // ~24×24 (aussi large que haute), bords longs et droits, coins courbés d'un rayon
  // 2px (recul 2px + une marche d'1px, même langage que roundStrokeRect).
  // Boîte : x ∈ [-12,+11], y ∈ [-14,+9].
  px(-10, -14, 20, 1, FACE.head);    // bord haut (rentré de 2px = rayon du coin)
  px(-11, -13, 22, 1, FACE.head);    // marche d'arrondi haute (rentrée d'1px)
  px(-12, -12, 24, 20, FACE.head);   // corps plein pleine largeur (y -12 → +7)
  px(-11, 8, 22, 1, FACE.head);      // marche d'arrondi basse (rentrée d'1px)
  px(-10, 9, 20, 1, FACE.head);      // bord bas (rentré de 2px)
  // Liserés clair/sombre du bevel + ombres bas/droite.
  px(-10, -14, 20, 1, FACE.headHi);  // arête haute claire
  px(-12, -12, 1, 20, FACE.headHi);  // arête gauche claire
  px(11, -12, 1, 20, FACE.headLo);   // arête droite sombre
  px(-10, 9, 20, 1, FACE.headLo2);   // arête basse sombre
  // Reflet « L » signature — posé dans le coin haut-gauche, à +1,+1 du bord arrondi,
  // exactement comme cornerHighlightL des pegs/œufs/balle : barre horizontale 2×1
  // + verticale 1×2. Le coin du crâne démarre à (-11,-13) → L à (-10,-12).
  px(-10, -12, 2, 1, "#ffffff");
  px(-10, -12, 1, 2, "#ffffff");

  // sourcils / expression
  if (m.brow === "angry") {
    // V féroce — coins ext hauts, coins int bas
    px(-11, -9, 4, 2, FACE.brow); px(-8, -7, 4, 2, FACE.brow);
    px(7, -9, 4, 2, FACE.brow);   px(4, -7, 4, 2, FACE.brow);
  } else if (m.brow === "up") {
    // Λ inquiet — coins int hauts, coins ext bas + goutte de sueur
    px(-11, -7, 4, 2, FACE.brow); px(-8, -9, 4, 2, FACE.brow);
    px(7, -7, 4, 2, FACE.brow);   px(4, -9, 4, 2, FACE.brow);
  } else if (m.brow === "happy") {
    // Relevés aux extrémités → arc heureux ∪
    px(-11, -10, 3, 2, FACE.brow); px(-8, -9, 2, 2, FACE.brow);
    px(8, -10, 3, 2, FACE.brow);   px(6, -9, 2, 2, FACE.brow);
  } else if (m.brow === "smug") {
    // Asymétrique : gauche légèrement relevé (arrogance), droit plat
    px(-11, -9, 3, 2, FACE.brow); px(-8, -8, 2, 2, FACE.brow);
    px(6, -8, 5, 2, FACE.brow);
  } else if (m.brow === "drowsy") {
    // Tombants et bas → paupières lourdes
    px(-11, -6, 5, 2, FACE.brow); px(6, -6, 5, 2, FACE.brow);
  } else {
    px(-11, -8, 5, 2, FACE.brow); px(6, -8, 5, 2, FACE.brow);
  }

  // yeux
  for (const sgn of [-1, 1]) {
    const ex = sgn * 7;

    // Blink / wink : fermeture d'un ou deux yeux
    const eyeBlinking =
      m.blink === "both" ||
      (m.blink === "wink-l" && sgn === -1) ||
      (m.blink === "wink-r" && sgn === 1);
    if (eyeBlinking) {
      px(ex - 3, -3, 6, 1, FACE.headLo2);
      continue;
    }

    // Yeux somnolents : iris réduit + paupière tombante sur le dessus
    if (m.drowsyEyes) {
      px(ex - 3, -2, 6, 3, m.eyeRed ? FACE.irisRed : FACE.iris);
      px(ex - 3, -4, 6, 2, FACE.headLo2);
      px(ex - 1, -1, 2, 2, m.eyeRed ? FACE.pupilRed : FACE.pupil);
      continue;
    }

    // Yeux étoile (victoire) : fond doré + croix blanche en ★
    if (m.starEyes) {
      const irisY = -4;
      px(ex - 3, irisY, 6, 5, FACE.irisStar);
      px(ex - 3, irisY, 6, 1, "rgba(0,0,0,0.25)");
      px(ex,     irisY,     1, 5, "#ffffff");               // barre verticale
      px(ex - 3, irisY + 2, 6, 1, "#ffffff");               // barre horizontale
      px(ex - 2, irisY + 1, 1, 1, "rgba(255,255,255,0.7)"); // diag haut-gauche
      px(ex + 1, irisY + 3, 1, 1, "rgba(255,255,255,0.7)"); // diag bas-droit
      continue;
    }

    // Yeux normaux
    const irisH = m.wide ? 7 : 5;
    const irisY = m.wide ? -5 : -4;
    px(ex - 3, irisY, 6, irisH, m.eyeRed ? FACE.irisRed : FACE.iris);
    px(ex - 3, irisY, 6, 1, "rgba(0,0,0,0.35)");
    const lk = Math.round(m.look);
    px(ex - 1 + lk, irisY + 1, 2, 3, m.eyeRed ? FACE.pupilRed : FACE.pupil);
    px(ex - 1 + lk, irisY + 1, 1, 1, FACE.headHi);
  }

  // bec supérieur
  px(-4, -1, 8, 2, FACE.beak);
  px(-3, 1, 6, 2, FACE.beak);
  px(-2, 3, 4, 1, FACE.beak);
  px(-4, -1, 1, 4, FACE.beakHi);
  px(3, -1, 1, 4, FACE.beakLo);
  // deux narines symétriques (une de chaque côté de l'arête du bec)
  px(-2, 0, 1, 1, FACE.beakTip);
  px(1, 0, 1, 1, FACE.beakTip);

  // mandibule inférieure
  const d = Math.round(m.open * 5);
  const ly = 4 + d;
  if (d > 0) {
    px(-3, 4, 6, d, FACE.mouth);
    px(-1, 4, 2, d, FACE.tongue);
  }
  px(-2, ly, 4, 2, FACE.beakLo);
  px(-2, ly, 4, 1, FACE.beak);
  px(-1, ly + 2, 2, 1, FACE.beakTip);

  // Goutte de sueur (inquiétude simple — supprimée si les larmes prennent le relais)
  if (m.brow === "up" && !m.tears) {
    px(10, -11, 2, 3, FACE.drop);
    px(10, -8, 1, 1, FACE.drop);
    px(10, -11, 1, 1, FACE.headHi);
  }

  // Larmes bilatérales (dernière balle — désespoir absolu)
  if (m.tears) {
    px(-10, 1, 2, 4, FACE.drop);  // larme œil gauche
    px(-10, 5, 1, 2, FACE.drop);
    px(8,   1, 2, 4, FACE.drop);  // larme œil droit
    px(9,   5, 1, 2, FACE.drop);
    // Petite goutte de sueur conservée pour l'effet dramatique
    px(10, -11, 2, 3, FACE.drop);
    px(10, -8,  1, 1, FACE.drop);
  }

  ctx.restore();
}

// Dérive l'expression depuis un FaceContext (jeu ou écran-titre).
export function getFaceMood(ctx: FaceContext): FaceMood {
  const { animClock, hitMag, inClutch, lowBalls, zeroPeg, ponte,
          won, aimIdleSec, bigCombo, oneBall, screech, lost,
          firing, ballNx, voidTime, orangeJoy, whiff, whiffVariant, anticip } = ctx;
  const screeching = screech > 0.01;
  const pulse = 0.5 + 0.5 * Math.sin(animClock * 6);
  const justHit = hitMag > 0;
  const burst = hitMag >= 8;
  const worried = lowBalls || zeroPeg;

  // Réactions de tir (face.ts) :
  //  • joy        → cible orange croquée : « PROIE ! » yeux étoile + bec ravi
  //  • voidFlight → l'œuf file dans le vide sans rien toucher : anticipation tendue
  //  • whiffReact → tour totalement raté : cri agacé bref
  const joy = orangeJoy > 0.2;
  const voidFlight = firing && voidTime > 0.45 && !justHit && !joy;
  const whiffReact = whiff > 0.05 && !justHit && !won && !lost;

  // Tête de raté tirée au sort (graine stable par raté) : plutôt blasé/dédaigneux
  // qu'agacé, pour le côté « bon, peu importe » comique.
  //   0 blasé total · 1 dépité (soupir) · 2 dédaigneux · 3 agacé
  type WhiffStyle = { brow: FaceMood["brow"]; eyeRed: boolean; drowsy: boolean; open: number; look: number; pop: number };
  let whiffStyle: WhiffStyle | null = null;
  if (whiffReact) {
    const v = ((whiffVariant % 4) + 4) % 4;
    whiffStyle =
      v === 0 ? { brow: "drowsy", eyeRed: false, drowsy: true,  open: 0,            look: 0.9, pop: 0 }
    : v === 1 ? { brow: "up",     eyeRed: false, drowsy: false, open: 0.28,         look: 0.5, pop: 0 }
    : v === 2 ? { brow: "smug",   eyeRed: false, drowsy: false, open: 0,            look: 1.0, pop: 0 }
    :           { brow: "angry",  eyeRed: true,  drowsy: false, open: 0.45 * whiff, look: 0,   pop: whiff * 0.5 };
  }

  // Somnolence : idle en aim > 5s, sans perturbation
  const sleepy = aimIdleSec > 5 && !justHit && !inClutch && !won;
  const yawnP  = sleepy ? Math.min(1, (aimIdleSec - 5) / 2) : 0;

  // Rage : a raté TOUS les pegs le tour dernier, hors situation critique
  const rage = zeroPeg && !lowBalls && !inClutch && !won;

  // Blink / wink — désactivé en fever, victoire, somnolence, vol ou pendant un cri
  let blink: FaceMood["blink"] = "none";
  if (!justHit && !inClutch && !won && !sleepy && !screeching && !lost && !firing && ponte < 0.1) {
    const blinkT = animClock % 3.2;
    if (blinkT < 0.12) {
      // Pseudo-aléatoire stable par cycle (fhash-style)
      const idx = Math.floor(animClock / 3.2);
      const h = Math.abs(Math.sin(idx * 127.1 + 311.7) * 43758.5453 % 1);
      if (h < 0.18) {
        // ~18% des clignements → wink (côté aléatoire stable)
        blink = Math.abs(Math.sin(idx * 79.3) * 43758.5 % 1) < 0.5 ? "wink-l" : "wink-r";
      } else {
        blink = "both";
      }
    }
  }

  // Sourcils (priorité décroissante)
  let brow: FaceMood["brow"];
  if (won)                       brow = "happy";
  else if (lost)                 brow = "angry";   // défaite : sourcils féroces (dégoût)
  else if (joy)                  brow = "happy";   // cible orange croquée : jubilation
  else if (sleepy)               brow = "drowsy";
  else if (whiffStyle)           brow = whiffStyle.brow;  // raté : tête tirée au sort
  else if (rage)                 brow = "angry";
  else if (inClutch || burst)    brow = "angry";
  else if (voidFlight)           brow = "up";      // œuf dans le vide : anticipation
  else if (bigCombo && !worried) brow = "smug";
  else if (worried)              brow = "up";
  else                           brow = "flat";

  // Ouverture du bec — un cri (screech) prime sur tout le reste
  const open =
    screeching            ? screech                   // bec grand ouvert pendant le cri
    : inClutch              ? 0.45 + 0.4 * pulse
    : won                 ? 0.6 + 0.35 * pulse        // cri de victoire
    : joy                 ? 0.55 + 0.4 * orangeJoy    // cri de joie « proie ! »
    : sleepy && yawnP > 0.2 ? yawnP                   // bâillement progressif
    : ponte > 0.2         ? ponte
    : justHit             ? (burst ? 1 : 0.55)
    : whiffStyle          ? whiffStyle.open            // raté : selon la tête tirée
    : voidFlight          ? 0.14                      // bec entrouvert, tendu
    : bigCombo && !worried ? 0.18                     // sourire smug entrouvert
    : 0;

  return {
    blink,
    open,
    brow,
    eyeRed: inClutch || rage || (whiffStyle?.eyeRed ?? false),
    wide: (justHit && !sleepy) || screeching || joy || voidFlight,
    look: lost                      ? -1.0                 // défaite : détourne le regard, écœuré
        : firing                    ? Math.max(-1.4, Math.min(1.4, ballNx * 1.4))  // suit l'œuf en vol
        : justHit || inClutch       ? 0
        : whiffStyle                ? whiffStyle.look      // raté : regard tiré au sort
        : sleepy                    ? 0.4                  // regard tombant côté
        : bigCombo && !worried      ? 1.0                  // smug = regard de côté
        : Math.sin(animClock * 0.6) * 1.2,
    pop: Math.max(Math.min(1, hitMag / 9), whiffStyle?.pop ?? 0),  // recul à l'impact / au raté agacé
    starEyes: won || joy,                                 // yeux étoile aussi sur cible orange
    tears: oneBall && !won,
    drowsyEyes: sleepy || lost || (whiffStyle?.drowsy ?? false),   // paupières lourdes = blasé / dégoûté
    recoil: anticip,                                      // ressort d'anticipation avant le cri
  };
}
