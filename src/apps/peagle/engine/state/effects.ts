import type { GameState, Particle } from "../types";
import { BALANCE } from "../balance";
import { RAMP } from "../palette";

// Default particle color pools — renderer-independent, baked into each particle
// at spawn. Toutes dérivées de la palette « Bosquet » (palette.ts) : les pegs
// normaux crachent du vert feuille (et non l'ancien bleu arcade hardcodé qui
// jurait avec la forêt), les cibles/bombes restent dans la rampe or→orange→rouge.
const PARTICLE_COLORS = {
  orange: [RAMP.orange[400], RAMP.gold[300], RAMP.gold[100], RAMP.cream, RAMP.orange[600]] as const,
  normal: [RAMP.green[200], RAMP.green[300], RAMP.green[100], RAMP.green[50], RAMP.green[400]] as const,
  bomb:   [RAMP.red, RAMP.orange[400], RAMP.gold[300], RAMP.cream, RAMP.orange[600]] as const,
} as const;

const LEAF_COLORS = [RAMP.green[300], RAMP.green[200], RAMP.green[100], RAMP.green[400], RAMP.green[500], RAMP.green[600], RAMP.green[50]] as const;

// ─── Pool d'objets Particle ──────────────────────────────────────────────────
// Sur les gros combos, des centaines de particules sont créées puis jetées par
// seconde. Recycler les objets (free-list) au lieu d'allouer/garbage évite le
// churn GC responsable de micro-saccades — même logique que le ring-buffer de
// la traînée de l'œuf.
const _particlePool: Particle[] = [];

function acquireParticle(): Particle {
  return _particlePool.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: "#fff", size: 1 };
}

// Rend une particule morte au pool (taille bornée pour ne pas retenir de mémoire).
export function releaseParticle(p: Particle): void {
  if (_particlePool.length < BALANCE.particles.maxCount + 32) _particlePool.push(p);
}

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

  // Évince les plus anciennes en un seul splice (O(n)) plutôt qu'un shift par
  // particule (O(n) × count) — évite un pic sur les gros combos. Les évincées
  // retournent au pool pour réutilisation.
  const overflow = s.particles.length + count - BALANCE.particles.maxCount;
  if (overflow > 0) {
    for (let i = 0; i < overflow; i++) releaseParticle(s.particles[i]!);
    s.particles.splice(0, overflow);
  }

  for (let i = 0; i < count; i++) {
    const angle = s.rng() * Math.PI * 2;
    const speed = 1.5 + s.rng() * (bomb ? 6 : 3.5);
    const p = acquireParticle();
    p.x = x; p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed - (bomb ? 2 : 1);
    p.life = 1;
    p.maxLife = 0.6 + s.rng() * (bomb ? 1.2 : 0.6);
    p.color = colors[Math.floor(s.rng() * colors.length)]!;
    p.size = 2 + s.rng() * (bomb ? 5 : 3);
    s.particles.push(p);
  }
}

// Éclat de feuilles — déclenché sur chaque impact de peg dans la forêt.
// Feuilles légères qui s'envolent et retombent doucement.
export function spawnLeafBurst(s: GameState, x: number, y: number, count = 5): void {
  const overflow = s.particles.length + count - BALANCE.particles.maxCount;
  if (overflow > 0) {
    for (let i = 0; i < overflow; i++) releaseParticle(s.particles[i]!);
    s.particles.splice(0, overflow);
  }
  for (let i = 0; i < count; i++) {
    const angle = s.rng() * Math.PI * 2;
    const speed = 0.5 + s.rng() * 1.8;
    const p = acquireParticle();
    p.x = x; p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed - 1.4;
    p.life = 1;
    p.maxLife = 0.9 + s.rng() * 1.1;
    p.color = LEAF_COLORS[Math.floor(s.rng() * LEAF_COLORS.length)]!;
    p.size = 2 + s.rng() * 2.5;
    s.particles.push(p);
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
  const imp = BALANCE.impact;
  // L'intensité peut dépasser 1 (crescendo de combo non plafonné). Pour la TAILLE,
  // on laisse croître au-delà de 1 mais à rendement décroissant (√ sur le surplus) :
  // l'onde continue de grandir sans jamais envahir l'écran. Pour le BLOOM/FLASH,
  // on borne à 1 — au-delà ce serait un aplat blanc illisible.
  const amp = intensity <= 1 ? intensity : 1 + Math.sqrt(intensity - 1);
  s.impactRings.push({
    x, y,
    life: 1,
    maxLife: imp.ringLifeBase + Math.min(amp, 2) * imp.ringLifeFull,
    maxRadius: imp.ringRadiusBase + amp * imp.ringRadiusFull,
    intensity: Math.min(1, intensity),
    color,
  });
}
