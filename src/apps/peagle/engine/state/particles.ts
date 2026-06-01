import type { GameState } from "../types";

export function updateParticles(s: GameState, timeScale: number): void {
  s.particles = s.particles.filter(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.12; p.vx *= 0.97;
    p.life -= 0.03 / p.maxLife;
    return p.life > 0;
  });

  s.floatingTexts = s.floatingTexts.filter(t => {
    t.y -= 1.3 * timeScale;
    t.life -= 0.02 / t.maxLife;
    return t.life > 0;
  });

  s.impactRings = s.impactRings.filter(r => {
    r.life -= timeScale / r.maxLife;
    return r.life > 0;
  });
}
