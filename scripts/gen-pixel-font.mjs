// ─── Générateur de police bitmap depuis un TTF ───────────────────────────────
// Rastérise Press Start 2P (.ttf) en une table de glyphes "#"/" " et écrit
// src/apps/peagle/renderer/dmd/font-pixel.ts au format attendu par le HUD.
//
// PS2P est nativement une font pixel : ses contours sont des rectangles alignés sur
// une grille de 8×8 unités/em. On rastérise donc à une résolution = multiple de cette
// grille, puis on sous-échantillonne — résultat NET, sans flou ni anti-aliasing.
//
// Usage : node scripts/gen-pixel-font.mjs [--cols N] [--rows N]
//   --cols/--rows : dimensions de la cellule bitmap de SORTIE (défaut 7×9).
//
// Réversible : édite les constantes ci-dessous et relance. Aucune dépendance runtime
// n'est ajoutée au jeu — ce script ne tourne qu'en build/offline.

import opentype from "opentype.js";
import { readFileSync, writeFileSync } from "node:fs";
// opentype.js ≥2 : loadSync est déprécié → parse(buffer).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Paramètres ──
// PS2P a une grille NATIVE de 125 unités (sondée : bords X/Y tous multiples de 125).
// Grille native : 7 colonnes (X 0..875) × 8 rangées (Y -1000..0, capitales sur 7 +
// 1 rangée descendante).
//
// On SUR-ÉCHANTILLONNE d'un facteur SS (toujours aligné pile sur la grille, car
// 125/SS reste un sous-pas régulier → aucun bruit). À 2×, chaque pixel natif devient
// 2×2, donc les contre-formes (trous des O/B/8/e) font 2 cellules de large. On peut
// alors DILATER d'1 cellule pour épaissir les traits à ~2px SANS boucher les trous.
// Sortie = native·SS (+1 col/rangée si dilatation).
const GRID_STEP = 125;              // pas natif de PS2P en unités font
const NATIVE_W = 7;                 // colonnes natives
const NATIVE_H = 8;                 // rangées natives (capitales + descendantes)
const SS = 1;                       // facteur de sur-échantillonnage (1 = 7×8 natif, sans dilatation ; 2 = 14×16 → 15×17 dilaté)
// Dilatation : utile seulement à SS≥2 (à SS=1 elle reboucherait les contre-formes
// d'1 cellule des O/B/8). À SS=1 on garde la maille native PS2P telle quelle — déjà
// trapue (traits 1 cellule pleins, bien plus de corps que la 5×7 fine précédente).
const DILATE = SS >= 2;
const SAMPLE_W = NATIVE_W * SS;     // = 14
const SAMPLE_H = NATIVE_H * SS;     // = 16
const PAD_RIGHT = DILATE ? 1 : 0;
const PAD_BOT = DILATE ? 1 : 0;
const OUT_W = SAMPLE_W + PAD_RIGHT;  // = 15
const OUT_H = SAMPLE_H + PAD_BOT;    // = 17
const SUB_STEP = GRID_STEP / SS;     // pas d'échantillonnage = 62.5 unités
const TTF = "/tmp/ps2p/PressStart2P-Regular.ttf";
const OUT_FILE = join(ROOT, "src/apps/peagle/renderer/dmd/font-pixel.ts");

// Caractères à générer (l'ordre = l'ordre d'écriture dans le fichier).
const DIGITS = "0123456789".split("");
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LOWER = "abcdefghijklmnopqrstuvwxyz".split("");
const PUNCT = ["!", "?", ".", ",", ":", "-", "+", "/", "×", "'", "(", ")"];
const CHARS = [...DIGITS, " ", ...UPPER, ...LOWER, ...PUNCT];

// ── Rastérisation d'un glyphe ──
// On échantillonne la cellule bitmap (OUT_W × OUT_H). Pour chaque dot, on teste si le
// CENTRE de sa case (en coordonnées font) est à l'intérieur d'un contour du glyphe.
//
// ⚠ Système de coordonnées d'opentype : getPath(0,0,em) place le glyphe avec Y VERS
// LE BAS, baseline à y=0. Sondé sur PS2P : les majuscules vont de y=-1000 (haut) à
// y=-125 (baseline), les descendantes (g/p/q/y) de y=-750 à y=0. Les métriques OS/2
// (cap-height/descender) sont inexploitables ici → on cadre sur les BORNES RÉELLES
// mesurées : haut = -1000, bas (descendantes) = 0. Ainsi A..Z occupent le haut et
// g/p/q/y plongent dans les dernières rangées — vraie maille pixel.

const font = opentype.parse(readFileSync(TTF).buffer);
const unitsPerEm = font.unitsPerEm;                       // 1000 pour PS2P

// Cadre natif (coords getPath, Y vers le bas) : on échantillonne au CENTRE de chaque
// cellule de GRID_STEP unités. Col c → x = (c + 0.5)·STEP ; rangée r (0 en haut) →
// y = -1000 + (r + 0.5)·STEP. Aligné pile sur la grille pixel de PS2P.

// Teste si un point (px,py) en coord font est dans le glyphe (remplissage non-zéro).
function inside(path, px, py) {
  // opentype ne fournit pas de point-in-path ; on l'implémente par parité de
  // croisements (ray casting horizontal) sur les commandes du path aplaties.
  // Les contours PS2P sont des polylignes droites → on aplatit les courbes en segments.
  const pts = flatten(path);
  let wind = 0;
  for (const ring of pts) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if ((a.y > py) !== (b.y > py)) {
        const t = (py - a.y) / (b.y - a.y);
        const xCross = a.x + t * (b.x - a.x);
        if (px < xCross) wind += b.y > a.y ? 1 : -1;
      }
    }
  }
  return wind !== 0;   // non-zero winding
}

// Aplatit un path opentype en anneaux (tableaux de points), courbes subdivisées.
function flatten(path) {
  const rings = [];
  let cur = null;
  let start = null;
  const SUB = 6;   // subdivisions par courbe (PS2P n'a quasi que des droites)
  for (const c of path.commands) {
    if (c.type === "M") {
      if (cur && cur.length) rings.push(cur);
      cur = [{ x: c.x, y: c.y }];
      start = { x: c.x, y: c.y };
    } else if (c.type === "L") {
      cur.push({ x: c.x, y: c.y });
    } else if (c.type === "Q") {
      const p0 = cur[cur.length - 1];
      for (let i = 1; i <= SUB; i++) {
        const t = i / SUB, mt = 1 - t;
        cur.push({
          x: mt * mt * p0.x + 2 * mt * t * c.x1 + t * t * c.x,
          y: mt * mt * p0.y + 2 * mt * t * c.y1 + t * t * c.y,
        });
      }
    } else if (c.type === "C") {
      const p0 = cur[cur.length - 1];
      for (let i = 1; i <= SUB; i++) {
        const t = i / SUB, mt = 1 - t;
        cur.push({
          x: mt*mt*mt*p0.x + 3*mt*mt*t*c.x1 + 3*mt*t*t*c.x2 + t*t*t*c.x,
          y: mt*mt*mt*p0.y + 3*mt*mt*t*c.y1 + 3*mt*t*t*c.y2 + t*t*t*c.y,
        });
      }
    } else if (c.type === "Z") {
      if (cur && cur.length) rings.push(cur);
      cur = start ? [{ ...start }] : null;
    }
  }
  if (cur && cur.length) rings.push(cur);
  return rings;
}

function rasterize(ch) {
  const glyph = font.charToGlyph(ch);
  const path = glyph.getPath(0, 0, unitsPerEm);   // coords en unités font

  // 1) Échantillonnage SUR-RÉSOLU : grille SAMPLE_W × SAMPLE_H au pas SUB_STEP.
  const on = Array.from({ length: SAMPLE_H }, () => new Array(SAMPLE_W).fill(false));
  for (let r = 0; r < SAMPLE_H; r++) {
    for (let c = 0; c < SAMPLE_W; c++) {
      const fx = (c + 0.5) * SUB_STEP;             // centre de la sous-cellule
      const fy = -1000 + (r + 0.5) * SUB_STEP;     // haut → bas
      on[r][c] = inside(path, fx, fy);
    }
  }

  // 2) DILATATION 1 cellule (droite + bas) → traits ~2px à l'échelle sur-résolue. Les
  //    contre-formes font ≥2 cellules (grâce au sur-échantillonnage) → restent ouvertes.
  const out = Array.from({ length: OUT_H }, () => new Array(OUT_W).fill(false));
  for (let r = 0; r < SAMPLE_H; r++) {
    for (let c = 0; c < SAMPLE_W; c++) {
      if (!on[r][c]) continue;
      out[r][c] = true;
      if (DILATE) {
        out[r][c + 1] = true;
        out[r + 1][c] = true;
        out[r + 1][c + 1] = true;
      }
    }
  }
  return out.map(row => row.map(v => (v ? "#" : " ")).join(""));
}

// ── Génération du fichier .ts ──
function tsKey(ch) {
  if (ch === " ") return '" "';
  if (/^[A-Za-z]$/.test(ch)) return ch;          // clé identifiant nu (A, a, …)
  return JSON.stringify(ch);                       // "0", "!", "×", …
}

const entries = CHARS.map(ch => {
  const rows = rasterize(ch).map(r => JSON.stringify(r)).join(", ");
  return `  ${tsKey(ch)}: [${rows}],`;
});

const header = `// ─── Police pixel ${OUT_W}×${OUT_H} « Press Start 2P » (générée) ─────────────────────
// ⚠ FICHIER GÉNÉRÉ par scripts/gen-pixel-font.mjs — NE PAS éditer à la main.
// Régénérer : node scripts/gen-pixel-font.mjs --cols ${OUT_W} --rows ${OUT_H}
// Source : Press Start 2P (OFL), rastérisée depuis le .ttf officiel. Chaque glyphe =
// ${OUT_H} chaînes de ${OUT_W} caractères ("#"=allumé, " "=éteint), du haut vers le bas.
//
// ── FRONTIÈRE DONNÉE / RENDU (portage) ───────────────────────────────────────
// La table \`G\` est de la donnée passive, portable telle quelle (Lua/Rust/…). Au
// portage on ne réécrit QUE la boucle de dessin (cf. \`pegText\` dans hud.ts).
// Format identique à font.ts (mêmes exports) → drop-in.

export const PX_GLYPH_ROWS = ${OUT_H};   // hauteur d'un glyphe en dots
export const PX_GLYPH_W = ${OUT_W};      // largeur d'un glyphe en dots (monospace strict)
export const PX_GLYPH_GAP = 1;    // colonne vide entre deux glyphes

type Glyph = readonly string[];

const G: Record<string, Glyph> = {
${entries.join("\n")}
};

// Glyphe d'un caractère (espace si absent). Même contrat que font.ts.
export function pxGlyph(ch: string): Glyph {
  return G[ch] ?? G[" "]!;
}

// Largeur d'une chaîne en colonnes de dots (sans la dessiner).
export function pxTextCols(text: string): number {
  if (!text.length) return 0;
  return text.length * (PX_GLYPH_W + PX_GLYPH_GAP) - PX_GLYPH_GAP;
}
`;

writeFileSync(OUT_FILE, header);

// ── Émission d'un .ttf depuis LA MÊME donnée bitmap ──────────────────────────
// But : le web (menus HTML Peagle) peut utiliser cette police via @font-face sans
// dépendre du .ttf Google. Chaque dot allumé devient un carré plein dans le contour
// du glyphe → la police EST le bitmap, vectorisé. Le bitmap reste la source unique ;
// ce .ttf est un dérivé jetable (au portage Lua on ignore le .ttf, on lit la table G).
//
// Métriques : em = 1000 unités, cellule de OUT_H rangées → DOT = 1000/OUT_H unités.
// opentype place Y vers le HAUT (baseline = 0). On réserve PAD_BOT+1 rangées sous la
// baseline pour les descendantes : descenderRows = (zone basse). Concrètement on pose
// la baseline à BASELINE_ROW depuis le haut ; au-dessus = ascendantes (positif),
// en-dessous = descendantes (négatif).
const TTF_OUT = join(ROOT, "public/fonts/PeagleBitmap.ttf");
const DOT = Math.round(1000 / OUT_H);                 // taille d'un dot en unités font
// Rangées sous la baseline (descendantes). À SS=1 sans dilatation, la zone descendante
// occupe la/les dernière(s) rangée(s) de la cellule. On en réserve 2 (assez pour g/p/q/y).
const DESCENDER_ROWS = 2;
const BASELINE_ROW = OUT_H - DESCENDER_ROWS;          // rangée de la baseline depuis le haut
const ADVANCE = (OUT_W + 1) * DOT;                    // avance = largeur cellule + 1 gouttière

function glyphFor(ch) {
  const matrix = rasterize(ch);   // OUT_H lignes de OUT_W chars
  const path = new opentype.Path();
  for (let r = 0; r < OUT_H; r++) {
    const row = matrix[r];
    for (let c = 0; c < OUT_W; c++) {
      if (row[c] !== "#") continue;
      // (c,r) bitmap → rectangle en unités font. Y_font = (BASELINE_ROW - r) * DOT
      // (rangées au-dessus de la baseline → Y positif ; en-dessous → négatif).
      const x0 = c * DOT;
      const x1 = x0 + DOT;
      const yTop = (BASELINE_ROW - r) * DOT;          // haut du dot
      const yBot = yTop - DOT;                         // bas du dot
      // Contour horaire (remplissage non-zéro d'opentype) : un carré plein par dot.
      path.moveTo(x0, yBot);
      path.lineTo(x0, yTop);
      path.lineTo(x1, yTop);
      path.lineTo(x1, yBot);
      path.close();
    }
  }
  const name = ch === " " ? "space" : ch;
  return new opentype.Glyph({
    name,
    unicode: ch.codePointAt(0),
    advanceWidth: ADVANCE,
    path,
  });
}

// .notdef obligatoire en index 0.
const notdef = new opentype.Glyph({ name: ".notdef", advanceWidth: ADVANCE, path: new opentype.Path() });
const glyphs = [notdef, ...CHARS.map(glyphFor)];

const ttf = new opentype.Font({
  familyName: "PeagleBitmap",
  styleName: "Regular",
  unitsPerEm: 1000,
  ascender: (OUT_H - DESCENDER_ROWS) * DOT,
  descender: -DESCENDER_ROWS * DOT,
  glyphs,
});
writeFileSync(TTF_OUT, Buffer.from(ttf.toArrayBuffer()));
console.log(`TTF écrit → ${TTF_OUT}\n`);

// ── Aperçu console pour contrôle visuel ──
const preview = ["PEAGLE", "Score123", "gpqy"];
console.log(`Généré ${CHARS.length} glyphes en ${OUT_W}×${OUT_H} → ${OUT_FILE}\n`);
for (const word of preview) {
  const glyphs = [...word].map(rasterize);
  for (let r = 0; r < OUT_H; r++) {
    console.log(glyphs.map(g => g[r]).join(" ").replace(/#/g, "█").replace(/ /g, "·"));
  }
  console.log("");
}
