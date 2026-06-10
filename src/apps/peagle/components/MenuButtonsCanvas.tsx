"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, forwardRef } from "react";
import { drawPegButton, hitPeg, type PegRect, type PegVariant } from "../renderer/ui/peg-button";

// ─── Boutons du menu principal — RENDUS EN CANVAS ────────────────────────────────
//
// Pendant canvas de l'ancienne pile de `<button className="pg-pm-btn">` du MainMenu.
// Posé en overlay plein écran AU-DESSUS du TitleCanvas (décor/intro), SOUS les dialogs
// DOM (Options, PatchNotes…). Sa propre boucle rAF gère :
//   • le pop d'entrée décalé (spring) au reveal,
//   • le hover/press (hit-test souris → état visuel, comme :hover/:active en CSS),
//   • la secousse d'onde quand un œuf percute le titre (via la ref impérative `knock`).
//
// Le STYLE des boutons vient à 100% de renderer/ui/peg-button.ts (source unique
// partagée avec les inserts du HUD) → coins pixel, bevel, ombre dure, label gravé.

export interface MenuButtonDef {
  label: string;
  variant: PegVariant;
  onClick: () => void;
}

export interface MenuButtonsHandle {
  /** Déclenche l'onde de secousse (force 0..1) — appelée à chaque impact d'œuf sur le titre. */
  knock: (force: number) => void;
}

interface MenuButtonsCanvasProps {
  buttons: MenuButtonDef[];
  /** false tant que l'intro n'a pas révélé le menu → boutons cachés + pop différé. */
  visible: boolean;
  onHover: () => void;
  onClick: () => void;
}

// Géométrie (en px CSS, espace logique du layout — le canvas est en DPR).
const PLAY_W = 200, PLAY_H = 50;       // gros CTA orange
const SEC_W = 200, SEC_H = 40;         // boutons secondaires
const GAP = 8;                         // gouttière entre secondaires
const PLAY_GAP = 14;                   // espace play ↔ groupe secondaire
const BOTTOM_MARGIN = 118;             // marge basse (= le marginBottom CSS du menu)

// Ressort de pop (overshoot juteux, = la courbe --pm-spring du CSS).
const POP_STAGGER = 0.06;              // décalage d'entrée entre boutons (s)

export const MenuButtonsCanvas = forwardRef<MenuButtonsHandle, MenuButtonsCanvasProps>(
  function MenuButtonsCanvas({ buttons, visible, onHover, onClick }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Callbacks/props tenus à jour sans relancer la boucle rAF.
    const buttonsRef = useRef(buttons);
    const visibleRef = useRef(visible);
    const onHoverRef = useRef(onHover);
    const onClickRef = useRef(onClick);
    useLayoutEffect(() => {
      buttonsRef.current = buttons;
      visibleRef.current = visible;
      onHoverRef.current = onHover;
      onClickRef.current = onClick;
    });

    // État d'interaction partagé entre pointer events et la boucle de dessin.
    const hoverIdx = useRef(-1);
    const pressIdx = useRef(-1);
    // Pop d'entrée par bouton : progression 0→1 (animée en idle), démarrée au reveal.
    const popT = useRef<number[]>([]);
    const revealedAt = useRef(-1);
    // Onde de secousse (impact d'œuf) : amplitude décroissante + vitesse de ressort.
    const knockAmp = useRef(0);
    // Rects courants (espace CSS), recalculés chaque frame → lus par le hit-test.
    const rects = useRef<PegRect[]>([]);

    // Secousse impérative exposée au MainMenu (branchée sur onImpact du TitleCanvas).
    useImperativeHandle(ref, () => ({
      knock: (force: number) => { knockAmp.current = Math.min(1, knockAmp.current + force); },
    }), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cv = canvas;                       // alias non-null pour les closures d'events
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let raf = 0;
      let cssW = 0, cssH = 0;
      let prevMs = performance.now();

      function syncSize() {
        const w = Math.max(1, canvas!.clientWidth);
        const h = Math.max(1, canvas!.clientHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
        cssW = w; cssH = h;
        if (canvas!.width !== bw || canvas!.height !== bh) { canvas!.width = bw; canvas!.height = bh; }
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // Recalcule les rects (espace CSS) selon la taille courante. Centrés en X,
      // empilés vers le bas : PLAY en haut, puis les secondaires.
      function layout(): PegRect[] {
        const btns = buttonsRef.current;
        const n = btns.length;
        if (n === 0) return [];
        const secCount = n - 1;                         // tous sauf PLAY
        const totalH = PLAY_H + PLAY_GAP + secCount * SEC_H + (secCount - 1) * GAP;
        const cx = cssW / 2;
        let y = cssH - BOTTOM_MARGIN - totalH;
        const out: PegRect[] = [];
        // PLAY (premier) = gros bouton.
        out.push({ x: Math.round(cx - PLAY_W / 2), y: Math.round(y), w: PLAY_W, h: PLAY_H });
        y += PLAY_H + PLAY_GAP;
        for (let i = 1; i < n; i++) {
          out.push({ x: Math.round(cx - SEC_W / 2), y: Math.round(y), w: SEC_W, h: SEC_H });
          y += SEC_H + GAP;
        }
        return out;
      }

      // Spring ease (overshoot) pour le pop d'entrée.
      const easeOutBack = (p: number) => {
        if (p <= 0) return 0;
        if (p >= 1) return 1;
        const c1 = 1.9, c3 = c1 + 1, x = p - 1;
        return 1 + c3 * x * x * x + c1 * x * x;
      };

      function frame() {
        const now = performance.now();
        const dt = Math.min(0.05, (now - prevMs) / 1000);
        prevMs = now;
        syncSize();
        ctx!.clearRect(0, 0, cssW, cssH);

        const btns = buttonsRef.current;
        const vis = visibleRef.current;
        rects.current = layout();

        // Démarrage du pop au passage visible.
        if (vis && revealedAt.current < 0) {
          revealedAt.current = now;
          popT.current = new Array(btns.length).fill(0);
        }
        if (!vis) { revealedAt.current = -1; raf = requestAnimationFrame(frame); return; }

        // Onde de secousse : décroît exponentiellement.
        knockAmp.current *= Math.pow(0.0015, dt);   // ~retombe en ~0.4s
        if (knockAmp.current < 0.001) knockAmp.current = 0;

        const elapsed = (now - revealedAt.current) / 1000;

        for (let i = 0; i < btns.length; i++) {
          const r = rects.current[i]!;
          const b = btns[i]!;

          // Pop d'entrée décalé : progression spring 0→1.
          const local = Math.max(0, Math.min(1, (elapsed - i * POP_STAGGER) / 0.42));
          const pop = easeOutBack(local);
          popT.current[i] = pop;

          // Secousse d'onde : descend le long de la pile (délai par index).
          const knockPhase = Math.max(0, knockAmp.current - i * 0.06);
          const shakeY = Math.sin(now / 1000 * 38 + i) * knockPhase * 4;

          // Le pop scale depuis le bas-centre (translateY + scale, comme le CSS).
          ctx!.save();
          const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
          ctx!.translate(cx, cy + shakeY + (1 - pop) * 14);
          ctx!.scale(pop, pop);
          ctx!.translate(-cx, -cy);
          ctx!.globalAlpha = Math.max(0, Math.min(1, local * 1.4));

          drawPegButton(ctx!, r, b.label, {
            variant: b.variant,
            hover: hoverIdx.current === i && pressIdx.current === -1,
            pressed: pressIdx.current === i,
            textScale: b.variant === "play" ? 2.6 : 1.7,
            shadowOff: 4,                         // ombre noire portée bien marquée
          });
          ctx!.restore();
        }

        raf = requestAnimationFrame(frame);
      }

      // ─── Pointer events → hover/press + clic ────────────────────────────────────
      const toLocal = (e: PointerEvent) => {
        const rect = cv.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      };
      function onMove(e: PointerEvent) {
        if (!visibleRef.current) { hoverIdx.current = -1; return; }
        const p = toLocal(e);
        const hit = hitPeg(rects.current, p.x, p.y);
        if (hit !== hoverIdx.current) {
          if (hit !== -1) onHoverRef.current();      // front montant → son hover
          hoverIdx.current = hit;
        }
        cv.style.cursor = hit !== -1 ? "pointer" : "default";
      }
      function onDown(e: PointerEvent) {
        if (!visibleRef.current) return;
        const p = toLocal(e);
        const hit = hitPeg(rects.current, p.x, p.y);
        if (hit !== -1) { pressIdx.current = hit; cv.setPointerCapture(e.pointerId); }
      }
      function onUp(e: PointerEvent) {
        const wasPressed = pressIdx.current;
        pressIdx.current = -1;
        if (wasPressed === -1) return;
        const p = toLocal(e);
        const hit = hitPeg(rects.current, p.x, p.y);
        // Clic validé seulement si on relâche SUR le bouton pressé (comme le DOM).
        if (hit === wasPressed) {
          onClickRef.current();
          buttonsRef.current[wasPressed]?.onClick();
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
          zIndex: 2,
          // Cliquable seulement quand le menu est révélé (sinon laisse passer le « skip intro »).
          pointerEvents: visible ? "auto" : "none",
          imageRendering: "pixelated",
        }}
      />
    );
  },
);
