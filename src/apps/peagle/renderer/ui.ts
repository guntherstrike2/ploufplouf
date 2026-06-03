import { W, H, BUCKET_W, BUCKET_H, LAUNCHER_Y, LAUNCHER_MARGIN } from "../engine/constants";
import { computeAimLine } from "../engine/physics";
import { getActiveBird, getActiveBucket, getActiveAssetId, EAGLE_BODY, EAGLE_WING, EAGLE_WING_PIVOT, EAGLE_WING_ANCHOR } from "../engine/assets";
import type { BirdSprite, BucketStyle } from "../engine/assets";
import type { GameState } from "../engine/types";
import { eagleFace, getFaceMood } from "./face";

// ── Offscreen canvas pour l'aigle — isole le corps des ailes/pattes ─────────
// Le corps a des pixels '.' transparents sur ses bords. Sans isolation, les ailes
// et pattes dessinées dessous transparaissent à travers ces zones. On règle ça
// en dessinant ailes+pattes sur un offscreen, en effaçant la silhouette du corps
// (destination-out), puis en dessinant les pixels du corps par-dessus.
const EAGLE_OFF_W = 56;
const EAGLE_OFF_H = 60;
const EAGLE_OFF_CX = 28;  // centre aigle en x sur l'offscreen
const EAGLE_OFF_CY = 22;  // centre aigle en y sur l'offscreen (body top = -19 ↔ row 3)

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

// Une patte d'aigle (tibia orange + 3 doigts en éventail), dessinée pointant
// vers +y. `dir` = -1 (gauche) / +1 (droite) ; `ang` = ouverture vers l'extérieur.
function drawTalonLeg(ctx: CanvasRenderingContext2D, dir: number, hipX: number, hipY: number, ang: number, len: number): void {
  const ORANGE = "#f0a81e", DARK = "#b97812", OUT = "#1a120a";
  ctx.save();
  ctx.translate(dir * hipX, hipY);
  ctx.rotate(-dir * ang); // ouverture vers l'extérieur (axe y vers le bas)
  // tibia
  ctx.fillStyle = OUT; ctx.fillRect(-2, -1, 4, len + 2);
  ctx.fillStyle = ORANGE; ctx.fillRect(-1.5, 0, 3, len);
  ctx.fillStyle = DARK; ctx.fillRect(0.3, 1, 1, len - 1);
  // pied : 3 doigts en éventail
  for (const toe of [-0.5, 0, 0.5]) {
    ctx.save();
    ctx.translate(0, len);
    ctx.rotate(toe);
    ctx.fillStyle = OUT; ctx.fillRect(-1.5, 0, 3, 7);
    ctx.fillStyle = ORANGE; ctx.fillRect(-1, 0, 2, 6);
    ctx.restore();
  }
  ctx.restore();
}

// Pattes de l'aigle, dessinées à part pour pouvoir s'écarter à la ponte.
// `swing` = balancier du bassin (pendule) → les pattes pendouillent et traînent
// quand l'aigle se déplace, comme sur l'écran-titre. L'écartement reste piloté
// par `ponte` (mécanique de ponte conservée).
function drawEagleLegs(ctx: CanvasRenderingContext2D, ponte: number, swing: number): void {
  const ang = 0.12 + ponte * 0.8; // 0.12 rad au repos → grand écart à la ponte
  ctx.save();
  ctx.translate(0, 9);    // pivot de hanche
  ctx.rotate(swing);      // tout le bassin balance
  drawTalonLeg(ctx, -1, 3.5, 3, ang, 13);
  drawTalonLeg(ctx, +1, 3.5, 3, ang, 13);
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
function drawEagleWings(ctx: CanvasRenderingContext2D, flap: number): void {
  const wing = getWingCanvas();
  if (!wing) return;
  const { x: ax, y: ay } = EAGLE_WING_ANCHOR;
  const { x: pvx, y: pvy } = EAGLE_WING_PIVOT;
  ctx.imageSmoothingEnabled = false;
  for (const dir of [-1, 1] as const) {
    ctx.save();
    ctx.translate(dir * -ax, ay);      // épaule (x miroité pour la droite)
    if (dir > 0) ctx.scale(-1, 1);     // aile droite = miroir
    ctx.rotate(flap);
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
    const flap = Math.sin(phase) * (0.35 + speed * 0.3); // bat plus fort en mouvement
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
      drawEagleWings(offCtx, flap);
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
      drawEagleWings(ctx, flap);
      drawEagleLegs(ctx, ponte, legSwing);
      drawBirdSkin(ctx, EAGLE_BODY, 0, 0, 1);
    }
    // Tête Doom réactive par-dessus le sprite — même expressions que le HUD
    eagleFace(ctx, 0, -13, getFaceMood(s));
  } else {
    // Autres oiseaux : grille unique, taille cible ~48px.
    const skin = getActiveBird();
    const cols = skin.grid[0]?.length ?? 9;
    const cellPx = Math.max(1, Math.round(48 / cols));
    drawBirdSkin(ctx, skin, 0, 0, cellPx);
  }

  ctx.restore();
}


function drawTwig(ctx: CanvasRenderingContext2D, cx: number, cy: number, sx: number, sy: number, ex: number, ey: number, color: string): void {
  const steps = Math.max(Math.abs(ex - sx), Math.abs(ey - sy));
  if (steps === 0) return;
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = Math.round(cx + sx + (ex - sx) * t);
    const py = Math.round(cy + sy + (ey - sy) * t);
    ctx.fillRect(px, py, 1, 1);
  }
}

function drawNest(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  style: BucketStyle,
  flash: boolean,
  animClock: number,
): void {
  cx = Math.round(cx);
  const nW = w + 16;
  const nH = Math.round(h * 1.95);
  const bot = Math.round(cy + h * 0.5);
  const top = bot - nH;

  // ── Ombre portée ──────────────────────────────────────────────────────────
  for (let i = 0; i < 6; i++) {
    const sw = nW + 4 - i * 2;
    ctx.fillStyle = `rgba(0,0,0,${(0.24 - i * 0.038).toFixed(3)})`;
    ctx.fillRect(cx - Math.round(sw / 2), bot + i, sw, 1);
  }

  // ── Corps — cuvette U de base (nestDark) ──────────────────────────────────
  for (let y = top; y < bot; y++) {
    const t = (y - top) / nH;
    const rHW = Math.round((nW / 2) * (0.38 + 0.62 * Math.sqrt(t)));
    ctx.fillStyle = style.nestDark;
    ctx.fillRect(cx - rHW, y, rHW * 2, 1);
  }

  // ── Croisillons tissés \ (brindilles nestMid) ──────────────────────────────
  ctx.fillStyle = style.nestMid;
  for (let y = top; y < bot; y++) {
    const t = (y - top) / nH;
    const rHW = Math.round((nW / 2) * (0.38 + 0.62 * Math.sqrt(t)));
    const rX = cx - rHW;
    for (let x = rX; x < rX + rHW * 2; x++) {
      if (((x + y) % 7 + 7) % 7 < 2) ctx.fillRect(x, y, 1, 1);
    }
  }

  // ── Croisillons tissés / (brindilles nestLight) ────────────────────────────
  ctx.fillStyle = style.nestLight;
  for (let y = top; y < bot; y++) {
    const t = (y - top) / nH;
    const rHW = Math.round((nW / 2) * (0.38 + 0.62 * Math.sqrt(t)));
    const rX = cx - rHW;
    for (let x = rX; x < rX + rHW * 2; x++) {
      if (((x - y + 1000) % 9) < 2) ctx.fillRect(x, y, 1, 1);
    }
  }

  // ── Rebord — anneau elliptique 3D ─────────────────────────────────────────
  // Anneau dessiné en scan-lines : pour chaque dy, bras gauche + bras droit
  // La couleur varie selon dy : plus clair en haut (lumière rasante), sombre en bas
  const rimRx = nW / 2;
  const rimRy = 9;
  const rimThick = 15;
  const rimCy = top + rimRy;

  for (let dy = -rimRy; dy <= rimRy; dy++) {
    const y = Math.round(rimCy + dy);
    const outerHW = Math.round(rimRx * Math.sqrt(Math.max(0, 1 - (dy / rimRy) ** 2)));
    if (outerHW <= 0) continue;
    const innerHW = Math.max(0, outerHW - rimThick);
    const shade = dy < -rimRy * 0.55 ? style.nestRim
                : dy < rimRy * 0.1   ? style.nestLight
                                     : style.nestMid;
    ctx.fillStyle = shade;
    if (innerHW > 0) {
      ctx.fillRect(cx - outerHW, y, outerHW - innerHW, 1);
      ctx.fillRect(cx + innerHW, y, outerHW - innerHW, 1);
    } else {
      ctx.fillRect(cx - outerHW, y, outerHW * 2, 1);
    }
  }

  // ── Brindilles qui dépassent du rebord — organic fringe ───────────────────
  // Paires gauche (sx/ex négatifs) ; droite = miroir automatique
  const strayPairs: [number, number, number, number][] = [
    [-rimRx - 5,  2, -rimRx +  7, -4],
    [-rimRx - 2,  6, -rimRx + 10,  1],
    [-rimRx + 2, -3, -rimRx + 15,  3],
    [-rimRx + 5,  8, -rimRx + 17,  2],
    [-rimRx + 10,-2, -rimRx + 22,  5],
    [-rimRx + 14, 9, -rimRx + 24,  3],
  ];
  for (const [sx, sy, ex, ey] of strayPairs) {
    drawTwig(ctx, cx, rimCy, sx, sy, ex, ey, style.nestRim);
    drawTwig(ctx, cx, rimCy, -sx, sy, -ex, ey, style.nestRim);
  }
  for (const [sx, sy, ex, ey] of strayPairs) {
    drawTwig(ctx, cx, rimCy + 1, sx, sy + 1, ex, ey + 1, style.nestMid);
    drawTwig(ctx, cx, rimCy + 1, -sx, sy + 1, -ex, ey + 1, style.nestMid);
  }

  // ── Creux intérieur — ombre profonde + duvet ──────────────────────────────
  const cavHW = Math.round(rimRx - rimThick + 2);
  const cavOpenY = Math.round(rimCy);
  const cavBot = bot - 2;
  const cavH = cavBot - cavOpenY;

  for (let row = 0; row < cavH; row++) {
    const t = row / cavH;
    ctx.fillStyle = `rgba(0,0,0,${(0.65 - t * 0.3).toFixed(2)})`;
    ctx.fillRect(cx - cavHW, cavOpenY + row, cavHW * 2, 1);
  }

  // Duvet — fond sombre progressif
  ctx.fillStyle = style.nestDark;
  for (let row = 3; row < cavH - 1; row++) {
    const t = row / cavH;
    const lHW = Math.round(cavHW * (0.25 + 0.75 * t));
    ctx.fillRect(cx - lHW, cavOpenY + row, lHW * 2, 1);
  }
  // Granulés mousse
  ctx.fillStyle = style.nestMid;
  for (let row = 4; row < cavH - 1; row += 2) {
    const t = row / cavH;
    const lHW = Math.round(cavHW * (0.2 + 0.7 * t));
    const lX = cx - lHW;
    for (let x = lX + 1; x < lX + lHW * 2 - 1; x++) {
      if ((x + row) % 3 === 0) ctx.fillRect(x, cavOpenY + row, 1, 1);
    }
  }

  // ── Œuf — ellipse pixel art avec taper au sommet ──────────────────────────
  const eggCx = cx;
  const eggRx = Math.round(cavHW * 0.54);
  const eggRy = Math.round(cavH * 0.47);
  const eggCy = cavBot - eggRy - 1;

  if (flash) {
    // Halo pulsé — faux glow pixel (3 rects concentriques) au lieu de ctx.shadowBlur,
    // cohérent avec pixelGlow (pegs.ts) / le glow de la balle : ~10× moins cher (pas de passe gaussienne GPU).
    const glow = 0.6 + 0.4 * Math.sin(animClock * 9);
    const gx0 = eggCx - eggRx, gy0 = eggCy - eggRy, gw = eggRx * 2, gh = eggRy * 2;
    const b = 14 * glow;
    const b1 = Math.ceil(b * 0.3), b2 = Math.ceil(b * 0.6), b3 = Math.ceil(b);
    ctx.fillStyle = style.eggHi;
    ctx.globalAlpha = 0.28; ctx.fillRect(gx0 - b1, gy0 - b1, gw + b1 * 2, gh + b1 * 2);
    ctx.globalAlpha = 0.13; ctx.fillRect(gx0 - b2, gy0 - b2, gw + b2 * 2, gh + b2 * 2);
    ctx.globalAlpha = 0.06; ctx.fillRect(gx0 - b3, gy0 - b3, gw + b3 * 2, gh + b3 * 2);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = style.egg;
  for (let dy = -eggRy; dy <= eggRy; dy++) {
    const topTaper = dy < 0 ? 0.88 : 1.0;
    const hw = Math.round(eggRx * topTaper * Math.sqrt(Math.max(0, 1 - (dy / eggRy) ** 2)));
    if (hw <= 0) continue;
    ctx.fillRect(eggCx - hw, eggCy + dy, hw * 2, 1);
  }

  // Reflet haut-gauche
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillRect(eggCx - eggRx + 2, eggCy - eggRy + 1, 4, 1);
  ctx.fillRect(eggCx - eggRx + 1, eggCy - eggRy + 2, 2, 3);

  // Taches (speckles)
  ctx.fillStyle = flash ? "rgba(255,255,255,0.5)" : "rgba(55,28,8,0.42)";
  ctx.fillRect(eggCx - 2,         eggCy - eggRy + 4,  2, 1);
  ctx.fillRect(eggCx + eggRx - 5, eggCy - 2,          2, 1);
  ctx.fillRect(eggCx - eggRx + 3, eggCy + 2,          1, 2);
  ctx.fillRect(eggCx + 1,         eggCy + eggRy - 3,  2, 1);
  ctx.fillRect(eggCx - 1,         eggCy + 2,          1, 1);
}

export function drawBuckets(ctx: CanvasRenderingContext2D, s: GameState): void {
  const bucketMidY = H - BUCKET_H / 2 - 4;
  const bucket = getActiveBucket();
  ctx.save();
  drawNest(ctx, s.bucket + BUCKET_W / 2, bucketMidY, BUCKET_W, BUCKET_H + 4, bucket, s.bucketFlash > 0, s.animClock);
  ctx.restore();

  // Sol herbeux sous les nids
  ctx.fillStyle = "#3a8c28";
  ctx.fillRect(0, H - 4, W, 4);
  ctx.fillStyle = "#4eb038";
  ctx.fillRect(0, H - 4, W, 1);
}
