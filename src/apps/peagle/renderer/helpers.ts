import { FACE, HI, SHD, DARK } from "./theme";
const NAVY = "#ff6b35"; // warm orange for nest pixel art

// Hex opaque (#rrggbb ou #rgb) → rgba(r,g,b,a). Indispensable pour le HUD : les tokens
// ROLE.* de la palette sont des hex opaques, or le HUD est translucide sur le ciel.
export function alpha(hex: string, a: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

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

// Contour carré aux coins arrondis pixel-art — version « stroke » de roundGlowRect.
// Les 4 arêtes (épaisseur `lw`, vers l'intérieur) sont rognées de `corner` px à chaque
// extrémité, et un petit escalier pixel relie les arêtes au coin → un vrai « border-
// radius » en pixel-art, sans angle vif. `corner` par défaut auto = proportionnel à la
// taille (≈ s/16, borné 1..5) pour que les grands anneaux paraissent autant arrondis
// que les petits. (x,y) = coin haut-gauche.
export function roundStrokeRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, s: number, lw: number = 1, corner?: number,
): void {
  const w = Math.min(Math.max(1, Math.round(lw)), Math.floor(s / 2));
  const c = Math.min(
    corner ?? Math.max(1, Math.min(5, Math.round(s / 16))),
    Math.floor((s - w) / 2),
  );
  // Arêtes droites, rognées de `c` à chaque bout (laisse la place aux coins).
  ctx.fillRect(x + c, y, s - 2 * c, w);             // haut
  ctx.fillRect(x + c, y + s - w, s - 2 * c, w);     // bas
  ctx.fillRect(x, y + c, w, s - 2 * c);             // gauche
  ctx.fillRect(x + s - w, y + c, w, s - 2 * c);     // droite

  // Coins en escalier pixel : pour chaque pas k, un segment de l'arête horizontale
  // et de l'arête verticale se rejoignent en biais → arrondi visible à grande échelle.
  for (let k = 0; k < c; k++) {
    const off = c - 1 - k;                // décalage diagonal du pas
    const seg = Math.max(1, w);           // épaisseur du trait au coin
    // haut-gauche
    ctx.fillRect(x + k, y + off, 1, seg);
    ctx.fillRect(x + off, y + k, seg, 1);
    // haut-droite
    ctx.fillRect(x + s - 1 - k, y + off, 1, seg);
    ctx.fillRect(x + s - off - seg, y + k, seg, 1);
    // bas-gauche
    ctx.fillRect(x + k, y + s - off - seg, 1, seg);
    ctx.fillRect(x + off, y + s - 1 - k, seg, 1);
    // bas-droite
    ctx.fillRect(x + s - 1 - k, y + s - off - seg, 1, seg);
    ctx.fillRect(x + s - off - seg, y + s - 1 - k, seg, 1);
  }
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

// ── Plaquette chunky — la brique de base de la DA « chunky rounded-rect » ──────
// Bloc plein, coins arrondis ~2px, bevel clair en haut/gauche + sombre en bas/droite,
// contour sombre arrondi (roundStrokeRect) et reflet « L » signature (cornerHighlightL).
// C'est `drawTalonLeg.chunk` (renderer/ui.ts) généralisé et promu en helper partagé :
// toute surface d'UI (HUD, boutons, pavés) doit passer par ici pour rester à la charte
// au lieu d'un fillRect à angles vifs. (x,y) = coin haut-gauche.
//
// `sunken` inverse le bevel (clair en bas/droite) → état enfoncé pour un bouton pressé.
// `corner` = rayon des coins (défaut 2px, la valeur canon de la DA).
export function chunkPlate(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: {
    fill: string; light: string; dark: string; outline?: string;
    sunken?: boolean; highlightL?: boolean | number;
  },
): void {
  const { fill, light, dark, outline, sunken = false, highlightL = true } = opts;
  const r = 2; // coins arrondis 2px — valeur signature

  // 1) Corps plein, coins ébréchés (mêmes 4 coins que roundGlowRect, étendu au rect plein).
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y, w - 2, h);   // colonne centrale
  ctx.fillRect(x, y + 1, w, h - 2);   // ligne centrale

  // 2) Bevel : liseré clair (haut + gauche) / ombre (bas + droite) — inversé si sunken.
  const top = sunken ? dark : light, bot = sunken ? light : dark;
  ctx.fillStyle = top;
  ctx.fillRect(x + r, y, w - 2 * r, 1);          // arête haute
  ctx.fillRect(x, y + r, 1, h - 2 * r);          // arête gauche
  ctx.fillStyle = bot;
  ctx.fillRect(x + r, y + h - 1, w - 2 * r, 1);  // arête basse
  ctx.fillRect(x + w - 1, y + r, 1, h - 2 * r);  // arête droite

  // 3) Contour sombre arrondi par-dessus (donne le coin net sans angle vif).
  if (outline) {
    ctx.fillStyle = outline;
    // coins en escalier 1px : un pixel diagonal à chaque angle.
    ctx.fillRect(x + 1, y + 1, 1, 1);
    ctx.fillRect(x + w - 2, y + 1, 1, 1);
    ctx.fillRect(x + 1, y + h - 2, 1, 1);
    ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
  }

  // 4) Reflet « L » signature au coin haut-gauche.
  if (highlightL) {
    cornerHighlightL(ctx, x, y, typeof highlightL === "number" ? highlightL : 0.7);
  }
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
  const g1 = Math.ceil(blur * 0.3);
  const g2 = Math.ceil(blur * 0.6);
  const g3 = Math.ceil(blur);
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
