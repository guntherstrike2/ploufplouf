"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { drawPegButton, hitPeg, type PegRect } from "../renderer/ui/peg-button";

// ─── Bouton SKIP de l'upgrade picker, RENDU EN CANVAS ─────────────────────────────
//
// Pendant canvas du `<PegBtn variant="ghost" warn>SKIP</PegBtn>`. Mini-canvas autonome
// (sa propre boucle rAF) posé dans le flux DOM de la carte d'upgrade, à la place du
// bouton. Les cartes d'upgrade voisines (.pg-upg-cardbtn) restent DOM — mélange assumé.
// Réutilise drawPegButton/hitPeg (source unique) + un ressort hover/press juteux.

interface Spring { v: number; vel: number }
const newSpring = (): Spring => ({ v: 0, vel: 0 });
function stepSpring(s: Spring, target: number, k: number, d: number, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const a = (target - s.v) * k - s.vel * d;
    s.vel += a * h; s.v += s.vel * h;
  }
}

interface SkipButtonCanvasProps {
  width?: number;
  height?: number;
  onHover?: () => void;
  onClick: () => void;
}

export function SkipButtonCanvas({ width = 120, height = 32, onHover, onClick }: SkipButtonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onHoverRef = useRef(onHover);
  const onClickRef = useRef(onClick);
  useLayoutEffect(() => { onHoverRef.current = onHover; onClickRef.current = onClick; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cv = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let prevMs = performance.now();
    const lift = newSpring(), press = newSpring(), bounce = newSpring();
    let hover = false, pressing = false;
    let rect: PegRect = { x: 0, y: 0, w: width, h: height };

    function syncSize() {
      const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      rect = { x: 0, y: 0, w, h };
    }

    function frame() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prevMs) / 1000);
      prevMs = now;
      syncSize();
      ctx!.clearRect(0, 0, rect.w, rect.h);
      stepSpring(lift, hover && !pressing ? 1 : 0, 560, 20, dt);
      stepSpring(press, pressing ? 1 : 0, 1400, 52, dt);
      stepSpring(bounce, 0, 320, 12, dt);
      const liftV = Math.max(0, lift.v), pressV = Math.max(0, Math.min(1, press.v));
      drawPegButton(ctx!, rect, "SKIP", {
        variant: "ghost",
        anim: {
          lift: liftV, press: pressV,
          squashX: 1 + pressV * 0.16 - bounce.v * 0.2 + liftV * 0.04,
          squashY: 1 - pressV * 0.2 + bounce.v * 0.28 + liftV * 0.07,
        },
        textScale: 1.4,
      });
      raf = requestAnimationFrame(frame);
    }

    const toLocal = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    function onMove(e: PointerEvent) {
      const p = toLocal(e);
      const h = hitPeg([rect], p.x, p.y) !== -1;
      if (h && !hover) onHoverRef.current?.();
      hover = h;
      cv.style.cursor = h ? "pointer" : "default";
    }
    function onDown(e: PointerEvent) {
      const p = toLocal(e);
      if (hitPeg([rect], p.x, p.y) !== -1) { pressing = true; cv.setPointerCapture(e.pointerId); }
    }
    function onUp(e: PointerEvent) {
      if (!pressing) return;
      pressing = false;
      const p = toLocal(e);
      if (hitPeg([rect], p.x, p.y) !== -1) { bounce.vel += 16; onClickRef.current(); }
    }
    function onLeave() { hover = false; cv.style.cursor = "default"; }

    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width, height, alignSelf: "center", marginTop: 4,
        imageRendering: "pixelated", display: "block",
      }}
    />
  );
}
