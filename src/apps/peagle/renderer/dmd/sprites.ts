// ─── DMD · Sprites convertis depuis les VRAIS sprites du jeu ──────────────────
// On ne « redessine » plus à la main : on prend les matrices pixel-art officielles
// de components/PixelSprite.tsx (mascotte aigle, etc.) et on les CONVERTIT en dots
// monochromes. Règle : un pixel coloré clair (crème/or/orange/vert…) → dot ALLUMÉ ;
// le contour noir « K » et le transparent « . »/espace → dot ÉTEINT. Le contour
// devient ainsi un trait creux → look gravé fidèle au sprite source, et lisible sur
// un afficheur mono. Aucune zone n'est inventée : la forme vient du jeu.

export type DmdBrow = "flat" | "angry" | "up" | "happy" | "smug" | "drowsy";

export interface DmdFace {
  brow: DmdBrow;
  open: number;     // 0..1 ouverture du bec
  blink: boolean;   // yeux clos
  star: boolean;    // yeux étoile (victoire)
  wide: boolean;    // yeux écarquillés
  look?: number;    // -1..1 décalage horizontal de la pupille (suit l'œuf)
}

// Seul le TRANSPARENT (« . » / espace) → dot éteint ; tout pixel coloré → ALLUMÉ.
// On garde ainsi la SILHOUETTE PLEINE et fidèle du sprite ; les yeux et le bec
// ressortent naturellement, car le sprite les entoure de transparent (« .GGGG. »,
// « ..OO.. »). Les détails internes (pupille, fente) sont ensuite creusés à la main.
const SPRITE_OFF = new Set([".", " "]);

// Convertit une matrice de sprite du jeu en matrice de dots DMD ("#"/" ").
function fromSprite(rows: readonly string[]): string[] {
  return rows.map((row) => [...row].map((ch) => (SPRITE_OFF.has(ch) ? " " : "#")).join(""));
}

// ── Mascotte aigle — COPIE EXACTE du sprite `eagle` de PixelSprite.tsx (13×11) ──
// Tête de face « façon Doom » : K contour, C crème, B sourcil, G iris, O bec, N nuque.
const EAGLE_SPRITE: readonly string[] = [
  "....KKKKK....",
  "..KCCCCCCCCK.",
  ".KCCCCCCCCCK.",
  ".KCBCCCCCBCK.",
  ".KCCCCCCCCCK.",
  ".KGKGCCCGKGK.",
  ".KGKGCCCGKGK.",
  ".KCC.GGGG.CK.",
  ".KCC..OO..CK.",
  "..NKCCCCCKN..",
  "...NKKKKKN...",
];

export const EAGLE_BIG_W = 13;
export const EAGLE_BIG_H = 11;

// Dans le sprite, lignes 5-6 = « .KGKGCCCGKGK. » : la PUPILLE (K interne) est en
// colonnes 3 et 9 ; les iris (G) l'entourent. Le bec (O) est lignes 7-8, colonnes 5-6.
const PUPIL_COLS = [3, 9] as const;
const EYE_R0 = 5;                    // ligne haute des yeux

function setBig(grid: string[], c: number, r: number): void {
  if (r < 0 || r >= EAGLE_BIG_H || c < 0 || c >= EAGLE_BIG_W) return;
  const line = grid[r]!;
  grid[r] = line.substring(0, c) + "#" + line.substring(c + 1);
}
function unsetBig(grid: string[], c: number, r: number): void {
  if (r < 0 || r >= EAGLE_BIG_H || c < 0 || c >= EAGLE_BIG_W) return;
  const line = grid[r]!;
  grid[r] = line.substring(0, c) + " " + line.substring(c + 1);
}

// Grande tête : silhouette PLEINE convertie du sprite + détails creusés (pupille, bec,
// sourcil), modulés par l'expression (clin, regard, humeur, cri). La forme vient du jeu.
export function eagleBigDots(f: DmdFace): readonly string[] {
  const g = fromSprite(EAGLE_SPRITE);
  const look = Math.max(-1, Math.min(1, Math.round(f.look ?? 0)));

  // ── Yeux — on creuse la PUPILLE (négatif) dans la silhouette pleine. ──
  for (const pc of PUPIL_COLS) {
    if (f.blink) {
      // Œil clos : on creuse toute la ligne d'œil → paupière baissée.
      for (let dc = -1; dc <= 1; dc++) unsetBig(g, pc + dc, EYE_R0 + 1);
    } else if (f.star) {
      // Œil étoile : on creuse en croix → éclat de victoire.
      unsetBig(g, pc, EYE_R0); unsetBig(g, pc - 1, EYE_R0 + 1); unsetBig(g, pc + 1, EYE_R0 + 1);
    } else {
      // Pupille (creux) — suit l'œuf via `look` ; `wide` la remonte (œil écarquillé).
      unsetBig(g, pc + look, f.wide ? EYE_R0 : EYE_R0 + 1);
      unsetBig(g, pc + look, EYE_R0);
    }
  }

  // ── Sourcils (ligne 3, B en colonnes 2 et 10) — l'humeur creuse un froncement. ──
  switch (f.brow) {
    case "angry":  unsetBig(g, 4, 4); unsetBig(g, 8, 4); break;   // froncé vers le centre-bas
    case "up":     unsetBig(g, 2, 2); unsetBig(g, 10, 2); break;  // relevé (surpris)
    case "drowsy": unsetBig(g, 3, 4); unsetBig(g, 9, 4); break;   // lourd, bas
    case "smug":   unsetBig(g, 10, 2); break;                      // un sourcil haussé
    default: break;                                                // flat/happy : sprite tel quel
  }

  // ── Bec (O, lignes 7-8, colonnes 5-6) — s'ouvre vers le bas selon `f.open`. ──
  if (f.open > 0.45) {
    setBig(g, 5, 9); setBig(g, 6, 9); setBig(g, 7, 9);   // mandibule inférieure qui descend
    unsetBig(g, 6, 7);                                    // gosier ouvert
  } else if (f.open > 0.12) {
    unsetBig(g, 6, 8);
  }

  return g;
}

// ── Petite tête (scènes) : le même sprite, juste réduit à sa moitié supérieure ──
// Les scènes (combo, clutch…) posent l'aigle À CÔTÉ d'un mot sur une seule bande de
// 7 lignes. On garde donc une version 13×7 = le sprite recadré (lignes 1→7) pour la
// fidélité, sans la nuque/le bas du bec qui ne tiennent pas.
export const EAGLE_W = 9;

// Recadre la grande tête : lignes 2→8 (front → bec) et colonnes 2→10 → 9×7 compact,
// sans la marge transparente ni la nuque. Reste fidèle (même sprite, juste recadré).
export function eagleDots(f: DmdFace): readonly string[] {
  return eagleBigDots(f).slice(2, 9).map((l) => l.slice(2, 11));
}

// ── Œuf qui éclot — 6 keyframes : intact → fissure → craque → ouverture → aiglon → éclat.
// Silhouette CARRÉE à coins arrondis (les 4 angles coupés d'un dot), pas ovale —
// raccord avec le look « peg carré » du reste du DMD.
const EGG_FRAMES: readonly (readonly string[])[] = [
  [" ##### ", "#######", "#######", "#######", "#######", "#######", " ##### "],   // 0 intact
  [" ##### ", "#######", "###  ##", "##### #", "#######", "#######", " ##### "],   // 1 fissure
  [" ##### ", "##### #", "## ####", "#  ## #", "#### ##", "#######", " ##### "],   // 2 craque
  [" ##### ", "##   ##", "#     #", "       ", "#     #", "##   ##", " ##### "],   // 3 ouverture (coquille vide)
  [" ##### ", "## # ##", "# ### #", "#######", "#  #  #", "##   ##", " ##### "],   // 4 aiglon dedans
  ["#  #  #", " # # # ", "## # ##", "  ###  ", "## # ##", " # # # ", "#  #  #"],   // 5 éclat
];
export const EGG_W = 7;
export const EGG_FRAME_COUNT = EGG_FRAMES.length;

export function eggDots(frame: number): readonly string[] {
  const i = Math.max(0, Math.min(EGG_FRAMES.length - 1, frame | 0));
  return EGG_FRAMES[i]!;
}

// ── Mini-tête d'aigle 5×5 (l'aiglon, fin de jackpot).
const MINI_EAGLE: readonly string[] = ["# # #", " ### ", "#####", " # # ", "#   #"];
export const MINI_EAGLE_W = 5;
export function miniEagleDots(): readonly string[] {
  return MINI_EAGLE;
}

// ── Étoile 3×3 (level won).
export const STAR_DOTS: readonly string[] = [" # ", "###", " # "];
export const STAR_W = 3;
