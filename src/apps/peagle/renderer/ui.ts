import { W, H, BUCKET_W, BUCKET_H, LAUNCHER_Y, LAUNCHER_MARGIN } from "../engine/constants";
import { computeAimLine } from "../engine/physics";
import { getActiveBird, getActiveBucket, getActiveAssetId, EAGLE_BODY, EAGLE_WING, EAGLE_WING_PIVOT, EAGLE_WING_ANCHOR } from "../engine/assets";
import type { BirdSprite, BucketStyle } from "../engine/assets";
import type { GameState } from "../engine/types";

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

  // Chevrons clignotants de part et d'autre de l'aigle → invite au drag
  const hint = (0.25 + 0.55 * pulse) * (1 - s.launcherGrab);
  if (hint > 0.04) {
    ctx.strokeStyle = `rgba(255,235,170,${hint.toFixed(3)})`;
    ctx.lineWidth = 2;
    for (const dir of [-1, 1] as const) {
      const cx = s.launcherX + dir * (26 + 3 * pulse);
      ctx.beginPath();
      ctx.moveTo(cx - dir * 4, y - 5);
      ctx.lineTo(cx + dir * 4, y);
      ctx.lineTo(cx - dir * 4, y + 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawLauncher(ctx: CanvasRenderingContext2D, s: GameState, aimAngle: number): void {
  drawLauncherRail(ctx, s);

  const vx = s.launcherVx;
  const grab = s.launcherGrab;
  const speed = Math.min(1, Math.abs(vx) / 7);

  ctx.save();
  ctx.translate(s.launcherX, LAUNCHER_Y);

  // Lueur dorée à la saisie (halo radial, derrière tout)
  if (grab > 0.01) {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 42);
    g.addColorStop(0, `rgba(255,222,120,${(0.45 * grab).toFixed(3)})`);
    g.addColorStop(1, "rgba(255,222,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-42, -42, 84, 84);
  }

  // Traits de vitesse traînant à l'opposé du mouvement (espace monde, non tourné)
  if (speed > 0.12) {
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
    drawEagleWings(ctx, flap);               // ailes derrière le corps
    drawEagleLegs(ctx, ponte, legSwing);     // pattes (écart ponte + balancier)
    drawBirdSkin(ctx, EAGLE_BODY, 0, 0, 1);  // corps par-dessus
  } else {
    // Autres oiseaux : grille unique, taille cible ~48px.
    const skin = getActiveBird();
    const cols = skin.grid[0]?.length ?? 9;
    const cellPx = Math.max(1, Math.round(48 / cols));
    drawBirdSkin(ctx, skin, 0, 0, cellPx);
  }

  ctx.restore();
}

// Brindilles pixel art pré-définies (offset x relatif au centre, offset y, angle 0/1/2)
// On dessine des segments de 1px de large en diagonale pour simuler des brindilles
const TWIG_SEGS = [
  // bord gauche — brindilles qui dépassent
  { sx: -38, sy: 4,  ex: -24, ey: -2 },
  { sx: -36, sy: 8,  ex: -20, ey:  2 },
  { sx: -34, sy: 2,  ex: -22, ey:  8 },
  { sx: -30, sy: -2, ex: -14, ey:  4 },
  // bord droit — brindilles qui dépassent
  { sx:  38, sy: 4,  ex:  24, ey: -2 },
  { sx:  36, sy: 8,  ex:  20, ey:  2 },
  { sx:  34, sy: 2,  ex:  22, ey:  8 },
  { sx:  30, sy: -2, ex:  14, ey:  4 },
  // bord bas — brindilles horizontales
  { sx: -28, sy: 10, ex: -12, ey: 10 },
  { sx: -10, sy: 12, ex:  10, ey: 12 },
  { sx:  12, sy: 10, ex:  28, ey: 10 },
  { sx: -22, sy: 8,  ex: -4,  ey: 11 },
  { sx:   4, sy: 11, ex:  22, ey:  8 },
] as const;

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
  const { egg: eggColor, eggHi: eggHiColor } = style;
  // cy = centre vertical du nid
  // Le nid est une cuvette en U — plus large que haut
  const nestW = w + 10;     // légèrement plus large que le bucket
  const nestH = Math.round(h * 0.75);
  const nestBot = Math.round(cy + h * 0.5);   // bas du nid
  const nestTop = nestBot - nestH;             // haut des bords
  const nestMid = nestBot - Math.round(nestH * 0.3); // fond du creux

  // ── Ombre portée ────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  for (let i = 0; i < 4; i++) {
    const inset = i;
    ctx.fillRect(Math.round(cx - nestW / 2) + inset + 3, nestBot + i, nestW - inset * 2 - 3, 1);
  }

  // ── Corps du nid — couches de brindilles entrelacées ────────────────────────
  // On dessine le nid couche par couche du foncé vers le clair

  // Couche de base (la plus foncée — fond du creux)
  ctx.fillStyle = style.nestDark;
  // Cuvette U : on dessine la forme avec des lignes horizontales de plus en plus larges
  for (let row = 0; row < nestH; row++) {
    const t = row / nestH;
    // La cuvette s'élargit de 30% au fond à 100% en haut
    const rowW = Math.round(nestW * (0.3 + 0.7 * t));
    const rowX = Math.round(cx - rowW / 2);
    const rowY = nestTop + row;
    ctx.fillRect(rowX, rowY, rowW, 1);
  }

  // Brindilles intermédiaires
  ctx.fillStyle = style.nestMid;
  for (let row = 2; row < nestH - 1; row += 2) {
    const t = row / nestH;
    const rowW = Math.round((nestW - 8) * (0.28 + 0.68 * t));
    const rowX = Math.round(cx - rowW / 2);
    const rowY = nestTop + row;
    ctx.fillRect(rowX, rowY, rowW, 1);
  }

  // Brindilles claires entrelacées (lignes verticales légères)
  ctx.fillStyle = style.nestLight;
  for (let col = -Math.floor(nestW / 2) + 4; col < Math.floor(nestW / 2) - 3; col += 5) {
    const absX = Math.round(cx + col);
    // hauteur visible de cette colonne dans la cuvette
    const edgeDist = Math.abs(col) / (nestW / 2);
    const colTop = nestTop + Math.round(nestH * edgeDist * 0.6);
    ctx.fillRect(absX, colTop, 1, nestBot - colTop);
  }

  // Brindilles qui dépassent sur les côtés et en bas — les plus claires
  for (const seg of TWIG_SEGS) {
    drawTwig(ctx, cx, nestBot - Math.round(nestH * 0.3), seg.sx, seg.sy, seg.ex, seg.ey, style.nestRim);
  }
  // Quelques brindilles accent
  for (const seg of TWIG_SEGS) {
    drawTwig(ctx, cx, nestBot - Math.round(nestH * 0.3) - 1, seg.sx - 1, seg.sy - 1, seg.ex - 1, seg.ey - 1, style.nestMid);
  }

  // Reflet — bord supérieur légèrement plus clair
  ctx.fillStyle = style.nestRim;
  ctx.fillRect(Math.round(cx - nestW / 2) + 2, nestTop, Math.round(nestW * 0.35), 1);
  ctx.fillRect(Math.round(cx + nestW * 0.15), nestTop, Math.round(nestW * 0.35), 1);

  // ── Fond intérieur du creux — zone où repose l'œuf ──────────────────────────
  const innerW = Math.round(nestW * 0.55);
  const innerH = Math.round(nestH * 0.4);
  ctx.fillStyle = style.nestDark;
  ctx.fillRect(Math.round(cx - innerW / 2), nestMid - innerH + 2, innerW, innerH);
  // Duvet — quelques pixels plus clairs
  ctx.fillStyle = style.nestMid;
  ctx.fillRect(Math.round(cx - innerW / 2) + 2, nestMid - innerH + 4, innerW - 4, innerH - 4);

  // ── Œuf ─────────────────────────────────────────────────────────────────────
  const eggCx = Math.round(cx);
  const eggCy = nestMid - Math.round(innerH * 0.5);
  const eggRx = Math.round(innerW * 0.38);
  const eggRy = Math.round(innerH * 0.62);

  if (flash) {
    const glow = 0.65 + 0.35 * Math.sin(animClock * 9);
    ctx.shadowColor = eggHiColor;
    ctx.shadowBlur = 12 * glow;
  }

  // Corps de l'œuf — ellipse pixel art (3 rectangles croisés)
  ctx.fillStyle = eggColor;
  ctx.fillRect(eggCx - eggRx + 2, eggCy - eggRy,     eggRx * 2 - 4, eggRy * 2);
  ctx.fillRect(eggCx - eggRx,     eggCy - eggRy + 2,  eggRx * 2,     eggRy * 2 - 4);
  ctx.fillRect(eggCx - eggRx + 1, eggCy - eggRy + 1,  eggRx * 2 - 2, eggRy * 2 - 2);

  ctx.shadowBlur = 0;

  // Reflet haut-gauche
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(eggCx - eggRx + 3, eggCy - eggRy + 2, 4, 1);
  ctx.fillRect(eggCx - eggRx + 2, eggCy - eggRy + 3, 2, 2);

  // Taches (speckles) de l'œuf
  const speckle = flash ? "rgba(255,255,255,0.45)" : "rgba(70,40,15,0.38)";
  ctx.fillStyle = speckle;
  ctx.fillRect(eggCx - 2,          eggCy - eggRy + 3, 2, 1);
  ctx.fillRect(eggCx + eggRx - 4,  eggCy - 1,         2, 1);
  ctx.fillRect(eggCx - eggRx + 3,  eggCy + 2,         1, 2);
  ctx.fillRect(eggCx + 1,          eggCy + eggRy - 3, 2, 1);
  ctx.fillRect(eggCx - 1,          eggCy + 1,         1, 1);
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
