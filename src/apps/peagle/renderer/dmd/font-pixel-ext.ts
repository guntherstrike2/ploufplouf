// ─── Extensions manuelles de la police pixel 7×8 ─────────────────────────────────
//
// `font-pixel.ts` est GÉNÉRÉ depuis le .ttf Press Start 2P, qui ne contient ni
// ponctuation typographique (`·`, `…`, `⋮`) ni lettres accentuées (la fonte est
// purement ASCII). Or le classement game-over affiche des pseudos serveur qui en
// contiennent (pseudos FR), et les marqueurs « · you » / saut de rang « ⋮ ».
//
// Plutôt que d'éditer le fichier généré (interdit, et de toute façon le .ttf n'a pas
// ces glyphes), on les ajoute ICI à la même grille 7×8 :
//  • symboles dessinés à la main (·, …, ⋮),
//  • lettres accentuées COMPOSÉES = glyphe de base (depuis `G`) + accent posé au-dessus,
//    pour un rendu cohérent sans redessiner chaque lettre.
//
// `pxGlyphExt(ch)` : consulte d'abord ces extras, puis retombe sur `pxGlyph` (donc sur
// l'espace pour tout glyphe inconnu — un pseudo CJK retombe dessus, limite acceptée).
// `pxTextColsExt` reprend la métrique monospace stricte de `pxTextCols`.

import { pxGlyph, PX_GLYPH_W, PX_GLYPH_GAP } from "./font-pixel";

type Glyph = readonly string[];

// ── Symboles ajoutés (7×8, "#"=allumé) ───────────────────────────────────────────
const SYM: Record<string, Glyph> = {
  // Point médian U+00B7 — un seul dot centré à mi-hauteur (séparateur « · you »).
  "·": ["       ", "       ", "       ", "  ##   ", "  ##   ", "       ", "       ", "       "],
  // Points de suspension U+2026 — trois dots bas alignés (troncature ellipsis).
  "…": ["       ", "       ", "       ", "       ", "       ", "       ", "# # # #", "       "],
  // Ellipse verticale U+22EE — trois dots empilés (marqueur de saut de rang).
  "⋮": ["       ", "  ##   ", "       ", "  ##   ", "       ", "  ##   ", "       ", "       "],
};

// ── Accents posés au-dessus d'une base (rangées 0..1 du glyphe 7×8) ───────────────
// Chaque accent occupe les 2 premières rangées ; la base fournit le corps de la lettre.
const ACCENTS: Record<string, [string, string]> = {
  acute: ["    ## ", "   ##  "],          // ´  (é, á, í, ó, ú)
  grave: ["  ##   ", "   ##  "],          // `  (è, à, ì, ò, ù)
  circ:  ["   #   ", "  # #  "],          // ^  (ê, â, î, ô, û)
  trema: [" ## ## ", "       "],          // ¨  (ë, ï, ü, ö, ä)
};

// Compose un accent sur une lettre de base : on garde le corps de la base à partir de
// la rangée 2 et on superpose l'accent sur les rangées 0..1 (la base minuscule a déjà
// ses rangées hautes vides, donc rien n'est écrasé).
function compose(base: string, accent: keyof typeof ACCENTS): Glyph {
  const g = pxGlyph(base);
  const [a0, a1] = ACCENTS[accent]!;
  return [a0, a1, g[2]!, g[3]!, g[4]!, g[5]!, g[6]!, g[7]!];
}

// ── Cédille (descendante sous le c) ──────────────────────────────────────────────
function cedilla(base: string): Glyph {
  const g = pxGlyph(base);
  // Remplace la dernière rangée (vide pour 'c'/'C') par la queue de cédille.
  return [g[0]!, g[1]!, g[2]!, g[3]!, g[4]!, g[5]!, "   #   ", "  ##   "];
}

// Table finale des extras. Les lettres accentuées FR les plus courantes, minuscules
// ET majuscules (un pseudo peut commencer par une capitale accentuée).
const EXT: Record<string, Glyph> = {
  ...SYM,
  "é": compose("e", "acute"),  "è": compose("e", "grave"),  "ê": compose("e", "circ"),  "ë": compose("e", "trema"),
  "à": compose("a", "grave"),  "â": compose("a", "circ"),   "ä": compose("a", "trema"),
  "î": compose("i", "circ"),   "ï": compose("i", "trema"),
  "ô": compose("o", "circ"),   "ö": compose("o", "trema"),
  "ù": compose("u", "grave"),  "û": compose("u", "circ"),   "ü": compose("u", "trema"),
  "ç": cedilla("c"),
  "É": compose("E", "acute"),  "È": compose("E", "grave"),  "Ê": compose("E", "circ"),
  "À": compose("A", "grave"),  "Â": compose("A", "circ"),
  "Ç": cedilla("C"),
};

// Glyphe étendu : extras d'abord, sinon la table générée (qui retombe sur l'espace).
export function pxGlyphExt(ch: string): Glyph {
  return EXT[ch] ?? pxGlyph(ch);
}

// Largeur d'une chaîne en colonnes de dots (monospace strict, identique à pxTextCols).
export function pxTextColsExt(text: string): number {
  const n = [...text].length;
  if (!n) return 0;
  return n * (PX_GLYPH_W + PX_GLYPH_GAP) - PX_GLYPH_GAP;
}
