import { W, PEG_R, LAUNCHER_X, LAUNCHER_Y } from "./constants";
import type { Peg } from "./types";
import { tHexGrid, tCircle, tArc, tGrid, dedup, makePeg } from "./tableau";
import { mulberry32, hashSeed, randRange, randInt, shuffle, type Rng } from "./rng";
import { difficultyFor, type DifficultyParams } from "./difficulty";
import { computeAimLine } from "./physics";

// ─── Génération de niveaux : aléatoire seedé, structuré et validé ────────────
//
// Pipeline « en béton » :
//   1. RNG SEEDÉ      seed = f(niveau) → déterministe, reproductible, debuggable.
//   2. MOTIFS         1-2 structures piochées (grille hex, anneaux, arches…) →
//                     un squelette « qui a l'air voulu ».
//   3. REMPLISSAGE    Poisson-disk (blue noise) miroir → des pegs en plus,
//                     répartis naturellement, jamais collés, jamais en paquets.
//   4. DIFFICULTÉ     densité / % oranges / bumpers / jitter pilotés par
//                     difficultyFor(level) (voir difficulty.ts).
//   5. ASSIGNATION    types de pegs posés via le système data-driven (peg-kinds).
//   6. VALIDATION     on simule la ligne de visée (generate-and-test) : si trop
//                     peu de pegs sont atteignables, on re-roll le seed. Garantie
//                     qu'au moins une cible est accessible. Fallback grille sûre.

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

interface Area {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  cx: number;
}

const AREA: Area = { x0: 44, x1: W - 44, y0: 180, y1: 490, cx: W / 2 };

// ─── Motifs structurels ───────────────────────────────────────────────────────
// POINT D'EXTENSION : ajoute un builder (rng, area) => Peg[] et référence-le dans
// MOTIFS. Reste symétrique/centré quand tu peux : ça « a l'air dessiné ».

function motifHexField(rng: Rng, a: Area): Peg[] {
  const spacing = randInt(rng, 22, 28);
  const cols = Math.floor((a.x1 - a.x0) / spacing);
  const rows = randInt(rng, 10, 16);
  const originX = a.cx - ((cols - 1) * spacing) / 2;
  const originY = a.y0 + randInt(rng, 0, 16);
  return tHexGrid(originX, originY, cols, rows, spacing);
}

function motifRings(rng: Rng, a: Area): Peg[] {
  const cy = (a.y0 + a.y1) / 2;
  const n = randInt(rng, 2, 3);
  const out: Peg[] = [];
  for (let i = 0; i < n; i++) {
    const r = 50 + i * 48;
    out.push(...tCircle(a.cx, cy, r, Math.round(8 + r / 8)));
  }
  return out;
}

function motifArches(rng: Rng, a: Area): Peg[] {
  const cy = a.y0 + 30;
  const n = randInt(rng, 2, 4);
  const out: Peg[] = [];
  for (let i = 0; i < n; i++) {
    const r = 70 + i * 42;
    out.push(...tArc(a.cx, cy, r, Math.PI * 0.12, Math.PI * 0.88, Math.round(6 + r / 14)));
  }
  return out;
}

function motifDiamond(rng: Rng, a: Area): Peg[] {
  const rows = randInt(rng, 9, 13);
  const spacing = randInt(rng, 26, 32);
  const y0 = a.y0 + 10;
  const out: Peg[] = [];
  const half = (rows - 1) / 2;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * spacing * 0.9;
    const count = r <= half ? r + 1 : rows - r;
    for (let c = 0; c < count; c++) {
      out.push(makePeg(a.cx - (count - 1) * spacing * 0.5 + c * spacing, y));
    }
  }
  return out;
}

function motifColumns(rng: Rng, a: Area): Peg[] {
  const rows = randInt(rng, 8, 12);
  const cols = randInt(rng, 2, 3);
  const sx = randInt(rng, 30, 40);
  const sy = randInt(rng, 38, 52);
  const y0 = a.y0 + 6;
  const left = tGrid(a.x0 + 12, y0, cols, rows, sx, sy);
  const right = left.map(p => makePeg(2 * a.cx - p.x, p.y));
  const center = tCircle(a.cx, (a.y0 + a.y1) / 2, randInt(rng, 46, 70), randInt(rng, 10, 16));
  return [...left, ...right, ...center];
}

function motifWave(rng: Rng, a: Area): Peg[] {
  const out: Peg[] = [];
  const rows = randInt(rng, 3, 5);
  const amp = randInt(rng, 18, 34);
  const period = randRange(rng, 90, 150);
  const phase = rng() * Math.PI * 2;
  const sx = randInt(rng, 26, 34);
  const rowGap = randInt(rng, 46, 62);
  for (let r = 0; r < rows; r++) {
    const baseY = a.y0 + 30 + r * rowGap;
    for (let x = a.x0 + 10; x <= a.x1 - 10; x += sx) {
      const y = baseY + Math.sin((x / period) * Math.PI * 2 + phase + r * 0.6) * amp;
      out.push(makePeg(x, y));
    }
  }
  return out;
}

// Lignes décalées (staggered) couvrant toute la hauteur jouable — style Peggle/pachinko.
// Génère ~200-300 pegs sur une grille hex dense ; compose() taille ensuite au budget.
function motifPachinko(rng: Rng, a: Area): Peg[] {
  const hSpacing = randInt(rng, 24, 30);
  const vGap = Math.round(hSpacing * 0.86); // ≈ √3/2 pour un packing hexagonal
  const cols = Math.ceil((a.x1 - a.x0) / hSpacing) + 1;
  const rows = Math.ceil((a.y1 - a.y0) / vGap) + 1;
  const startX = a.cx - ((cols - 1) * hSpacing) / 2;
  const startY = a.y0 + randInt(rng, 0, 8);
  const out: Peg[] = [];
  for (let r = 0; r < rows; r++) {
    const y = startY + r * vGap;
    const offset = (r % 2) * (hSpacing / 2);
    for (let c = 0; c < cols; c++) {
      const x = startX + c * hSpacing + offset;
      if (x >= a.x0 - 2 && x <= a.x1 + 2) {
        out.push(makePeg(x, clamp(y, a.y0, a.y1)));
      }
    }
  }
  return out;
}

// Poids élevé pour motifPachinko → style dense par défaut, variété assurée par les autres.
const MOTIFS = [motifPachinko, motifPachinko, motifPachinko, motifHexField, motifHexField, motifRings, motifArches, motifDiamond, motifWave];

// ─── Remplissage Poisson-disk (Bridson) ──────────────────────────────────────
// Blue noise : points aléatoires, jamais plus proches que `minDist`, sans paquets
// ni trous. On l'échantillonne sur la MOITIÉ gauche puis on miroir → symétrie.

function poissonHalf(rng: Rng, a: Area, minDist: number, k = 18): { x: number; y: number }[] {
  const x0 = a.x0, y0 = a.y0, x1 = a.cx, y1 = a.y1;
  const cell = minDist / Math.SQRT2;
  const cols = Math.max(1, Math.ceil((x1 - x0) / cell));
  const rows = Math.max(1, Math.ceil((y1 - y0) / cell));
  const grid = new Array<number>(cols * rows).fill(-1);
  const pts: { x: number; y: number }[] = [];
  const active: number[] = [];
  const gridIndex = (x: number, y: number) =>
    Math.floor((x - x0) / cell) + Math.floor((y - y0) / cell) * cols;
  const addPoint = (x: number, y: number) => {
    const id = pts.length;
    pts.push({ x, y });
    grid[gridIndex(x, y)] = id;
    active.push(id);
  };

  addPoint(randRange(rng, x0, x1), randRange(rng, y0, y1));

  while (active.length > 0) {
    const ai = Math.floor(rng() * active.length);
    const p = pts[active[ai]!]!;
    let found = false;
    for (let i = 0; i < k; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = minDist * (1 + rng());
      const nx = p.x + Math.cos(ang) * rad;
      const ny = p.y + Math.sin(ang) * rad;
      if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue;
      const cx = Math.floor((nx - x0) / cell);
      const cy = Math.floor((ny - y0) / cell);
      let ok = true;
      for (let gx = Math.max(0, cx - 2); gx <= Math.min(cols - 1, cx + 2) && ok; gx++) {
        for (let gy = Math.max(0, cy - 2); gy <= Math.min(rows - 1, cy + 2) && ok; gy++) {
          const id = grid[gx + gy * cols]!;
          if (id >= 0) {
            const q = pts[id]!;
            if ((q.x - nx) ** 2 + (q.y - ny) ** 2 < minDist * minDist) ok = false;
          }
        }
      }
      if (ok) {
        addPoint(nx, ny);
        found = true;
        break;
      }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}

// ─── Composition d'un tableau (avant assignation des types) ──────────────────

function compose(rng: Rng, diff: DifficultyParams): Peg[] {
  const motifs = shuffle(rng, [...MOTIFS]).slice(0, diff.motifCount);
  let pegs: Peg[] = [];
  for (const m of motifs) pegs.push(...m(rng, AREA));

  // Jitter (casse la régularité) + maintien dans la zone jouable.
  for (const p of pegs) {
    if (diff.jitter > 0) {
      p.x += randRange(rng, -diff.jitter, diff.jitter);
      p.y += randRange(rng, -diff.jitter, diff.jitter);
    }
    p.x = clamp(p.x, AREA.x0, AREA.x1);
    p.y = clamp(p.y, AREA.y0, AREA.y1);
  }

  // Remplissage Poisson miroir jusqu'au budget.
  if (pegs.length < diff.pegBudget) {
    const half = shuffle(rng, poissonHalf(rng, AREA, diff.fillSpacing));
    for (const pt of half) {
      if (pegs.length >= diff.pegBudget) break;
      pegs.push(makePeg(pt.x, pt.y));
      const mx = 2 * AREA.cx - pt.x;
      if (mx >= AREA.x0 && mx <= AREA.x1 && pegs.length < diff.pegBudget) {
        pegs.push(makePeg(mx, pt.y));
      }
    }
  }

  // Les motifs sont en tête → dedup les conserve face au remplissage.
  pegs = dedup(pegs, PEG_R * 2.8);
  if (pegs.length > diff.pegBudget) {
    pegs = shuffle(rng, pegs).slice(0, diff.pegBudget);
  }
  return pegs;
}

// ─── Validation : quels pegs sont directement atteignables au tir ? ──────────
// On lance un éventail de rayons depuis le lanceur (la même simulation que la
// ligne de visée du jeu) et on note le premier peg touché par chacun.

function directlyReachable(pegs: Peg[]): Set<Peg> {
  const set = new Set<Peg>();
  const N = 48;
  const reachSq = (PEG_R * 3) ** 2;
  for (let i = 0; i < N; i++) {
    const angle = 0.42 + (Math.PI - 0.84) * (i / (N - 1)); // ~24°..156°
    const line = computeAimLine(LAUNCHER_X, LAUNCHER_Y, angle, pegs);
    const last = line[line.length - 1];
    if (!last) continue;
    let best: Peg | null = null;
    let bd = Infinity;
    for (const p of pegs) {
      const d = (p.x - last.x) ** 2 + (p.y - last.y) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best && bd < reachSq) set.add(best);
  }
  return set;
}

// ─── Assignation des types de pegs (data-driven, voir peg-kinds.ts) ──────────

function assignKinds(rng: Rng, pegs: Peg[], reachable: Set<Peg>, diff: DifficultyParams): void {
  const n = pegs.length;
  for (const p of pegs) p.kind = "normal";

  const order = shuffle(rng, [...pegs.keys()]);

  // Cibles oranges.
  const targetCount = Math.max(1, Math.min(n - 1, Math.round(n * diff.orangePct)));
  let assigned = 0;
  for (const i of order) {
    if (assigned >= targetCount) break;
    pegs[i]!.kind = "orange";
    assigned++;
  }

  // Garantie de jouabilité : au moins une cible atteignable directement.
  const hasReachableTarget = pegs.some(p => p.kind === "orange" && reachable.has(p));
  if (!hasReachableTarget && reachable.size > 0) {
    const r = [...reachable];
    r[Math.floor(rng() * r.length)]!.kind = "orange";
  }

  // Bumpers (obstacles permanents) parmi les pegs normaux restants.
  let placed = 0;
  for (const i of order) {
    if (placed >= diff.bumperCount) break;
    const p = pegs[i]!;
    if (p.kind !== "normal" || p.y < 150) continue;
    p.kind = "bumper";
    placed++;
  }

}

// ─── Fallback garanti ────────────────────────────────────────────────────────

function fallbackGrid(): Peg[] {
  return tHexGrid(W / 2 - 7 * 24, 194, 15, 9, 24);
}

// ─── Builder principal ─────────────────────────────────────────────────────────

export function buildLevel(level: number, runSeed = 0): Peg[] {
  const diff = difficultyFor(level);
  // Graine = f(niveau, partie) : tableaux distincts par niveau ET par partie.
  const baseSeed = hashSeed(hashSeed(level, runSeed), 0x9e3a91e);

  let best: Peg[] | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const rng = mulberry32(hashSeed(baseSeed, attempt + 1));
    const pegs = compose(rng, diff);
    const reachable = directlyReachable(pegs);
    if (pegs.length >= 12 && reachable.size >= 4) {
      assignKinds(rng, pegs, reachable, diff);
      return pegs;
    }
    if (!best || pegs.length > best.length) best = pegs;
  }

  // Aucun candidat validé : prend le meilleur, ou une grille garantie.
  const pegs = best && best.length >= 12 ? best : fallbackGrid();
  const rng = mulberry32(hashSeed(baseSeed, 11));
  assignKinds(rng, pegs, directlyReachable(pegs), diff);
  return pegs;
}
