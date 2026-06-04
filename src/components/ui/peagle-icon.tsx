"use client";

import { useEffect, useRef } from "react";
import { eagleFace } from "@/apps/peagle/renderer/face";

// Renders the Peagle eagle face pixel art at any icon size.
// Face natural box: 28×32px centered at (0,0) — scale to fit.
export function PeagleIcon({ size }: { size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scale = size / 32;
    ctx.translate(size / 2, size / 2);
    ctx.scale(scale, scale);

    eagleFace(ctx, 0, 0, {
      blink: "none",
      open: 0,
      brow: "flat",
      eyeRed: false,
      wide: false,
      look: 0,
      pop: 0,
      starEyes: false,
      tears: false,
      drowsyEyes: false,
    });
  }, [size]);

  return (
    <canvas
      ref={ref}
      style={{ display: "block", imageRendering: "pixelated" }}
    />
  );
}
