"use client";

import { useRef, useCallback, useState } from "react";
import type { CelebrationOptions, CelebType } from "@/types/plouf-plouf";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
  life: number;
  shape: string;
  gravity: number;
  wobble: number;
  wobbleSpeed: number;
  targetX?: number;
  targetY?: number;
  speed?: number;
  char?: string;
  /** How much life decreases per frame (0 = no fade) */
  lifeDecay?: number;
  /** Multiplier for movement speed (1 = normal) */
  speedMultiplier?: number;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

function getColor(o: CelebrationOptions): string {
  if (o.rainbow) {
    const hue = (Date.now() / 10 + Math.random() * 360) % 360;
    return `hsl(${hue}, 100%, 60%)`;
  }
  return [o.color1, o.color2, o.color3][Math.floor(Math.random() * 3)] ?? o.color1;
}

function makeTrophyParticle(W: number, H: number, color: string, trophies: string[]): Particle {
  const edge = Math.floor(Math.random() * 4);
  let x: number, y: number, vx: number, vy: number;

  switch (edge) {
    case 0: // top
      x = Math.random() * W;
      y = -40;
      vx = rand(-1, 1);
      vy = rand(0.8, 1.8);
      break;
    case 1: // right
      x = W + 40;
      y = Math.random() * H;
      vx = rand(-1.8, -0.6);
      vy = rand(-0.8, 0.8);
      break;
    case 2: // bottom
      x = Math.random() * W;
      y = H + 40;
      vx = rand(-1, 1);
      vy = rand(-1.8, -0.8);
      break;
    default: // left
      x = -40;
      y = Math.random() * H;
      vx = rand(0.6, 1.8);
      vy = rand(-0.8, 0.8);
      break;
  }

  return {
    x,
    y,
    vx,
    vy,
    size: rand(24, 46),
    color,
    life: 1,
    shape: "char" as const,
    gravity: 0,
    rot: rand(-0.2, 0.2),
    vrot: rand(-0.06, 0.06),
    wobble: rand(0, Math.PI * 2),
    wobbleSpeed: rand(0.02, 0.05),
    char: trophies[Math.floor(Math.random() * trophies.length)],
  };
}

function makeParticles(type: CelebType, o: CelebrationOptions): Particle[] {
  const c = getColor(o);
  const W = window.innerWidth;
  const H = window.innerHeight;
  const speedMult = o.speedMultiplier ?? 1;
  const decay = o.lifeDecay ?? 0;

  const raw: Particle[] = (() => { switch (type) {
    case "confetti":
      return [
        {
          x: Math.random() * W,
          y: -20 - Math.random() * 200,
          vx: rand(-3, 3),
          vy: rand(2, 6),
          rot: Math.random() * Math.PI * 2,
          vrot: rand(-0.2, 0.2),
          size: rand(6, 14),
          color: c,
          life: 1,
          shape: "rect",
          gravity: 0.15,
          wobble: rand(0, Math.PI * 2),
          wobbleSpeed: rand(0.05, 0.15),
        },
      ];
    case "fireworks": {
      const cx = rand(W * 0.2, W * 0.8);
      const cy = rand(H * 0.2, H * 0.5);
      const color = c;
      return Array.from({ length: randInt(50, 80) }, (_, i) => {
        const angle = (i / 50) * Math.PI * 2;
        const speed = rand(3, 9);
        return {
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: rand(3, 7),
          color: Math.random() > 0.7 ? getColor(o) : color,
          life: 1,
          shape: "circle",
          gravity: 0.08,
          rot: 0,
          vrot: 0,
          wobble: 0,
          wobbleSpeed: 0,
        };
      });
    }
    case "rain":
      return [
        {
          x: Math.random() * W,
          y: -20,
          vx: 0,
          vy: rand(3, 6),
          size: rand(8, 18),
          color: c,
          life: 1,
          shape: "star",
          gravity: 0.05,
          rot: Math.random() * Math.PI * 2,
          vrot: rand(-0.1, 0.1),
          wobble: 0,
          wobbleSpeed: 0,
        },
      ];
    case "matrix": {
      const chars =
        "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789";
      return [
        {
          x: Math.random() * W,
          y: -20,
          vx: 0,
          vy: rand(4, 10),
          size: rand(14, 28),
          color: "#00ff41",
          life: 1,
          shape: "char",
          gravity: 0,
          rot: 0,
          vrot: 0,
          wobble: 0,
          wobbleSpeed: 0,
          char: chars[Math.floor(Math.random() * chars.length)],
        },
      ];
    }
    case "hearts":
      return [
        {
          x: Math.random() * W,
          y: H + 20,
          vx: rand(-1, 1),
          vy: rand(-6, -3),
          size: rand(10, 24),
          color: c,
          life: 1,
          shape: "heart",
          gravity: -0.05,
          rot: 0,
          vrot: rand(-0.1, 0.1),
          wobble: rand(0, Math.PI * 2),
          wobbleSpeed: rand(0.05, 0.15),
        },
      ];
    case "stars":
      return [
        {
          x: Math.random() * W,
          y: -20,
          vx: rand(-2, 2),
          vy: rand(2, 5),
          size: rand(8, 18),
          color: c,
          life: 1,
          shape: "sparkle",
          gravity: 0.03,
          rot: Math.random() * Math.PI * 2,
          vrot: rand(-0.2, 0.2),
          wobble: rand(0, Math.PI * 2),
          wobbleSpeed: rand(0.05, 0.1),
        },
      ];
    case "xp": {
      const cx = W / 2;
      const cy = H / 2;
      const angle = Math.random() * Math.PI * 2;
      const distance = rand(200, 500);
      return [
        {
          x: cx + Math.cos(angle) * distance,
          y: cy + Math.sin(angle) * distance,
          vx: 0,
          vy: 0,
          targetX: cx + rand(-30, 30),
          targetY: cy + rand(-30, 30),
          size: rand(6, 14),
          color: c,
          life: 1,
          shape: "orb",
          gravity: 0,
          rot: 0,
          vrot: 0,
          wobble: 0,
          wobbleSpeed: 0,
          speed: rand(0.02, 0.06),
        },
      ];
    }
    case "bubbles":
      return [
        {
          x: Math.random() * W,
          y: H + 20,
          vx: rand(-1.5, 1.5),
          vy: rand(-4, -2),
          size: rand(10, 40),
          color: c,
          life: 1,
          shape: "circle",
          gravity: -0.03,
          rot: 0,
          vrot: 0,
          wobble: rand(0, Math.PI * 2),
          wobbleSpeed: rand(0.03, 0.08),
        },
      ];
    case "poop": {
      const poops = ["💩", "🤎", "🟤"];
      return [
        {
          x: Math.random() * W,
          y: -20 - Math.random() * 200,
          vx: rand(-2, 2),
          vy: rand(1.5, 3.5),
          size: rand(16, 36),
          color: c,
          life: 1,
          shape: "char",
          gravity: 0.05,
          rot: rand(-0.3, 0.3),
          vrot: rand(-0.15, 0.15),
          wobble: rand(0, Math.PI * 2),
          wobbleSpeed: rand(0.04, 0.12),
          char: poops[Math.floor(Math.random() * poops.length)],
        },
      ];
    }
    case "money": {
      const moneys = ["💰", "💵", "💸", "🪙", "💎"];
      return [
        {
          x: Math.random() * W,
          y: -20 - Math.random() * 200,
          vx: rand(-2, 2),
          vy: rand(1, 2.5),
          size: rand(18, 38),
          color: c,
          life: 1,
          shape: "char",
          gravity: 0.04,
          rot: rand(-0.4, 0.4),
          vrot: rand(-0.2, 0.2),
          wobble: rand(0, Math.PI * 2),
          wobbleSpeed: rand(0.06, 0.14),
          char: moneys[Math.floor(Math.random() * moneys.length)],
        },
      ];
    }
    case "alien": {
      const aliens = ["👽", "🛸", "👾", "🖖", "🛸"];
      const fromLeft = Math.random() > 0.5;
      const spawnX = fromLeft ? -50 : W + 50;
      const vx = fromLeft ? rand(2, 5) : rand(-5, -2);
      return [
        {
          x: spawnX,
          y: rand(H * 0.1, H * 0.5),
          vx,
          vy: rand(-2, 2),
          size: rand(20, 40),
          color: c,
          life: 1,
          shape: "char",
          gravity: 0,
          rot: 0,
          vrot: rand(-0.1, 0.1),
          wobble: rand(0, Math.PI * 2),
          wobbleSpeed: rand(0.04, 0.1),
          char: aliens[Math.floor(Math.random() * aliens.length)],
        },
      ];
    }
    case "flame": {
      const flames = ["🔥", "💥", "✨", "💫", "⚡"];
      return [
        {
          x: Math.random() * W,
          y: H + 20 + Math.random() * 100,
          vx: rand(-1, 1),
          vy: rand(-14, -10),
          size: rand(18, 40),
          color: c,
          life: 1,
          shape: "char",
          gravity: 0.18,
          rot: rand(-0.5, 0.5),
          vrot: rand(-0.3, 0.3),
          wobble: rand(0, Math.PI * 2),
          wobbleSpeed: rand(0.06, 0.15),
          char: flames[Math.floor(Math.random() * flames.length)],
        },
      ];
    }
    case "trophy": {
      const trophies = ["🏆", "🥇", "🥈", "🥉", "🎖️", "🏅", "👑"];
      return [makeTrophyParticle(W, H, c, trophies)];
    }
    case "trophy-gold": {
      const trophies = ["🏆", "🥇", "👑", "🏆", "🥇", "👑", "🌟", "💛", "⭐"];
      return [makeTrophyParticle(W, H, c, trophies)];
    }
    case "trophy-diamond": {
      const trophies = ["💎", "💎", "💎", "💠", "💍", "✨", "💎", "💎", "💎"];
      return [makeTrophyParticle(W, H, c, trophies)];
    }
    case "trophy-silver": {
      const trophies = ["🥈", "🎖️", "🥈", "🎖️", "🤍", "🪩", "💿", "🕶️", "🔩"];
      return [makeTrophyParticle(W, H, c, trophies)];
    }
    case "trophy-bronze": {
      const trophies = ["🥉", "🏅", "🥉", "🏅", "🤎", "🍂", "🔔", "🪙", "🧡"];
      return [makeTrophyParticle(W, H, c, trophies)];
    }
  }})(); // end IIFE

  return raw.map(p => ({
    ...p,
    vx: p.vx * speedMult,
    vy: p.vy * speedMult,
    vrot: p.vrot * speedMult,
    speedMultiplier: speedMult,
    lifeDecay: decay,
  }));
}

// Pre-render text/emoji to offscreen canvases so the hot loop uses drawImage
// instead of fillText — the latter re-rasterizes color emoji glyphs every frame.
const charCanvasCache = new Map<string, HTMLCanvasElement>();

function getCharCanvas(char: string, fontSize: number, color: string): HTMLCanvasElement {
  const bucket = Math.round(fontSize / 4) * 4;
  const key = `${char}|${bucket}|${color}`;
  const cached = charCanvasCache.get(key);
  if (cached) return cached;

  const size = bucket * 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `bold ${bucket}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", monospace, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(char, size / 2, size / 2);
  charCanvasCache.set(key, canvas);
  return canvas;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;

  switch (p.shape) {
    case "rect":
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      break;
    case "circle":
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "star":
      drawStar(ctx, 0, 0, 5, p.size, p.size / 2);
      break;
    case "heart":
      drawHeart(ctx, 0, 0, p.size);
      break;
    case "sparkle":
      drawSparkle(ctx, 0, 0, p.size);
      break;
    case "orb": {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.3, p.color);
      grad.addColorStop(1, p.color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "char": {
      const cached = getCharCanvas(p.char ?? "?", p.size, p.color);
      ctx.drawImage(cached, -p.size, -p.size, p.size * 2, p.size * 2);
      break;
    }
  }
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerR: number,
  innerR: number
) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(
      cx + Math.cos(rot) * outerR,
      cy + Math.sin(rot) * outerR
    );
    rot += step;
    ctx.lineTo(
      cx + Math.cos(rot) * innerR,
      cy + Math.sin(rot) * innerR
    );
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
  ctx.fill();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.beginPath();
  const h = size * 0.3;
  ctx.moveTo(cx, cy + size / 2);
  ctx.bezierCurveTo(cx + size, cy, cx + size, cy - size / 2, cx, cy - h);
  ctx.bezierCurveTo(cx - size, cy - size / 2, cx - size, cy, cx, cy + size / 2);
  ctx.closePath();
  ctx.fill();
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(angle) * size,
      cy + Math.sin(angle) * size
    );
  }
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = size / 4;
  ctx.stroke();
}

function updateParticle(p: Particle): boolean {
  const sm = p.speedMultiplier ?? 1;
  if (p.shape === "orb" && p.targetX !== undefined && p.targetY !== undefined) {
    const speed = (p.speed ?? 0.04) * sm;
    p.vx += (p.targetX - p.x) * speed;
    p.vy += (p.targetY - p.y) * speed;
    p.vx *= 0.9;
    p.vy *= 0.9;
    if (Math.hypot(p.targetX - p.x, p.targetY - p.y) < 20) p.life -= 0.05;
  } else {
    p.vy += p.gravity * sm;
    if (p.wobbleSpeed > 0) {
      p.wobble += p.wobbleSpeed * sm;
      p.x += Math.sin(p.wobble) * 0.5 * sm;
    }
  }
  p.x += p.vx;
  p.y += p.vy;
  p.rot += p.vrot;

  // Fade-out: life decays every frame
  p.life -= p.lifeDecay ?? 0;

  const H = window.innerHeight;
  const W = window.innerWidth;
  if (p.shape === "heart" ? p.y < -50 : p.y > H + 50) return false;
  if (p.x < -100 || p.x > W + 100) return false;
  return p.life > 0;
}

export function useCelebration() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const spawnAccRef = useRef(0);
  const spawningRef = useRef(true);
  const [active, setActive] = useState(false);

  /** Hard stop — instant clear (used when a new celebration replaces the current one). */
  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    spawningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    particlesRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  /** Clean-up after the last particle naturally fades out. */
  const finish = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    particlesRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const start = useCallback(
    (options: CelebrationOptions) => {
      if (activeRef.current) stop();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      activeRef.current = true;
      setActive(true);
      spawningRef.current = true;
      particlesRef.current = [];
      spawnAccRef.current = 0;

      const loop = () => {
        if (!activeRef.current) return;

        // Spawn phase — keep emitting particles until the timer fires
        if (spawningRef.current) {
          spawnAccRef.current += options.density / 60;
          while (spawnAccRef.current >= 1) {
            spawnAccRef.current -= 1;
            const batch = makeParticles(options.type, options);
            particlesRef.current.push(...batch);
          }
        }

        if (options.type === "matrix" && !options.forceTransparent) {
          ctx.fillStyle = "rgba(0,0,0,0.15)";
          ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        } else {
          ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }

        particlesRef.current = particlesRef.current.filter((p) => {
          const alive = updateParticle(p);
          if (alive) drawParticle(ctx, p);
          return alive;
        });

        if (particlesRef.current.length > 2000) {
          particlesRef.current.splice(0, particlesRef.current.length - 2000);
        }

        // After spawning stopped, when all particles are gone → clean exit
        if (!spawningRef.current && particlesRef.current.length === 0) {
          finish();
          return;
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);

      // When the celebration duration ends:
      // - fadeOut ON  → stop spawning, boost fade so remaining particles dissolve gracefully
      // - fadeOut OFF → instant clear (old behavior)
      setTimeout(() => {
        if (options.fadeOut === false) {
          stop();
        } else {
          spawningRef.current = false;
          for (const p of particlesRef.current) {
            p.lifeDecay = Math.max(p.lifeDecay ?? 0.005, 0.025);
          }
        }
      }, options.duration * 1000);
    },
    [stop, finish]
  );

  return { canvasRef, active, start, stop };
}
