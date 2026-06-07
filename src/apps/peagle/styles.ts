import type { CSSProperties } from "react";
import { ROLE, RAMP, GRADIENT } from "./engine/palette";

// Ré-export pour que les composants inline accèdent aux dégradés harmonisés
// (en-têtes, fonds sous-bois, boutons) et au décor de scène sans connaître le
// chemin de la palette.
export { GRADIENT, DECOR } from "./engine/palette";

// ─── Peagle — Design system « Bosquet » (pixel art net) ──────────────────────
// Langage unique : pixel art forêt, plat et lisible. Pas de flou, pas d'arrondi
// mou, pas de glow diffus — surfaces opaques, biseaux 1px nets, ombrage en
// bandes (hard-stop) façon sprite. Palette forêt : verts, crème, or, orange.
// Motifs : feuille, aigle, bois.
//
// Ces tokens servent au code inline React (impossible d'utiliser des classes CSS).
// IMPORTANT : PG DÉRIVE de engine/palette.ts (source unique) — ne pas y remettre
// de valeurs hex en dur, sinon l'inline redivergerait de l'UI/canvas. Les classes
// CSS (peagle.css) lisent les --pg-* injectés depuis la même palette.

export const PG = {
  // Fonds (opaques)
  bgDeep:    ROLE.bgDeep,   // quasi-noir forêt (canvas, fond profond)
  bg:        ROLE.bg,       // fond sombre verdâtre
  surface:   ROLE.surface,  // panneau (dialog) — vert sombre plein
  surface2:  ROLE.surface2, // surfaces secondaires (boutons, cards)
  // Cadres pixel
  ink:       ROLE.ink,      // contour noir-vert net
  bevelHi:   ROLE.bevelHi,  // arête claire (haut/gauche)
  bevelLo:   ROLE.bevelLo,  // arête sombre (bas/droite)
  border:    ROLE.border,   // filet de séparation
  hi:        ROLE.bevelHi,  // compat (ancien biseau lumineux)
  sh:        ROLE.bevelLo,  // compat (ancien biseau sombre)
  // Accents
  orange:    ROLE.orange,   // cibles / danger
  orangeGlow:ROLE.orangeGlow,
  orangeDeep:ROLE.orangeDeep,
  green:     ROLE.accent,   // accent principal (CTA)
  greenHi:   ROLE.accentHi,
  greenDeep: ROLE.accentDeep,
  leaf:      ROLE.leaf,     // accent secondaire (vert feuille)
  leafDim:   ROLE.leafDim,
  cream:     ROLE.cream,    // encre / titres
  gold:      ROLE.gold,     // records / victoire
  warn:      RAMP.gold[100],
  red:       ROLE.red,      // game over
  purple:    ROLE.purple,   // rareté epic
  purpleHi:  ROLE.purpleHi, // texte/icône sur surface violette
  purpleSurface: ROLE.purpleSurface, // fond violet sombre
  purpleBorder:  ROLE.purpleBorder,  // bordure violette
  goldDark:  ROLE.goldDark, // accent bas des en-têtes lux (amber sombre)
  // En-tête de panneau (bande forêt, 2 tons)
  headFrom:  ROLE.headFrom,
  headTo:    ROLE.headTo,
  // Texte
  text:      ROLE.text,
  textMuted: ROLE.textMuted,
  // Alias rétro-compat (ex-cyan → vert feuille)
  cyan:      ROLE.leaf,
  cyanDim:   ROLE.leafDim,
  // Raretés (cartes d'upgrade)
  rarityCommon:   ROLE.rarityCommon,
  rarityRare:     ROLE.rarityRare,
  rarityRareText: ROLE.rarityRareText,
  rarityEpic:     ROLE.rarityEpic,
  rarityEpicText: ROLE.rarityEpicText,
} as const;

// ─── Biseau pixel net : arête claire haut/gauche, sombre bas/droite ───────────
// Crisp (1px, sans flou) via box-shadow inset. C'est la brique commune.
const bevelRaised =
  `inset 1px 1px 0 0 ${PG.bevelHi}, inset -1px -1px 0 0 ${PG.bevelLo}`;
const bevelInset =
  `inset 1px 1px 0 0 ${PG.bevelLo}, inset -1px -1px 0 0 ${PG.bevelHi}`;

// ─── Coins crantés en escalier (2 marches) + ombre dure pixel ─────────────────
export const clipBtn =
  "polygon(0 6px,3px 6px,3px 3px,6px 3px,6px 0,calc(100% - 6px) 0,calc(100% - 6px) 3px,calc(100% - 3px) 3px,calc(100% - 3px) 6px,100% 6px,100% calc(100% - 6px),calc(100% - 3px) calc(100% - 6px),calc(100% - 3px) calc(100% - 3px),calc(100% - 6px) calc(100% - 3px),calc(100% - 6px) 100%,6px 100%,6px calc(100% - 3px),3px calc(100% - 3px),3px calc(100% - 6px),0 calc(100% - 6px))";
export const clipPanel =
  "polygon(0 8px,4px 8px,4px 4px,8px 4px,8px 0,calc(100% - 8px) 0,calc(100% - 8px) 4px,calc(100% - 4px) 4px,calc(100% - 4px) 8px,100% 8px,100% calc(100% - 8px),calc(100% - 4px) calc(100% - 8px),calc(100% - 4px) calc(100% - 4px),calc(100% - 8px) calc(100% - 4px),calc(100% - 8px) 100%,8px 100%,8px calc(100% - 4px),4px calc(100% - 4px),4px calc(100% - 8px),0 calc(100% - 8px))";
export const dropBtn = "drop-shadow(4px 4px 0 rgba(3,8,2,0.8))";
export const dropPanel = "drop-shadow(6px 7px 0 rgba(0,0,0,0.55))";

// ─── Composant : panneau pixel plat ──────────────────────────────────────────
export const glassPanel: CSSProperties = {
  background: PG.surface,
  border: `2px solid ${PG.ink}`,
  borderRadius: 0,
  clipPath: clipPanel,
  boxShadow: bevelRaised,
  filter: dropPanel,
  imageRendering: "pixelated",
  overflow: "hidden",
};

// En-tête de panneau : barre de titre 2 tons + filet d'accent vert en bas.
export const panelHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 12px",
  background: GRADIENT.header,
  borderBottom: `2px solid ${PG.ink}`,
  boxShadow: `inset 0 1px 0 0 ${PG.bevelHi}, inset 0 -3px 0 0 ${PG.greenDeep}`,
  letterSpacing: "0.1em",
};

// Champ creux pixel (scores, valeurs).
export const chipInset: CSSProperties = {
  borderRadius: 0,
  border: `2px solid ${PG.ink}`,
  background: PG.bgDeep,
  boxShadow: bevelInset,
};

// ─── Boutons pixel plats ──────────────────────────────────────────────────────
export const btnBase: CSSProperties = {
  fontFamily: "var(--font-press-start), monospace",
  fontSize: 8,
  cursor: "pointer",
  padding: "11px 16px",
  borderRadius: 0,
  border: `2px solid ${PG.ink}`,
  background: PG.surface2,
  color: PG.text,
  whiteSpace: "nowrap",
  lineHeight: 1.4,
  letterSpacing: "0.05em",
  clipPath: clipBtn,
  boxShadow: bevelRaised,
  filter: dropBtn,
  imageRendering: "pixelated",
  transition: "filter 0.08s",
};

// Alias rétro-compat.
export const btnRaised: CSSProperties = btnBase;

export const btnPrimary: CSSProperties = {
  ...btnBase,
  // Ombrage 2-3 bandes (hard-stop) = look sprite, pas de dégradé flou.
  background: GRADIENT.btnPrimary,
  color: PG.bgDeep,
  fontWeight: "bold",
  textShadow: "0 1px 0 rgba(255,255,255,0.25)",
};

export const btnDanger: CSSProperties = {
  ...btnBase,
  background: GRADIENT.btnDanger,
  color: "#1a0a03",
  fontWeight: "bold",
  textShadow: "0 1px 0 rgba(255,255,255,0.2)",
};

// Pastille glyphe pixel (ex-caption-btn).
export const captionBtn: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 0,
  background: PG.surface2,
  border: `2px solid ${PG.ink}`,
  boxShadow: bevelRaised,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 8,
  color: PG.leaf,
  userSelect: "none",
  cursor: "default",
  lineHeight: 1,
  flexShrink: 0,
};
