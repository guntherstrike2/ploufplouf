// ─── Peagle — visual fx state (particles / floating text) ────────────────────
// These live in GameState because the renderer reads them, but they carry no
// gameplay meaning. Spawned by event reactions (see audio/feel wiring), updated
// here, drawn by the renderer.

import { FIELD } from "../content/config";
import type { GameState, Particle, Vec } from "./types";

export function spawnBurst(s: GameState, at: Vec, color: string, n = 8): void {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const sp = 1.5 + Math.random() * 2.5;
    s.particles.push({
      pos: { ...at },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: 1,
      color,
      size: 2 + Math.random() * 2,
    });
  }
  if (s.particles.length > 240) s.particles.splice(0, s.particles.length - 240);
}

export function spawnText(s: GameState, at: Vec, text: string, color: string): void {
  s.floatingTexts.push({ pos: { ...at }, text, life: 1, color });
  if (s.floatingTexts.length > 30) s.floatingTexts.shift();
}

export function updateParticles(s: GameState, dt: number): void {
  for (const p of s.particles as Particle[]) {
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.vel.y += 0.12 * dt;
    p.life -= 0.03 * dt;
  }
  s.particles = s.particles.filter((p) => p.life > 0 && p.pos.y < FIELD.h + 20);

  for (const t of s.floatingTexts) {
    t.pos.y -= 0.6 * dt;
    t.life -= 0.02 * dt;
  }
  s.floatingTexts = s.floatingTexts.filter((t) => t.life > 0);
}
