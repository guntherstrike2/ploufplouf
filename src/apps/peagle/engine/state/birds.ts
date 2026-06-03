import { W, H } from "../constants";
import type { GameState } from "../types";

// Easter egg « peagle » : chaque peg éclaté fait surgir UN oiseau qui traverse
// le ciel en battant des ailes. Pas de hasard — un pop = un oiseau. Plafonné
// haut pour éviter qu'un combo géant n'en empile des centaines.

const MAX_BIRDS = 24;
const SKY_TOP   = 26;
const SKY_BOT   = (H - 80) * 0.45;   // moitié haute du ciel, au-dessus du sol

// Silhouettes d'aigle déclinées en quelques teintes chaudes pour varier.
const BIRD_TINTS = ["#2a2018", "#1e1810", "#33281a"] as const;

export function spawnBirds(s: GameState): void {
  if (s.birds.length >= MAX_BIRDS) return;

  const dir   = s.rng() < 0.5 ? 1 : -1;
  const y     = SKY_TOP + s.rng() * (SKY_BOT - SKY_TOP);
  const speed = 0.9 + s.rng() * 1.1;
  const scale = 0.8 + s.rng() * 0.7;
  const tint  = BIRD_TINTS[Math.floor(s.rng() * BIRD_TINTS.length)]!;

  s.birds.push({
    x: dir > 0 ? -16 : W + 16,
    y,
    vx: speed * dir,
    wingPhase: s.rng() * Math.PI * 2,
    flap: 0.22 + s.rng() * 0.16,
    scale,
    tint,
  });
}

export function updateBirds(s: GameState, timeScale: number): void {
  const bs = s.birds;
  if (bs.length === 0) return;
  // Compaction in-place (write-index) — pas de réallocation par frame.
  let w = 0;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i]!;
    b.x += b.vx * timeScale;
    b.wingPhase += b.flap * timeScale;
    // Flottement vertical doux au rythme des ailes → vol plus vivant.
    b.y += Math.sin(b.wingPhase * 0.5) * 0.15 * timeScale;
    if (b.x > -24 && b.x < W + 24) bs[w++] = b;
  }
  bs.length = w;
}
