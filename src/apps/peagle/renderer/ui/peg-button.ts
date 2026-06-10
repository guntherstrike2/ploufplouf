// ── PEG-BOUTON CANVAS — source unique du bouton « peg » dessiné sur canvas ───────
//
// Pendant canvas du composant React `<PegBtn>` / `.pg-pm-btn`. Même DA exactement :
// bloc plein vert/orange/or, bevel pixel net (clair haut-gauche / sombre bas-droite),
// contour `ink`, reflet « L » signature, ombre dure portée, texte bitmap gravé.
//
// Ce module CENTRALISE le bouton canvas : `pegPlate` (la plaque) et `pegText` (le
// label gravé) vivaient dans `hud.ts` ; ils sont remontés ici pour que les inserts
// du HUD ET les boutons d'écran (menu, pause, game over) partagent UNE seule recette.
// `hud.ts` réimporte ces primitives → zéro duplication de style.
//
// Le bouton canvas n'a pas de DOM : pas de :hover/:active CSS. L'appelant passe donc
// l'état (`hover`/`pressed`), calculé par hit-test souris dans la boucle de rendu, et
// on rejoue les mêmes transformations que le CSS (bevel inversé au press, éclaircissement
// au hover, ombre résorbée au press).

import { ROLE } from "../../engine/palette";
import { alpha, roundGlowRect } from "../helpers";
import { pxGlyph, pxTextCols, PX_GLYPH_ROWS, PX_GLYPH_W, PX_GLYPH_GAP } from "../dmd/font-pixel";

// ── Fonte bitmap (Press Start 2P 5×5) partagée HUD + boutons ─────────────────────
export type BitmapFont = {
  rows: number; w: number; gap: number;
  glyph: (ch: string) => readonly string[];
  cols: (text: string) => number;
};
export const FONT_BIG: BitmapFont = {
  rows: PX_GLYPH_ROWS, w: PX_GLYPH_W, gap: PX_GLYPH_GAP, glyph: pxGlyph, cols: pxTextCols,
};
export const FONT_SMALL: BitmapFont = FONT_BIG;

// Encre sombre posée sur le peg vif (= `color: #0a1a06` du `.pg-pm-btn`).
export const PEG_INK = ROLE.ink;

// Largeur EN PIXELS d'un texte bitmap au scale `sc`.
export function pegTextWidth(text: string, sc: number, font: BitmapFont = FONT_BIG): number {
  return font.cols(text) * sc;
}

// ── pegPlate — la plaque pixel (réplique fidèle du `.pg-pm-btn`) ─────────────────
// Coins ronds (rayon ≈4px) en escalier, bevel 2px clair haut/gauche + 2px sombre
// bas/droite (les `inset 2px` du peg CSS), contour `ink` net, reflet « L » de 4px à
// +4,+4 (le `::after` clip-path en L). (x,y,w,h) = boîte ; l'ombre dure est posée à part.
export function pegPlate(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  fill: string, hi: string, deep: string,
): void {
  const r = Math.min(4, Math.floor(Math.min(w, h) / 4));   // coins ronds (≈ --pm-radius)

  // 1) Corps plein, coins ébréchés sur `r` px.
  ctx.fillStyle = fill;
  ctx.fillRect(x + r, y, w - 2 * r, h);
  ctx.fillRect(x, y + r, w, h - 2 * r);
  for (let k = 0; k < r; k++) {
    const inset = r - 1 - k;
    ctx.fillRect(x + inset, y + k, w - 2 * inset, 1);
    ctx.fillRect(x + inset, y + h - 1 - k, w - 2 * inset, 1);
  }

  // 2) Bevel 2px : arête claire haut+gauche / sombre bas+droite.
  ctx.fillStyle = hi;
  ctx.fillRect(x + r, y + 1, w - 2 * r, 2);
  ctx.fillRect(x + 1, y + r, 2, h - 2 * r);
  ctx.fillStyle = deep;
  ctx.fillRect(x + r, y + h - 3, w - 2 * r, 2);
  ctx.fillRect(x + w - 3, y + r, 2, h - 2 * r);

  // 3) Contour `ink` net arrondi.
  ctx.fillStyle = ROLE.ink;
  ctx.fillRect(x + r, y, w - 2 * r, 1);
  ctx.fillRect(x + r, y + h - 1, w - 2 * r, 1);
  ctx.fillRect(x, y + r, 1, h - 2 * r);
  ctx.fillRect(x + w - 1, y + r, 1, h - 2 * r);
  for (let k = 0; k < r; k++) {
    const off = r - 1 - k;
    ctx.fillRect(x + k, y + off, 1, 1);
    ctx.fillRect(x + w - 1 - k, y + off, 1, 1);
    ctx.fillRect(x + k, y + h - 1 - off, 1, 1);
    ctx.fillRect(x + w - 1 - k, y + h - 1 - off, 1, 1);
  }

  // 4) Reflet « L » signature : 4px à +4,+4, coin bas-droit évidé.
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(x + 4, y + 4, 4, 2);
  ctx.fillRect(x + 4, y + 4, 2, 4);
}

// ── pegText — label bitmap gravé sur le peg (dot par dot, zéro anticrénelage) ─────
// Reflet clair décalé +1 dot (le `text-shadow` du bouton), puis corps encre sombre.
// `sc` = taille d'un dot en px. (x,y) = ancre VERTICALEMENT CENTRÉE ; `align` place en X.
export function pegText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  sc: number, align: CanvasTextAlign = "left", font: BitmapFont = FONT_BIG,
  ink: string = PEG_INK,
): number {
  const wPix = pegTextWidth(text, sc, font);
  const hPix = font.rows * sc;
  let ox = Math.round(x);
  if (align === "center") ox = Math.round(x - wPix / 2);
  else if (align === "right") ox = Math.round(x - wPix);
  const oy = Math.round(y - hPix / 2);

  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass === 0 ? "rgba(255,255,255,0.32)" : ink;
    const dy = pass === 0 ? sc : 0;
    let cx = ox;
    for (const ch of text) {
      const g = font.glyph(ch);
      for (let r = 0; r < font.rows; r++) {
        const row = g[r]!;
        for (let c = 0; c < font.w; c++) {
          if (row[c] === "#") ctx.fillRect(cx + c * sc, oy + r * sc + dy, sc, sc);
        }
      }
      cx += (font.w + font.gap) * sc;
    }
  }
  return wPix;
}

// ── Variantes de couleur (calque des classes CSS .pg-pm-btn / -play / -ghost) ────
export type PegVariant = "primary" | "play" | "gold" | "ghost";

type PegSkin = { fill: string; hi: string; deep: string; ink: string };

const SKINS: Record<PegVariant, PegSkin> = {
  // Vert vif standard (boutons secondaires).
  primary: { fill: ROLE.accent, hi: ROLE.accentHi, deep: ROLE.accentDeep, ink: ROLE.ink },
  // Orange : le gros CTA « JOUER / REPRENDRE / REJOUER ».
  play:    { fill: ROLE.orange, hi: ROLE.orangeGlow, deep: ROLE.orangeDeep, ink: "#1a0a03" },
  // Or : bannière version.
  gold:    { fill: ROLE.gold, hi: "#ffe870", deep: ROLE.goldDark, ink: "#1a1404" },
  // Atténué : surface transparente, juste un contour + label muted (actions discrètes).
  ghost:   { fill: alpha(ROLE.ink, 0.25), hi: alpha(ROLE.bevelHi, 0.4), deep: alpha(ROLE.ink, 0.5), ink: ROLE.cream },
};

// Mélange OPAQUE de deux couleurs (hex ou rgb) — pour éclaircir/assombrir un skin.
function lighten(hex: string, amt: number): string {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;                                  // alpha()/rgb() : on laisse tel quel
  const n = parseInt(m[1]!, 16);
  const ch = (sh: number) => {
    const v = (n >> sh) & 255;
    return Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export interface PegRect { x: number; y: number; w: number; h: number }

export interface DrawPegButtonOpts {
  variant?: PegVariant;
  hover?: boolean;
  pressed?: boolean;
  /** Échelle d'un dot du label (px). Défaut 2. */
  textScale?: number;
  /** Décalage de l'ombre dure portée (px). Défaut 3 (= inserts HUD). */
  shadowOff?: number;
  /** Halo de séparation derrière la plaque — détache le bouton d'un fond sombre
      (menu) où l'ombre noire se fondrait. Off par défaut (le HUD n'en a pas besoin). */
  lift?: boolean;
}

// Ombre dure portée — NOIR PUR opaque. Le décor du menu (bas de l'écran) est déjà
// quasi-noir (green[950]) : une ombre teintée `ink` (#060d02) s'y fondrait. On force
// donc un noir pur, plus sombre que le fond, pour qu'elle ressorte malgré tout.
const SHADOW = "rgba(0,0,0,0.85)";

// ── drawPegButton — dessine un bouton peg complet (ombre + plaque + label) ───────
// Reproduit les états du CSS :
//  • hover   → peg éclairci (brightness 1.1) + léger décollage haut-gauche
//  • pressed → bevel INVERSÉ (sombre en haut-gauche) + enfoncé + ombre résorbée
// Retourne le `PegRect` de hit-test (= la boîte passée, inchangée — le décalage
// hover/press n'affecte QUE le dessin, pas la zone cliquable, pour éviter le flicker).
export function drawPegButton(
  ctx: CanvasRenderingContext2D, rect: PegRect, label: string,
  opts: DrawPegButtonOpts = {},
): PegRect {
  const { variant = "primary", hover = false, pressed = false, textScale = 2, shadowOff = 3, lift = false } = opts;
  const skin = SKINS[variant];

  // Décalage hover/press (le « bond » du peg CSS) — purement visuel.
  const dx = pressed ? 2 : hover ? -2 : 0;
  const dy = pressed ? 2 : hover ? -3 : 0;
  const { x: bx, y: by, w, h } = rect;
  const x = bx + dx, y = by + dy;

  // Halo de séparation : un liseré clair (vert vif) débordant de 1px tout autour de la
  // plaque, dessiné AVANT l'ombre. Sur le décor quasi-noir du menu, c'est lui qui
  // « décolle » réellement le bouton du fond (l'ombre noire seule s'y fondrait).
  if (lift && variant !== "ghost") {
    ctx.fillStyle = alpha(skin.hi, 0.5);
    roundGlowRect(ctx, x - 1, y - 1, w + 2, h + 2);
  }

  // Couleurs effectives : hover éclaircit le corps, press l'assombrit légèrement.
  let fill = skin.fill, hi = skin.hi, deep = skin.deep;
  if (hover) { fill = lighten(fill, 0.12); }
  else if (pressed) { fill = lighten(fill, -0.08); }
  // Press : bevel inversé (clair↔sombre permutés) → le peg paraît enfoncé.
  if (pressed) { const t = hi; hi = deep; deep = t; }

  // Ombre dure portée — fixe (comme les inserts HUD) ; résorbée au press.
  if (variant !== "ghost" && !pressed) {
    ctx.fillStyle = SHADOW;
    roundGlowRect(ctx, x + shadowOff, y + shadowOff, w, h);
  }

  pegPlate(ctx, x, y, w, h, fill, hi, deep);

  // Label gravé, centré. Variant ghost : pas de reflet (label muted simple).
  pegText(ctx, label, x + w / 2, y + h / 2, textScale, "center", FONT_BIG, skin.ink);

  return rect;
}

// ── Hit-test AABB — retourne l'index du premier rect contenant (px,py), ou -1 ─────
export function hitPeg(rects: readonly PegRect[], px: number, py: number): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}
