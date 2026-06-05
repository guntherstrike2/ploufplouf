import type { GameState } from "../types";
import { releaseParticle } from "./effects";

// Compaction in-place (write-index) plutôt que .filter() : pas de réallocation
// de tableau par frame, cohérent avec le ring-buffer de la trail.
export function updateParticles(s: GameState, timeScale: number): void {
  const ps = s.particles;
  let w = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    p.x += p.vx * timeScale; p.y += p.vy * timeScale;
    p.vy += 0.12 * timeScale; p.vx *= Math.pow(0.97, timeScale);
    p.life -= (0.03 / p.maxLife) * timeScale;
    if (p.life > 0) ps[w++] = p;
    else releaseParticle(p); // mort → retour au pool
  }
  ps.length = w;

  const ts = s.floatingTexts;
  let wt = 0;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]!;
    t.y -= 1.3 * timeScale;
    t.life -= 0.02 / t.maxLife;
    if (t.life > 0) ts[wt++] = t;
  }
  ts.length = wt;

  const rs = s.impactRings;
  let wr = 0;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!;
    r.life -= timeScale / r.maxLife;
    if (r.life > 0) rs[wr++] = r;
  }
  rs.length = wr;
}
