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
import { pxGlyphExt, pxTextColsExt } from "../dmd/font-pixel-ext";

// ── Fonte bitmap (Press Start 2P 7×8) partagée HUD + boutons ─────────────────────
export type BitmapFont = {
  rows: number; w: number; gap: number;
  glyph: (ch: string) => readonly string[];
  cols: (text: string) => number;
};
export const FONT_BIG: BitmapFont = {
  rows: PX_GLYPH_ROWS, w: PX_GLYPH_W, gap: PX_GLYPH_GAP, glyph: pxGlyph, cols: pxTextCols,
};
export const FONT_SMALL: BitmapFont = FONT_BIG;
// Fonte ÉTENDUE : mêmes métriques, mais couvre · … ⋮ et les accents latins courants
// (font-pixel-ext.ts). À utiliser pour le texte libre — pseudos serveur du classement.
export const FONT_EXT: BitmapFont = {
  rows: PX_GLYPH_ROWS, w: PX_GLYPH_W, gap: PX_GLYPH_GAP, glyph: pxGlyphExt, cols: pxTextColsExt,
};

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

// État d'animation CONTINU d'un bouton — piloté par des ressorts côté appelant
// (MenuButtonsCanvas) pour un feedback juteux. Là où `hover`/`pressed` étaient des
// booléens (snap instantané, ok pour les inserts HUD figés), `anim` interpole tout :
//  • `lift`  0→1 : décollage haut-gauche au survol (spring overshoot possible >1)
//  • `press` 0→1 : enfoncement (bevel s'inverse progressivement à mi-course)
//  • `squashX/Y`  : facteurs d'échelle (squash & stretch — <1 écrase, >1 étire)
// `drawPegButton` traduit ça en pixels. Si `anim` est absent, on retombe sur les
// booléens `hover`/`pressed` (compat HUD).
export interface PegAnim {
  lift: number;
  press: number;
  squashX: number;
  squashY: number;
}

export interface DrawPegButtonOpts {
  variant?: PegVariant;
  hover?: boolean;
  pressed?: boolean;
  /** État d'animation continu (spring). Prioritaire sur `hover`/`pressed` si fourni. */
  anim?: PegAnim;
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

// Convertit les booléens hover/pressed en `PegAnim` figé (états « secs » du HUD).
function boolAnim(hover: boolean, pressed: boolean): PegAnim {
  if (pressed) return { lift: 0, press: 1, squashX: 1, squashY: 1 };
  if (hover) return { lift: 1, press: 0, squashX: 1, squashY: 1 };
  return { lift: 0, press: 0, squashX: 1, squashY: 1 };
}

// ── drawPegButton — dessine un bouton peg complet (ombre + plaque + label) ───────
// Pilotage CONTINU via `anim` (ou booléens hover/pressed → snap, compat HUD) :
//  • lift   → décollage progressif haut-gauche + ombre qui s'écarte + éclaircissement
//  • press  → enfoncement, bevel qui s'inverse à mi-course, ombre qui se résorbe
//  • squash → squash & stretch (le peg s'écrase au clic puis rebondit, ancré au centre-bas)
// Retourne le `PegRect` de hit-test (= la boîte passée, inchangée — le mouvement
// visuel n'affecte PAS la zone cliquable, pour éviter le flicker au survol/clic).
export function drawPegButton(
  ctx: CanvasRenderingContext2D, rect: PegRect, label: string,
  opts: DrawPegButtonOpts = {},
): PegRect {
  const { variant = "primary", hover = false, pressed = false, textScale = 2, shadowOff = 3, lift = false } = opts;
  const skin = SKINS[variant];
  const a = opts.anim ?? boolAnim(hover, pressed);

  const { x: bx, y: by, w, h } = rect;

  // Décalage VERTICAL pur : le lift fait BIEN monter le peg tout droit, le press
  // l'enfonce tout droit — aucune dérive horizontale (symétrique gauche-droite).
  const dx = 0;
  const dy = a.press * 3 - a.lift * 6;

  // Squash & stretch : on déforme la plaque autour de son CENTRE — l'écrasement/étirement
  // reste symétrique (autant de chaque côté), pas ancré au bas. On garde des entiers
  // (silhouette pixel) ; le décalage hover/press s'applique au centre, pas à un coin.
  const sw = Math.max(8, Math.round(w * a.squashX));
  const sh = Math.max(8, Math.round(h * a.squashY));
  const x = bx + dx + Math.round((w - sw) / 2);   // recentré horizontalement
  const y = by + dy + Math.round((h - sh) / 2);   // recentré verticalement (symétrique)

  // Halo de séparation : un liseré clair (vert vif) débordant de 1px tout autour de la
  // plaque, dessiné AVANT l'ombre. Sur le décor quasi-noir du menu, c'est lui qui
  // « décolle » réellement le bouton du fond (l'ombre noire seule s'y fondrait).
  if (lift && variant !== "ghost") {
    ctx.fillStyle = alpha(skin.hi, 0.5);
    roundGlowRect(ctx, x - 1, y - 1, sw + 2, sh + 2);
  }

  // Couleurs effectives : le lift éclaircit FRANCHEMENT le corps (peg « allumé » au
  // survol), le press l'assombrit. Le tint suit le ressort → l'éclat dépasse aussi.
  const tint = a.lift * 0.2 - a.press * 0.1;
  const fill = lighten(skin.fill, tint);
  let hi = skin.hi, deep = skin.deep;
  // Press : bevel inversé (clair↔sombre permutés) à partir de mi-course → enfoncement.
  if (a.press >= 0.5) { const t = hi; hi = deep; deep = t; }

  // Ombre dure portée — droit en DESSOUS (pas de décalage horizontal → symétrique
  // gauche-droite). S'ÉCARTE avec le lift (le peg décolle), se RÉSORBE avec le press.
  if (variant !== "ghost") {
    const off = shadowOff * (1 + a.lift * 1.1) * (1 - a.press);
    if (off > 0.3) {
      ctx.fillStyle = SHADOW;
      roundGlowRect(ctx, x, y + off, sw, sh);
    }
  }

  pegPlate(ctx, x, y, sw, sh, fill, hi, deep);

  // Label gravé, centré sur la plaque déformée. Variant ghost : pas de reflet.
  pegText(ctx, label, x + sw / 2, y + sh / 2, textScale, "center", FONT_BIG, skin.ink);

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
