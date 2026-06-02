import type { CSSProperties } from "react";

// ─── Peagle — Design system « Bosquet » (pixel art net) ──────────────────────
// Langage unique : pixel art forêt, plat et lisible. Pas de flou, pas d'arrondi
// mou, pas de glow diffus — surfaces opaques, biseaux 1px nets, ombrage en
// bandes (hard-stop) façon sprite. Palette forêt : verts, crème, or, orange.
// Motifs : feuille, aigle, bois.
//
// Ces tokens servent au code inline (impossible d'utiliser des classes CSS).
// Pour tout le reste : classes dans peagle.css (mêmes valeurs via --pg-*).

export const PG = {
  // Fonds (opaques)
  bgDeep:    "#060e04",   // quasi-noir forêt (canvas, fond profond)
  bg:        "#0a1606",   // fond sombre verdâtre
  surface:   "#10200b",   // panneau (dialog) — vert sombre plein
  surface2:  "#1c3a12",   // surfaces secondaires (boutons, cards)
  // Cadres pixel
  ink:       "#050d03",   // contour noir-vert net
  bevelHi:   "#5a9a32",   // arête claire (haut/gauche)
  bevelLo:   "#0a1c08",   // arête sombre (bas/droite)
  border:    "#2e5220",   // filet de séparation
  hi:        "#5a9a32",   // compat (ancien biseau lumineux)
  sh:        "#0a1c08",   // compat (ancien biseau sombre)
  // Accents
  orange:    "#ff8a3c",   // cibles / danger
  orangeGlow:"#ffb066",
  orangeDeep:"#cc4f12",
  green:     "#7ed13a",   // accent principal (CTA)
  greenHi:   "#a6e85c",
  greenDeep: "#3f7a14",
  leaf:      "#8fe04a",   // accent secondaire (vert feuille)
  leafDim:   "#4f8a26",
  cream:     "#f2e6c2",   // encre / titres
  gold:      "#ffd24a",   // records / victoire
  warn:      "#ffc24a",
  red:       "#ff5544",   // game over
  purple:    "#cc66ff",   // rareté epic
  purpleHi:  "#e0b4ff",   // texte/icône sur surface violette
  purpleSurface: "#2a1437", // fond violet sombre
  purpleBorder:  "#7a3fb0", // bordure violette
  goldDark:  "#604010",   // accent bas des en-têtes lux (amber sombre)
  // En-tête de panneau (bande forêt, 2 tons)
  headFrom:  "#19331042",
  headTo:    "#0c1c08",
  // Texte
  text:      "#d7f5b8",
  textMuted: "#88a86c",
  // Alias rétro-compat (ex-cyan → vert feuille)
  cyan:      "#8fe04a",
  cyanDim:   "#4f8a26",
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
  background: "linear-gradient(to bottom, #1c3812 0%, #122a0c 55%, #0c1c08 100%)",
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
  // Ombrage 2 bandes (hard-stop) = look sprite, pas de dégradé flou.
  background: `linear-gradient(to bottom, ${PG.greenHi} 0 45%, ${PG.green} 45% 72%, ${PG.greenDeep} 72% 100%)`,
  color: "#0a1a06",
  fontWeight: "bold",
  textShadow: "0 1px 0 rgba(255,255,255,0.25)",
};

export const btnDanger: CSSProperties = {
  ...btnBase,
  background: `linear-gradient(to bottom, ${PG.orangeGlow} 0 45%, ${PG.orange} 45% 72%, ${PG.orangeDeep} 72% 100%)`,
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
