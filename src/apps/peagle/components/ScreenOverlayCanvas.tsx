"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  drawBackdrop, drawCardFrame, measureScreen, measureBlock, countButtons,
  drawBubble, drawMascot, drawTitle, drawScore, drawRecord, drawSep, drawTip,
  drawButtons, drawRanking, hitPeg,
  CARD_PAD_Y,
  type ScreenBlock, type ScreenAnim, type ButtonHit,
} from "../renderer/ui/screen";
import type { PegAnim, PegRect } from "../renderer/ui/peg-button";

// ─── Overlay d'écran RENDU EN CANVAS (PAUSE / GAME OVER) ──────────────────────────
//
// Pendant des overlays DOM `.pg-diag-*`. Posé en frère du <canvas> de jeu, dans le
// MÊME wrapper letterboxé (cssSize) → il dessine en px CSS à la taille exacte du jeu,
// pas en coords logiques W×H (sinon flou) ni en pleine zone (sinon débordement).
//
// Structure calquée sur MenuButtonsCanvas : boucle rAF propre, syncSize DPR, refs
// props mises à jour en useLayoutEffect (la boucle ne redémarre jamais), ressorts par
// bouton, anims d'entrée pilotées par `revealedAt`. Le CONTENU vient d'une liste de
// blocs déclaratifs dessinés par renderer/ui/screen.ts.

const GAP = 8;                          // gouttière entre blocs (= BLOCK_GAP de screen.ts)

interface Spring { v: number; vel: number }
const newSpring = (v = 0): Spring => ({ v, vel: 0 });
function stepSpring(s: Spring, target: number, k: number, d: number, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const a = (target - s.v) * k - s.vel * d;
    s.vel += a * h;
    s.v += s.vel * h;
  }
}

const easeOutBack = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const c1 = 1.9, c3 = c1 + 1, x = p - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
};

export interface ScreenOverlayCanvasProps {
  visible: boolean;
  variant: "pause" | "lost";
  blocks: ScreenBlock[];
  cursorTracksMascot?: boolean;
  /** false = overlay dessiné mais NON cliquable (laisse passer les clics vers un
      dialogue DOM posé par-dessus, ex. Options). Défaut true. */
  interactive?: boolean;
  /** Son joué au survol d'un bouton (front montant). */
  onHover?: () => void;
  /** Son joué au clic validé d'un bouton. */
  onClick?: () => void;
}

export function ScreenOverlayCanvas({
  visible, variant, blocks, cursorTracksMascot = false, interactive = true, onHover, onClick,
}: ScreenOverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blocksRef = useRef(blocks);
  const variantRef = useRef(variant);
  const visibleRef = useRef(visible);
  const cursorTracksRef = useRef(cursorTracksMascot);
  const onHoverRef = useRef(onHover);
  const onClickRef = useRef(onClick);
  useLayoutEffect(() => {
    blocksRef.current = blocks;
    variantRef.current = variant;
    visibleRef.current = visible;
    cursorTracksRef.current = cursorTracksMascot;
    onHoverRef.current = onHover;
    onClickRef.current = onClick;
  });

  // Interaction boutons (indices globaux à plat sur tous les blocs `buttons`).
  const hoverIdx = useRef(-1);
  const pressIdx = useRef(-1);
  const liftS = useRef<Spring[]>([]);
  const pressS = useRef<Spring[]>([]);
  const bounce = useRef<Spring[]>([]);
  // Hit-rects + onClick collectés à chaque frame, lus par les pointer events.
  const hits = useRef<ButtonHit[]>([]);
  const revealedAt = useRef(-1);
  // Regard de la mascotte (pause) suivi de la souris.
  const lookRef = useRef(0);
  const targetLookRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cv = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cssW = 0, cssH = 0;
    let prevMs = performance.now();

    function syncSize() {
      const w = Math.max(1, cv.clientWidth);
      const h = Math.max(1, cv.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      cssW = w; cssH = h;
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prevMs) / 1000);
      prevMs = now;
      syncSize();
      ctx!.clearRect(0, 0, cssW, cssH);

      const vis = visibleRef.current;
      if (!vis) { revealedAt.current = -1; raf = requestAnimationFrame(frame); return; }
      if (revealedAt.current < 0) revealedAt.current = now;

      const blks = blocksRef.current;
      const elapsed = (now - revealedAt.current) / 1000;
      const anim: ScreenAnim = { elapsed, now: now / 1000 };

      // Ressorts d'interaction dimensionnés au nb de boutons.
      const nBtn = countButtons(blks);
      if (liftS.current.length !== nBtn) {
        liftS.current = Array.from({ length: nBtn }, () => newSpring());
        pressS.current = Array.from({ length: nBtn }, () => newSpring());
        bounce.current = Array.from({ length: nBtn }, () => newSpring());
      }
      for (let i = 0; i < nBtn; i++) {
        const ls = liftS.current[i]!, ps = pressS.current[i]!, bs = bounce.current[i]!;
        const isHover = hoverIdx.current === i && pressIdx.current === -1;
        const isPress = pressIdx.current === i;
        stepSpring(ls, isHover ? 1 : 0, 560, 20, dt);
        stepSpring(ps, isPress ? 1 : 0, 1400, 52, dt);
        stepSpring(bs, 0, 320, 12, dt);
      }
      const springs: PegAnim[] = [];
      for (let i = 0; i < nBtn; i++) {
        const liftV = Math.max(0, liftS.current[i]!.v);
        const pressV = Math.max(0, Math.min(1, pressS.current[i]!.v));
        const bv = bounce.current[i]!.v;
        springs.push({
          lift: liftV, press: pressV,
          squashX: 1 + pressV * 0.16 - bv * 0.20 + liftV * 0.04,
          squashY: 1 - pressV * 0.20 + bv * 0.28 + liftV * 0.07,
        });
      }

      // Regard mascotte (lissé).
      lookRef.current += (targetLookRef.current - lookRef.current) * 0.18;

      // Backdrop (fade-in court).
      drawBackdrop(ctx!, cssW, cssH, variantRef.current, Math.min(1, elapsed / 0.2));

      // Mesure → carte centrée.
      const cardW = Math.min(320, Math.round(cssW * 0.92));
      const innerH = measureScreen(blks, cardW);
      const cardH = innerH + CARD_PAD_Y * 2;
      const cardX = Math.round((cssW - cardW) / 2);
      // centré verticalement, clampé en haut si trop grand (pas de scroll canvas).
      let cardY = Math.round((cssH - cardH) / 2);
      if (cardY < 4) cardY = 4;

      // Pop d'entrée (spring) autour du centre de la carte.
      const pop = easeOutBack(Math.min(1, elapsed / 0.42));
      ctx!.save();
      const ccx = cardX + cardW / 2, ccy = cardY + cardH / 2;
      ctx!.translate(ccx, ccy);
      ctx!.scale(pop, pop);
      ctx!.translate(-ccx, -ccy);

      drawCardFrame(ctx!, cardX, cardY, cardW, cardH);

      // Dessin des blocs, top-down. Collecte des hit-rects.
      hits.current = [];
      let btnBase = 0;
      let y = cardY + CARD_PAD_Y;
      for (let i = 0; i < blks.length; i++) {
        const b = blks[i]!;
        const bh = measureBlock(b, cardW);
        if (bh <= 0) continue;
        if (i > 0) y += GAP;
        switch (b.kind) {
          case "bubble": drawBubble(ctx!, b.text, cardX, y, cardW); break;
          case "mascot": drawMascot(ctx!, b.spec, cardX, y, cardW, anim, lookRef.current); break;
          case "title":  drawTitle(ctx!, b.text, b.glow, cardX, y, cardW, anim); break;
          case "score":  drawScore(ctx!, b.label, b.value, cardX, y, cardW); break;
          case "record": drawRecord(ctx!, b.text, cardX, y, cardW, anim); break;
          case "ranking": drawRanking(ctx!, b.model, cardX, y, cardW); break;
          case "sep":    drawSep(ctx!, cardX, y, cardW); break;
          case "tip":    drawTip(ctx!, b.label, b.text, !!b.go, cardX, y, cardW); break;
          case "buttons":
            drawButtons(ctx!, b.items, b.caption, cardX, y, cardW, anim,
              springs, btnBase, hits.current);
            btnBase += b.items.length;
            break;
        }
        y += bh;
      }
      ctx!.restore();

      // Les hit-rects sont en espace carte AVANT le pop scale ; le pop tend vers 1
      // (overshoot bref) → on hit-test sur les rects non-scalés, OK une fois posé.
      raf = requestAnimationFrame(frame);
    }

    // ── Pointer ────────────────────────────────────────────────────────────────
    const toLocal = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hitIndex = (px: number, py: number) =>
      hitPeg(hits.current.map((h) => h.rect) as PegRect[], px, py);

    function onMove(e: PointerEvent) {
      if (!visibleRef.current) { hoverIdx.current = -1; return; }
      const p = toLocal(e);
      // regard mascotte (uniquement si l'écran le demande — la pause)
      if (cursorTracksRef.current) {
        const rect = cv.getBoundingClientRect();
        targetLookRef.current = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / 120));
      }
      const hit = hitIndex(p.x, p.y);
      if (hit !== hoverIdx.current) {
        if (hit !== -1) onHoverRef.current?.();
        hoverIdx.current = hit;
      }
      cv.style.cursor = hit !== -1 ? "pointer" : "default";
    }
    function onDown(e: PointerEvent) {
      if (!visibleRef.current) return;
      const p = toLocal(e);
      const hit = hitIndex(p.x, p.y);
      if (hit !== -1) { pressIdx.current = hit; cv.setPointerCapture(e.pointerId); }
    }
    function onUp(e: PointerEvent) {
      const was = pressIdx.current;
      pressIdx.current = -1;
      if (was === -1) return;
      const p = toLocal(e);
      const hit = hitIndex(p.x, p.y);
      if (hit === was) {
        const bs = bounce.current[was];
        if (bs) bs.vel += 16;
        onClickRef.current?.();
        hits.current[was]?.onClick();
      }
    }
    function onLeave() { hoverIdx.current = -1; cv.style.cursor = "default"; }

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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 6,
        pointerEvents: visible && interactive ? "auto" : "none",
        imageRendering: "pixelated",
      }}
    />
  );
}
