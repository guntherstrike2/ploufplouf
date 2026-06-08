import { W, H, BUCKET_W, BUCKET_H, BUCKET_CATCH_HALF_W, LAUNCHER_Y, LAUNCHER_MARGIN } from "../engine/constants";
import { computeAimLine } from "../engine/physics";
import { getActiveBird, getActiveBucket, getActiveAssetId, EAGLE_BODY, EAGLE_WING, EAGLE_WING_PIVOT, EAGLE_WING_ANCHOR } from "../engine/assets";
import type { BirdSprite, BucketStyle } from "../engine/assets";
import type { GameState } from "../engine/types";
import { eagleFace, getFaceMood, gameFaceCtx } from "./face";
import { chunkPlate, cornerHighlightL, pixelGlow3 } from "./helpers";

// ── Offscreen canvas pour l'aigle — isole le corps des ailes/pattes ─────────
// Le corps a des pixels '.' transparents sur ses bords. Sans isolation, les ailes
// et pattes dessinées dessous transparaissent à travers ces zones. On règle ça
// en dessinant ailes+pattes sur un offscreen, en effaçant la silhouette du corps
// (destination-out), puis en dessinant les pixels du corps par-dessus.
// Le tampon doit contenir les ailes déployées au pire cas (battoirs chunky + flap +
// squash/stretch) : ~±42px de demi-largeur en bout d'aile, d'où W=96 (CX=48). Le
// drawImage final re-décale de -CX/-CY donc agrandir le tampon ne déplace rien au
// rendu — ça évite seulement que les bouts d'aile soient rognés par le bord du canvas.
const EAGLE_OFF_W = 96;
const EAGLE_OFF_H = 68;
const EAGLE_OFF_CX = 48;  // centre aigle en x sur l'offscreen
const EAGLE_OFF_CY = 24;  // centre aigle en y sur l'offscreen

let _eagleOffCv: HTMLCanvasElement | null = null;
let _eagleOffCtx: CanvasRenderingContext2D | null = null;

function getEagleOffscreen(): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === "undefined") return null;
  if (!_eagleOffCv) {
    _eagleOffCv = document.createElement("canvas");
    _eagleOffCv.width = EAGLE_OFF_W;
    _eagleOffCv.height = EAGLE_OFF_H;
    _eagleOffCtx = _eagleOffCv.getContext("2d");
  }
  return _eagleOffCtx ? [_eagleOffCv, _eagleOffCtx] : null;
}

// Silhouette du corps pré-calculée : span [left, right] par ligne.
const _bCols = EAGLE_BODY.grid[0]?.length ?? 48;
const _bRows = EAGLE_BODY.grid.length;
const _bodyOx = -Math.round(_bCols / 2);  // = -24
const _bodyOy = -Math.round(_bRows / 2);  // = -19
const _bodyRowSpans: Array<[number, number] | null> = EAGLE_BODY.grid.map(row => {
  let l = row.length, r = -1;
  for (let c = 0; c < row.length; c++) {
    if (row[c] !== '.') { if (c < l) l = c; if (c > r) r = c; }
  }
  return r >= 0 ? [l, r] : null;
});

function drawBirdSkin(ctx: CanvasRenderingContext2D, skin: BirdSprite, cx: number, cy: number, cellPx: number) {
  const rows = skin.grid.length;
  const cols = skin.grid[0]?.length ?? 9;
  const ox = cx - (cols * cellPx) / 2;
  const oy = cy - (rows * cellPx) / 2;
  for (let r = 0; r < rows; r++) {
    const row = skin.grid[r]!;
    for (let c = 0; c < cols; c++) {
      const ch = row[c]!;
      if (ch === ".") continue;
      const color = skin.palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(ox + c * cellPx), Math.round(oy + r * cellPx), cellPx, cellPx);
    }
  }
}

// Gradient caché pour le halo du launcher (re-créé si le ctx change).
let _haloCtx: CanvasRenderingContext2D | null = null;
let _haloGrad: CanvasGradient | null = null;
function getLauncherHalo(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (_haloCtx !== ctx) {
    _haloCtx = ctx;
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 42);
    g.addColorStop(0, "rgba(255,222,120,1)");
    g.addColorStop(1, "rgba(255,222,120,0)");
    _haloGrad = g;
  }
  return _haloGrad!;
}

// Aim line cache — computeAimLine is O(steps × pegs) = ~21 000 ops/frame.
// During aim phase, pegs never change, so we only recompute when angle or hit
// state changes. hitSerial = count of hit pegs (O(N) but 120 iters ≪ 21 000).
const _aimCache = { angle: NaN, level: -1, hitSerial: -1, lx: NaN, pts: [] as { x: number; y: number }[] };

export function drawAimLine(ctx: CanvasRenderingContext2D, s: GameState, aimAngle: number): void {
  if (s.phase !== "aim") return;

  let hitSerial = 0;
  for (const p of s.pegs) if (p.hit) hitSerial++;

  const lxRounded = Math.round(s.launcherX);
  if (
    _aimCache.level !== s.level ||
    _aimCache.hitSerial !== hitSerial ||
    _aimCache.lx !== lxRounded ||
    Math.abs(_aimCache.angle - aimAngle) >= 0.001
  ) {
    _aimCache.pts = computeAimLine(s.launcherX, LAUNCHER_Y, aimAngle, s.pegs, s.effectiveBallR, s.effectiveAimSteps);
    _aimCache.angle = aimAngle;
    _aimCache.level = s.level;
    _aimCache.hitSerial = hitSerial;
    _aimCache.lx = lxRounded;
  }

  const pts = _aimCache.pts;
  if (pts.length < 2) return;

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.lineDashOffset = -(s.animClock * 33);

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.68)";
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.stroke();

  ctx.restore();
}

// Une patte d'aigle = 4 rectangles arrondis (roundRect natif) : 1 jambe + 3 doigts
// en éventail. `dir` = -1 (gauche) / +1 (droite) ; `ang` = ouverture vers l'extérieur.
// Même esprit chunky que les pegs : bloc orange + reflet « L » blanc en haut-gauche.
function drawTalonLeg(ctx: CanvasRenderingContext2D, dir: number, hipX: number, hipY: number, ang: number, len: number): void {
  const ORANGE = "#f0a81e", HI = "#ffc24a";

  // Un rectangle arrondi orange avec reflet « L » blanc au coin haut-gauche.
  const chunk = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.fillStyle = ORANGE;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    // Reflet « L » blanc dans le coin haut-gauche (signature DA des pegs/tête).
    ctx.strokeStyle = HI;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 1.5, y + r + 2);
    ctx.lineTo(x + 1.5, y + r);
    ctx.arcTo(x + 1.5, y + 1.5, x + r, y + 1.5, r);
    ctx.lineTo(x + r + 2, y + 1.5);
    ctx.stroke();
  };

  ctx.save();
  ctx.translate(dir * hipX, hipY);
  ctx.rotate(-dir * ang); // ouverture vers l'extérieur (axe y vers le bas)

  // 1) la jambe (tibia épais).
  chunk(-3, -1, 6, len + 3, 1.5);

  // 2-4) les 3 doigts en éventail.
  for (const toe of [-0.42, 0, 0.42]) {
    ctx.save();
    ctx.translate(0, len);
    ctx.rotate(toe);
    chunk(-1.5, 0, 3, 9, 1);
    ctx.restore();
  }
  ctx.restore();
}

// Pattes de l'aigle, dessinées à part pour pouvoir s'écarter à la ponte.
// `swing` = balancier du bassin (pendule) → les pattes pendouillent et traînent
// quand l'aigle se déplace, comme sur l'écran-titre. L'écartement reste piloté
// par `ponte` (mécanique de ponte conservée).
function drawEagleLegs(ctx: CanvasRenderingContext2D, ponte: number, swing: number): void {
  const ang = 0.1 + ponte * 0.8; // léger écart au repos → grand écart à la ponte
  ctx.save();
  ctx.translate(0, 5);    // pivot de hanche
  ctx.rotate(swing);      // tout le bassin balance
  // Hanches écartées (±5) pour loger les tibias épais sans qu'ils se chevauchent.
  drawTalonLeg(ctx, -1, 5, 3, ang, 12);
  drawTalonLeg(ctx, +1, 5, 3, ang, 12);
  ctx.restore();
}

// Aile de l'aigle pré-rendue sur un canvas hors-écran : on la fait pivoter via
// drawImage (rotation bitmap → pas de trous, contrairement à des fillRect tournés).
let _wingCanvas: HTMLCanvasElement | null = null;
function getWingCanvas(): HTMLCanvasElement | null {
  if (_wingCanvas) return _wingCanvas;
  if (typeof document === "undefined") return null;
  const g = EAGLE_WING.grid, rows = g.length, cols = g[0]?.length ?? 0;
  const cv = document.createElement("canvas");
  cv.width = cols; cv.height = rows;
  const c = cv.getContext("2d");
  if (!c) return null;
  for (let r = 0; r < rows; r++) {
    const row = g[r]!;
    for (let x = 0; x < cols; x++) {
      const ch = row[x]!;
      const col = ch === "." ? null : EAGLE_WING.palette[ch];
      if (col) { c.fillStyle = col; c.fillRect(x, r, 1, 1); }
    }
  }
  _wingCanvas = cv;
  return cv;
}

// Battement : chaque aile tourne autour de l'épaule (ancre). `flap` < 0 = aile
// levée, > 0 = aile baissée. La droite est l'image miroir de la gauche.
//
// Squash & stretch « juicy » : `flapVel` = vitesse angulaire du battement (= flap',
// >0 en descente). En descente l'aile s'ÉTIRE le long de l'envergure (x) et
// s'AMINCIT (y) — elle fend l'air ; en montée elle s'ÉCRASE et s'ÉPAISSIT, comme
// un élastique qui se replie. Le bout d'aile traîne d'un cran (follow-through) via
// une rotation additionnelle proportionnelle à la vitesse, appliquée autour du
// pivot mais amplifiée loin de l'épaule par le stretch en x.
function drawEagleWings(ctx: CanvasRenderingContext2D, flap: number, flapVel: number): void {
  const wing = getWingCanvas();
  if (!wing) return;
  const { x: ax, y: ay } = EAGLE_WING_ANCHOR;
  const { x: pvx, y: pvy } = EAGLE_WING_PIVOT;
  // Étirement envergure (x) / amincissement (y) piloté par la vitesse de battement.
  // Borné pour rester chunky et lisible. Volume ~préservé (sx monte, sy descend).
  const v = Math.max(-1, Math.min(1, flapVel));
  const sx = 1 + v * 0.18;   // descente → aile plus longue
  const sy = 1 - v * 0.12;   // descente → aile plus fine
  // Follow-through : le bout d'aile retarde sur l'épaule (overlap d'animation).
  const drag = -v * 0.14;
  ctx.imageSmoothingEnabled = false;
  for (const dir of [-1, 1] as const) {
    ctx.save();
    ctx.translate(dir * -ax, ay);      // épaule (x miroité pour la droite)
    if (dir > 0) ctx.scale(-1, 1);     // aile droite = miroir
    ctx.rotate(flap);
    ctx.scale(sx, sy);                 // squash & stretch autour de l'épaule
    ctx.rotate(drag);                  // le bout d'aile traîne (follow-through)
    ctx.drawImage(wing, -pvx, -pvy);
    ctx.restore();
  }
}

// Traits de vent aux bouts d'ailes, visibles surtout sur la descente (flap').
function drawWindStreaks(ctx: CanvasRenderingContext2D, phase: number): void {
  const a = Math.max(0, Math.cos(phase)) * 0.22; // pic en pleine descente
  if (a < 0.02) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
  ctx.lineWidth = 1;
  for (const dir of [-1, 1] as const) {
    for (const dy of [-2, 5]) {
      ctx.beginPath();
      ctx.moveTo(dir * 24, dy);
      ctx.lineTo(dir * 31, dy); // court trait au-delà du bout d'aile
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Rail horizontal discret : signale que l'aigle se déplace de gauche à droite.
// Visible seulement en phase de visée, pulse légèrement sous l'aigle.
function drawLauncherRail(ctx: CanvasRenderingContext2D, s: GameState): void {
  if (s.phase !== "aim") return;
  const y = LAUNCHER_Y;
  const pulse = 0.5 + 0.5 * Math.sin(s.animClock * 4);
  const base = 0.14 + 0.08 * pulse + s.launcherGrab * 0.25;

  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineDashOffset = -(s.animClock * 22);
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(255,220,140,${base.toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(LAUNCHER_MARGIN, y);
  ctx.lineTo(W - LAUNCHER_MARGIN, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Chevrons au survol : deux flèches bien visibles de part et d'autre de l'aigle.
  // Apparaissent progressivement au survol, disparaissent à la saisie.
  const hoverAmt = s.launcherHovered ? (1 - s.launcherGrab) : 0;
  if (hoverAmt > 0.01) {
    const alpha = hoverAmt * (0.75 + 0.25 * pulse);
    ctx.strokeStyle = `rgba(255,240,180,${alpha.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const dir of [-1, 1] as const) {
      const cx = s.launcherX + dir * (42 + 4 * pulse);
      const arm = 9;
      ctx.beginPath();
      ctx.moveTo(cx - dir * arm, y - arm);
      ctx.lineTo(cx + dir * arm, y);
      ctx.lineTo(cx - dir * arm, y + arm);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// L'oiseau arrive de loin, tout droit : un minuscule point qui grossit jusqu'à
// la bonne taille. Effet de profondeur (zoom avant depuis la perspective).
const BIRD_ENTRY_START = 3.3;  // animClock — juste après le lever du soleil
const BIRD_ENTRY_DUR   = 1.0;  // animClock — durée de l'approche

function easeOutBack(t: number): number {
  const c1 = 2.2, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function drawLauncher(ctx: CanvasRenderingContext2D, s: GameState, aimAngle: number): void {
  drawLauncherRail(ctx, s);

  const entryRaw = (s.animClock - BIRD_ENTRY_START) / BIRD_ENTRY_DUR;
  const entryT   = Math.max(0, Math.min(1, entryRaw));
  const inEntry  = entryT < 1;

  // Phase "point lointain" : trop petit pour rendre le sprite, on dessine juste
  // un pixel doré qui pulse doucement pour rester visible.
  const entryScale = inEntry ? 0.015 + 0.985 * easeOutBack(entryT) : 1.0;
  if (inEntry && entryScale < 0.10) {
    const dotAlpha = Math.min(1, entryScale / 0.10);
    const dotS     = Math.max(2, Math.round(4 * dotAlpha));
    ctx.save();
    ctx.translate(Math.round(s.launcherX), LAUNCHER_Y);
    ctx.globalAlpha = dotAlpha * (0.7 + 0.3 * Math.sin(s.animClock * 8));
    ctx.fillStyle = "#d4a820";
    ctx.fillRect(-(dotS >> 1), -(dotS >> 1), dotS, dotS);
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  // Ailes qui battent fort pendant l'approche (vole vers nous)
  const vx    = s.launcherVx;
  const grab  = s.launcherGrab;
  const speed = inEntry
    ? Math.min(1, 0.9 * (1 - entryT) + Math.abs(vx) / 7)
    : Math.min(1, Math.abs(vx) / 7);

  ctx.save();
  ctx.translate(s.launcherX, LAUNCHER_Y);
  // Grossissement depuis un point : scale uniforme autour du centre de l'oiseau
  if (inEntry) ctx.scale(entryScale, entryScale);

  // Lueur dorée à la saisie (halo radial, derrière tout)
  if (grab > 0.01) {
    ctx.save();
    ctx.globalAlpha = 0.45 * grab;
    ctx.fillStyle = getLauncherHalo(ctx);
    ctx.fillRect(-42, -42, 84, 84);
    ctx.restore();
  }

  // Traits de vitesse traînant à l'opposé du mouvement (espace monde, non tourné)
  // Supprimés pendant l'entrée (l'oiseau arrive de face, pas de côté).
  if (speed > 0.12 && !inEntry) {
    ctx.save();
    ctx.globalAlpha = speed * 0.55;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    const dir = vx > 0 ? -1 : 1;
    for (const dy of [-9, -3, 3, 9]) {
      ctx.beginPath();
      ctx.moveTo(dir * 18, dy);
      ctx.lineTo(dir * (18 + 16 * speed), dy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Lean (banque dans le sens du déplacement) + squash & stretch + pop de saisie
  const bank = Math.max(-0.26, Math.min(0.26, vx * 0.05));
  const pop = 1 + grab * 0.12;
  ctx.rotate(bank);
  ctx.scale((1 + speed * 0.18) * pop, (1 - speed * 0.12) * pop);

  // L'œuf est pondu par les fesses : l'oiseau pointe son arrière dans la
  // direction de tir (rotation de aimAngle − π/2, soit 180° par rapport à
  // « tête en avant »).
  ctx.rotate(aimAngle - Math.PI / 2);

  if (getActiveAssetId("bird") === "aigle") {
    // ── Aigle animé : ailes qui battent (vol) + bob + pattes qui s'écartent ──
    const phase = s.animClock * 5.5;
    const amp = 0.35 + speed * 0.3;          // bat plus fort en mouvement
    const flap = Math.sin(phase) * amp;
    const flapVel = Math.cos(phase) * amp;   // vitesse de battement → squash & stretch
    const bob = Math.cos(phase) * 1.2;       // léger flottement vertical
    ctx.translate(0, bob);

    let ponte = 0;
    if (s.ball) {
      const dx = s.ball.x - s.launcherX, dy = s.ball.y - LAUNCHER_Y;
      ponte = Math.max(0, 1 - Math.hypot(dx, dy) / 70);
    }

    // Balancier des pattes : elles traînent à l'opposé du déplacement (pendule)
    // + léger frémissement idle. Le tout reste sous le corps quoi qu'il arrive.
    const legSwing =
      Math.max(-0.5, Math.min(0.5, -vx * 0.045)) +
      Math.sin(s.animClock * 3.2) * 0.06;

    drawWindStreaks(ctx, phase);             // effet de vol (derrière tout)

    // Ailes + pattes + corps via offscreen pour rendre le corps opaque :
    // destination-out efface les pixels d'ailes/pattes dans la zone du corps,
    // puis on dessine le corps par-dessus — plus de transparence parasite.
    const eagleOff = getEagleOffscreen();
    if (eagleOff) {
      const [offCv, offCtx] = eagleOff;
      offCtx.clearRect(0, 0, EAGLE_OFF_W, EAGLE_OFF_H);
      offCtx.save();
      offCtx.translate(EAGLE_OFF_CX, EAGLE_OFF_CY);
      drawEagleWings(offCtx, flap, flapVel);
      drawEagleLegs(offCtx, ponte, legSwing);
      offCtx.save();
      offCtx.globalCompositeOperation = "destination-out";
      offCtx.fillStyle = "#000";
      for (let r = 0; r < _bodyRowSpans.length; r++) {
        const span = _bodyRowSpans[r];
        if (!span) continue;
        offCtx.fillRect(_bodyOx + span[0], _bodyOy + r, span[1] - span[0] + 1, 1);
      }
      offCtx.restore();
      drawBirdSkin(offCtx, EAGLE_BODY, 0, 0, 1);
      offCtx.restore();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offCv, -EAGLE_OFF_CX, -EAGLE_OFF_CY);
    } else {
      drawEagleWings(ctx, flap, flapVel);
      drawEagleLegs(ctx, ponte, legSwing);
      drawBirdSkin(ctx, EAGLE_BODY, 0, 0, 1);
    }
    // Tête Doom réactive par-dessus le sprite — même expressions que le HUD
    eagleFace(ctx, 0, -13, getFaceMood(gameFaceCtx(s)));
  } else {
    // Autres oiseaux : grille unique, taille cible ~48px.
    const skin = getActiveBird();
    const cols = skin.grid[0]?.length ?? 9;
    const cellPx = Math.max(1, Math.round(48 / cols));
    drawBirdSkin(ctx, skin, 0, 0, cellPx);
  }

  ctx.restore();
}

// ─── Panier ─────────────────────────────────────────────────────────────────
// Géométrie du seau, partagée entre le corps statique et la hitbox de capture.
interface NestGeom {
  cx: number; nW: number; nH: number; bot: number; top: number;
  rimRx: number; rimRy: number; rimThick: number; rimCy: number;
  cavHW: number; cavOpenY: number; cavBot: number; cavH: number;
}

function nestGeom(cx: number, cy: number, w: number, h: number): NestGeom {
  cx = Math.round(cx);
  const nW = w + 16;
  const nH = Math.round(h * 1.5);
  const bot = Math.round(cy + h * 0.5);
  const top = bot - nH;
  const rimRx = nW / 2;
  const rimRy = 9;
  const rimThick = 15;
  const rimCy = top + rimRy;
  const cavHW = Math.round(rimRx - rimThick + 2);
  const cavOpenY = Math.round(rimCy);
  const cavBot = bot - 2;
  const cavH = cavBot - cavOpenY;
  return {
    cx, nW, nH, bot, top, rimRx, rimRy, rimThick, rimCy,
    cavHW, cavOpenY, cavBot, cavH,
  };
}

// Corps statique du panier — DA « chunky rounded-rect pixel art » : UN SEUL bloc
// plein, exactement la brique de base de la charte (cf. helpers.ts → chunkPlate :
// coins arrondis 2px, bevel clair haut/gauche + sombre bas/droite, contour sombre,
// reflet « L » signature). On ne le surcharge PAS de douves/cerclage/trapèze : la
// DA des pegs et de la tête d'aigle, c'est un bloc net, pas du dessin fin. Une
// simple fente sombre creusée en haut suggère l'ouverture (= zone de capture).
//
// Réemploi des tokens BucketStyle : nestLight = face, nestRim = highlight clair,
// nestMid = ombre du bevel, nestDark = contour + creux. Le bloc est ancré au sol
// (bas = `bot`) ; la ligne de capture (constants.ts → BUCKET_RIM_Y = H − 17) est
// alignée sur le haut de la fente (slotTop = bot − 15) → la hitbox épouse l'ouverture.
function drawNestBody(ctx: CanvasRenderingContext2D, g: NestGeom, style: BucketStyle): void {
  const { cx, nW, bot, cavHW } = g;
  // Le bloc : pleine largeur nW, plat (fin verticalement) et ANCRÉ AU SOL — son
  // bas touche `bot` (le bas du niveau), il monte de `blockH`. Panier ramassé,
  // posé au sol, pas une caisse flottante. L'ouverture occupe le tiers supérieur.
  const blockX = cx - Math.round(nW / 2);
  const blockW = Math.round(nW / 2) * 2;
  const blockH = 18;                          // hauteur courte — silhouette plate
  const blockBot = bot;
  const blockTop = blockBot - blockH;

  // ── Ombre portée ──────────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const sw = blockW + 4 - i * 2;
    ctx.fillStyle = `rgba(0,0,0,${(0.22 - i * 0.04).toFixed(3)})`;
    ctx.fillRect(cx - Math.round(sw / 2), blockBot + i, sw, 1);
  }

  // ── Le bloc — une seule plaquette chunky à la charte ───────────────────────
  // highlightL géré à la main après le creux (le reflet L vit au coin haut-gauche,
  // juste au-dessus de l'ouverture, donc on le repose en dernier).
  chunkPlate(ctx, blockX, blockTop, blockW, blockH, {
    fill: style.nestLight, light: style.nestRim, dark: style.nestMid,
    outline: style.nestDark, highlightL: false,
  });

  // ── Fente d'ouverture — creux sombre arrondi dans le haut du bloc ──────────
  // Largeur = cavHW (alignée sur la hitbox). Sur un bloc plat, la fente prend le
  // haut : lèvre fine au-dessus, fond à ~75 % de la hauteur.
  const slotR = 2;
  const slotTop = blockTop + 3;
  const slotBot = Math.round(blockTop + blockH * 0.75);
  for (let y = slotTop; y < slotBot; y++) {
    const dTop = y - slotTop, dBot = slotBot - 1 - y;
    const inset = dTop < slotR ? slotR - dTop : dBot < slotR ? slotR - dBot : 0;
    const w = (cavHW - inset) * 2;
    if (w <= 0) continue;
    // Dégradé de profondeur : plus sombre vers le fond.
    const t = (y - slotTop) / Math.max(1, slotBot - slotTop);
    ctx.fillStyle = style.nestDark;
    ctx.fillRect(cx - cavHW + inset, y, w, 1);
    ctx.fillStyle = `rgba(0,0,0,${(0.35 + 0.35 * t).toFixed(2)})`;
    ctx.fillRect(cx - cavHW + inset, y, w, 1);
  }
  // Lèvre interne claire en haut de la fente → l'ouverture creuse, pas posée.
  ctx.fillStyle = style.nestRim;
  ctx.fillRect(cx - cavHW + slotR, slotTop, (cavHW - slotR) * 2, 1);

  // ── Reflet « L » signature au coin haut-gauche du bloc ─────────────────────
  cornerHighlightL(ctx, blockX, blockTop, 0.7);
}

// Cache offscreen du corps du nid. Le corps est statique (couleurs du style +
// géométrie constante) et le panier ne se déplace qu'en x : on le rend une fois,
// centré sur NEST_REF_CX, puis on le blitte chaque frame avec un décalage
// horizontal ENTIER → pixel-identique pour les formes lisses, sans refaire des
// milliers de fillRect. La texture tissée devient solidaire du nid (vs scintillante
// en espace-écran auparavant) — choix assumé, plus propre.
const NEST_REF_CX = Math.round(W / 2);
let _nestCv: HTMLCanvasElement | null = null;
let _nestCtx: CanvasRenderingContext2D | null = null;
let _nestKey = "";

function getNestBodyOffscreen(cy: number, w: number, h: number, style: BucketStyle): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  // style.* sont des chaînes de couleur : la clé couvre tout ce dont dépend le corps.
  const key = `${w}:${h}:${cy}:${style.nestDark}:${style.nestMid}:${style.nestLight}:${style.nestRim}`;
  if (!_nestCv) {
    _nestCv = document.createElement("canvas");
    _nestCv.width = W;
    _nestCv.height = H;
    _nestCtx = _nestCv.getContext("2d");
  }
  if (_nestCtx && _nestKey !== key) {
    _nestCtx.clearRect(0, 0, W, H);
    drawNestBody(_nestCtx, nestGeom(NEST_REF_CX, cy, w, h), style);
    _nestKey = key;
  }
  return _nestCtx ? _nestCv : null;
}

function drawNest(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  style: BucketStyle,
): void {
  const g = nestGeom(cx, cy, w, h);
  const off = getNestBodyOffscreen(cy, w, h, style);
  if (off) {
    // Décalage entier (g.cx et NEST_REF_CX sont arrondis) → pas de rééchantillonnage.
    ctx.drawImage(off, g.cx - NEST_REF_CX, 0);
  } else {
    drawNestBody(ctx, g, style); // fallback SSR / pas de document
  }
  // drawNestEgg supprimé — l'œuf n'est plus affiché dans le nid
}

export function drawBuckets(ctx: CanvasRenderingContext2D, s: GameState): void {
  const bucketMidY = H - BUCKET_H / 2 - 4;
  const bucket = getActiveBucket();
  const cx = s.bucket + BUCKET_W / 2;
  // `bot` du bloc (cf. nestGeom) — le panier squash autour de son point d'appui au sol.
  const bot = Math.round(bucketMidY + (BUCKET_H + 4) * 0.5);
  // Haut de l'ouverture (slotTop) — repère pour le glow de capture.
  const openY = bot - 15;

  // ── Animation de capture « juicy » : squash & stretch + flash ──────────────
  // s.bucketFlash décroît 1 → 0 sur ~17 frames. p = progression 0 → 1. La courbe
  // est un ressort amorti : impact (squash : large & plat), rebond (stretch : étroit
  // & haut), puis retour au repos — anticipation/recoil/follow-through en un seul geste.
  const flash = Math.max(0, s.bucketFlash);
  let sx = 1, sy = 1;
  if (flash > 0.001) {
    const p = 1 - flash;                         // 0 (impact) → 1 (repos)
    const spring = Math.sin(p * Math.PI * 1.6) * Math.exp(-p * 3.2);
    sx = 1 + spring * 0.30;                       // large à l'impact, étroit au rebond
    sy = 1 - spring * 0.34;                        // aplati à l'impact, étiré au rebond
  }

  // Glow de capture autour de l'ouverture (faux blur pixel, cohérent avec la balle/pegs).
  if (flash > 0.02) {
    const gw = BUCKET_CATCH_HALF_W * 2, gh = 14;
    ctx.globalAlpha = flash * 0.8;
    pixelGlow3(ctx, cx - BUCKET_CATCH_HALF_W, openY - 4, gw, gh, bucket.eggHi, 13 * flash);
    ctx.globalAlpha = 1;
  }

  ctx.save();
  // Squash & stretch ancré au point d'appui (bas, centre x) → le panier ne décolle pas.
  ctx.translate(cx, bot);
  ctx.scale(sx, sy);
  ctx.translate(-cx, -bot);
  drawNest(ctx, cx, bucketMidY, BUCKET_W, BUCKET_H + 4, bucket);
  ctx.restore();

  // Éclat clair sur la lèvre de l'ouverture juste après la capture (pétille puis s'éteint).
  if (flash > 0.05) {
    ctx.globalAlpha = flash * 0.7;
    ctx.fillStyle = bucket.eggHi;
    ctx.fillRect(cx - BUCKET_CATCH_HALF_W + 6, openY, BUCKET_CATCH_HALF_W * 2 - 12, 1);
    ctx.globalAlpha = 1;
  }

  // Sol herbeux sous les nids
  ctx.fillStyle = "#3a8c28";
  ctx.fillRect(0, H - 4, W, 4);
  ctx.fillStyle = "#4eb038";
  ctx.fillRect(0, H - 4, W, 1);
}
