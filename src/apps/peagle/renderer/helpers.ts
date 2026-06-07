import { FACE, HI, SHD, DARK } from "./theme";
const NAVY = "#ff6b35"; // warm orange for nest pixel art

// Halo/glow rectangulaire aux coins ébréchés 1px — même langage pixel-art que les pegs,
// œufs, boutons et astres. À utiliser à la place d'un fillRect pour tout glow, afin que
// les angles vifs du halo ne réintroduisent pas une silhouette carrée autour d'un élément
// pourtant arrondi. (x,y) = coin haut-gauche ; h par défaut = w (carré).
export function roundGlowRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number = w,
): void {
  // Trop petit pour ébrécher (≤2px) : rect plein, sinon on dessinerait une bande de 0px.
  if (w <= 2 || h <= 2) { ctx.fillRect(x, y, w, h); return; }
  ctx.fillRect(x + 1, y, w - 2, h);   // colonne centrale (pleine hauteur)
  ctx.fillRect(x, y + 1, w, h - 2);   // ligne centrale (pleine largeur)
}

// Reflet pixel en « L » au coin haut-gauche — la signature visuelle partagée par les
// pegs, le HUD, les œufs, la balle, le bumper et les astres (renderer/pegs.ts :
// fillRect(x+1,y+1,2,1) + fillRect(x+1,y+1,1,2)). (x,y) = coin haut-gauche de l'élément ;
// on dessine à +1,+1 pour rester à l'intérieur du bevel. `alpha` défaut 0.7 (pegs/astres) ;
// 0.9 pour les surfaces très brillantes (œuf/balle), 0.75 pour le bumper.
export function cornerHighlightL(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, alpha: number = 0.7,
): void {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(x + 1, y + 1, 2, 1);   // barre horizontale
  ctx.fillRect(x + 1, y + 1, 1, 2);   // barre verticale
}

// Glow pixel en 3 couches concentriques (faux blur : 3 roundGlowRect empilés au lieu
// d'une passe gaussienne GPU). Rayons à ×0.3 / ×0.6 / ×1 du blur, alphas dégressifs.
// Remplace les copies de pegs.ts (peg + bumper) et ui.ts (œuf du nid). (x,y,w,h) = boîte
// de l'élément à enrober ; alphas par défaut = recette peg, surchargeable (bumper +vif).
export function pixelGlow3(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, blur: number,
  alphas: readonly [number, number, number] = [0.28, 0.13, 0.06],
): void {
  const g1 = Math.ceil(blur * 0.3) | 0;
  const g2 = Math.ceil(blur * 0.6) | 0;
  const g3 = Math.ceil(blur) | 0;
  ctx.fillStyle = color;
  ctx.globalAlpha = alphas[0]; roundGlowRect(ctx, x - g1, y - g1, w + g1 * 2, h + g1 * 2);
  ctx.globalAlpha = alphas[1]; roundGlowRect(ctx, x - g2, y - g2, w + g2 * 2, h + g2 * 2);
  ctx.globalAlpha = alphas[2]; roundGlowRect(ctx, x - g3, y - g3, w + g3 * 2, h + g3 * 2);
  ctx.globalAlpha = 1;
}

export function raisedBevel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 1.2, Math.PI, 0, false);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 2.6, Math.PI * 1.05, Math.PI * (-0.05), false);
  ctx.stroke();

  ctx.strokeStyle = "rgba(0,0,0,0.48)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 1.2, 0, Math.PI, false);
  ctx.stroke();

  ctx.restore();
}

export function win98Button(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  face: string,
  sunken = false,
): void {
  ctx.fillStyle = face;
  ctx.fillRect(x, y, w, h);

  if (sunken) {
    ctx.fillStyle = DARK;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = SHD;
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, h - 2);
    ctx.fillStyle = HI;
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
  } else {
    ctx.fillStyle = HI;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = SHD;
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
    ctx.fillStyle = DARK;
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
  }
}

export function drawDesktopIcon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  type: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;

  if (type === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 5, y - 6, 10, 13);
    ctx.fillStyle = FACE;
    ctx.fillRect(x + 2, y - 6, 3, 3);
    ctx.fillStyle = NAVY;
    ctx.fillRect(x - 5, y - 6, 10, 3);
    ctx.fillStyle = "#888888";
    ctx.fillRect(x - 3, y - 1, 6, 1);
    ctx.fillRect(x - 3, y + 1, 6, 1);
    ctx.fillRect(x - 3, y + 3, 4, 1);
    ctx.strokeStyle = "#808080";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - 5, y - 6, 10, 13);
  } else if (type === 1) {
    ctx.fillStyle = "#e8c040";
    ctx.fillRect(x - 6, y - 6, 5, 3);
    ctx.fillStyle = "#f0d060";
    ctx.fillRect(x - 6, y - 4, 13, 10);
    ctx.fillStyle = "#ffe880";
    ctx.fillRect(x - 5, y - 3, 11, 2);
    ctx.fillStyle = "#c09820";
    ctx.fillRect(x - 6, y + 5, 13, 1);
    ctx.fillRect(x + 6, y - 4, 1, 10);
  } else {
    ctx.fillStyle = FACE;
    ctx.fillRect(x - 7, y - 7, 14, 10);
    ctx.fillStyle = NAVY;
    ctx.fillRect(x - 5, y - 5, 10, 6);
    ctx.fillStyle = "#00aaff";
    ctx.fillRect(x - 4, y - 4, 3, 2);
    ctx.fillStyle = "#00ff44";
    ctx.fillRect(x + 1, y - 4, 2, 1);
    ctx.fillStyle = FACE;
    ctx.fillRect(x - 2, y + 2, 4, 3);
    ctx.fillRect(x - 5, y + 5, 10, 2);
    ctx.fillStyle = HI;
    ctx.fillRect(x - 7, y - 7, 14, 1);
    ctx.fillRect(x - 7, y - 7, 1, 11);
    ctx.fillStyle = SHD;
    ctx.fillRect(x - 7, y + 3, 14, 1);
    ctx.fillRect(x + 6, y - 7, 1, 11);
  }

  ctx.restore();
}
