import type { GameState, Particle } from "../types";
import { BALANCE } from "../balance";

// Default particle color pools — renderer-independent, baked into each particle at spawn.
const PARTICLE_COLORS = {
  orange: ["#ff5500", "#ffaa00", "#ffdd44", "#ffffff", "#ff2200"] as const,
  normal: ["#2233aa", "#4455ff", "#0011aa", "#aaaaff", "#1122cc"] as const,
  bomb:   ["#ff1133", "#ff8800", "#ffcc00", "#ffffff", "#cc0022"] as const,
} as const;

const LEAF_COLORS = ["#4ab832", "#7acc44", "#aadd22", "#c4cc22", "#88bb33", "#55cc44", "#a8e040"] as const;

export function spawnParticles(
  s: GameState,
  x: number,
  y: number,
  orange: boolean,
  count: number,
  bomb = false,
): void {
  const colors = bomb
    ? PARTICLE_COLORS.bomb
    : orange
    ? PARTICLE_COLORS.orange
    : PARTICLE_COLORS.normal;

  for (let i = 0; i < count; i++) {
    // Evict oldest particles to stay under the cap
    if (s.particles.length >= BALANCE.particles.maxCount) s.particles.shift();

    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * (bomb ? 6 : 3.5);
    const p: Particle = {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (bomb ? 2 : 1),
      life: 1,
      maxLife: 0.6 + Math.random() * (bomb ? 1.2 : 0.6),
      color: colors[Math.floor(Math.random() * colors.length)]!,
      size: 2 + Math.random() * (bomb ? 5 : 3),
    };
    s.particles.push(p);
  }
}

// Éclat de feuilles — déclenché sur chaque impact de peg dans la forêt.
// Feuilles légères qui s'envolent et retombent doucement.
export function spawnLeafBurst(s: GameState, x: number, y: number, count = 5): void {
  for (let i = 0; i < count; i++) {
    if (s.particles.length >= BALANCE.particles.maxCount) s.particles.shift();
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.8;
    s.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.4,
      life: 1,
      maxLife: 0.9 + Math.random() * 1.1,
      color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]!,
      size: 2 + Math.random() * 2.5,
    });
  }
}

// Spawne une onde de choc localisée : un anneau qui se propage dans le décor +
// une lueur (bloom) au point d'impact. `intensity` 0..1 module rayon et durée.
// Aucun flash plein écran — le feedback reste autour du point de contact.
export function spawnImpactRing(
  s: GameState,
  x: number,
  y: number,
  color: string,
  intensity: number,
): void {
  if (s.impactRings.length >= BALANCE.impact.maxRings) s.impactRings.shift();
  s.impactRings.push({
    x, y,
    life: 1,
    maxLife: 14 + intensity * 16,
    maxRadius: 18 + intensity * 46,
    intensity,
    color,
  });
}
