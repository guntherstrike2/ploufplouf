"use client";

// ─── Sprites pixel art « maison » — remplacent les emojis ─────────────────────
// Chaque sprite est une grille de caractères ; chaque caractère = 1 pixel coloré
// (espace / « . » = transparent). Rendu en SVG <rect> 1×1 → arêtes nettes, zéro
// flou, à n'importe quelle échelle. Palette forêt cohérente avec le reste.

const PAL: Record<string, string> = {
  K: "#050d03", // contour (ink)
  C: "#f2e6c2", // crème (corps clair)
  G: "#ffd24a", // or
  O: "#ff8a3c", // orange (bec / danger)
  W: "#ffffff", // blanc (reflets)
  R: "#ff5544", // rouge
  g: "#8fe04a", // vert feuille
  s: "#c8d8e0", // argent
  b: "#cc8844", // bronze
};

export type SpriteName = "eagle" | "trophy" | "skull" | "star" | "note" | "grave";

const SPRITES: Record<SpriteName, string[]> = {
  // Aigle de face, ailes déployées — ailes or, corps crème, bec orange.
  eagle: [
    "K...........K",
    "KK....C....KK",
    "GKK..CCC..KKG",
    "GGKKKCKCKKKGG",
    ".GGGCCOCCGGG.",
    "..GGCCCCCGG..",
    "...GGCCCGG...",
    "....KCCCK....",
    ".....KKK.....",
  ],
  // Trophée or, anses orange.
  trophy: [
    "KKKKKKKKKKK",
    "KGGGGGGGGGK",
    "KGGGGGGGGGK",
    "OKGGGGGGGKO",
    "OKGGGGGGGKO",
    ".KGGGGGGGK.",
    "..KGGGGGK..",
    "...KGGGK...",
    "....KGK....",
    "...KGGGK...",
    "..KKKKKKK..",
  ],
  // Crâne crème.
  skull: [
    "..KKKKKKK..",
    ".KCCCCCCCK.",
    "KCCCCCCCCCK",
    "KCKKCCCKKCK",
    "KCKKCCCKKCK",
    "KCCCCKCCCCK",
    "KCCCKKKCCCK",
    ".KCCCCCCCK.",
    ".KCKCKCKCK.",
    "..KKKKKKK..",
  ],
  // Étincelle 4 branches, or.
  star: [
    "....G....",
    "...GGG...",
    "...GGG...",
    "G..GGG..G",
    "GGGGGGGGG",
    "G..GGG..G",
    "...GGG...",
    "...GGG...",
    "....G....",
  ],
  // Note de musique, vert feuille.
  note: [
    "...ggK",
    "...gKg",
    "...g.g",
    "...g.g",
    "...g..",
    "Kg.g..",
    "ggKg..",
    ".gg...",
  ],
  // Pierre tombale crème.
  grave: [
    "..KKKKK..",
    ".KCCCCCK.",
    "KCCCCCCCK",
    "KCCKKKCCK",
    "KCCCCCCCK",
    "KCKKKKKCK",
    "KCCCCCCCK",
    "KCCCCCCCK",
    "KKKKKKKKK",
  ],
};

interface PixelSpriteProps {
  name: SpriteName;
  /** Taille d'un pixel en px (défaut 3). */
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PixelSprite({ name, scale = 3, className, style }: PixelSpriteProps) {
  const rows = SPRITES[name];
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: "block", imageRendering: "pixelated", ...style }}
      aria-hidden
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => {
          const fill = PAL[ch];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />;
        }),
      )}
    </svg>
  );
}
