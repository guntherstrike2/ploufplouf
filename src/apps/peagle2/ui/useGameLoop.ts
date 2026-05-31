"use client";

// ─── Peagle — game loop hook (owns the rAF; bridges core ↔ React) ─────────────
// The ONLY place that drives time. Each frame: build an Input, run the pure
// step(), react to events (feel + sound), render, and push a light HUD snapshot
// to React (not every frame — only when HUD-relevant values change).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { FIELD } from "../content/config";
import type { Theme } from "../content/themes";
import type { GameState, Input, Phase } from "../core/types";
import { step } from "../core/step";
import { clampAim } from "../core/systems/aim";
import { drawFrame } from "../render/draw";
import { applyFeel } from "../render/feel";
import { playForEvents, type SfxPlayers } from "../audio/sfx";

export interface HudSnapshot {
  score: number;
  ballsLeft: number;
  orangeLeft: number;
  level: number;
  phase: Phase;
  combo: number;
}

interface Args {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stateRef: MutableRefObject<GameState | null>;
  theme: Theme;
  sfx: SfxPlayers;
  active: boolean; // false on menu/upgrade screens → pause stepping
  onLevelWon: (score: number) => void;
  onGameOver: (score: number) => void;
  onSnapshot: (snap: HudSnapshot) => void;
}

export function useGameLoop({
  canvasRef,
  stateRef,
  theme,
  sfx,
  active,
  onLevelWon,
  onGameOver,
  onSnapshot,
}: Args) {
  const aimAngleRef = useRef(0);
  const shootRef = useRef(false);
  const prevPhaseRef = useRef<Phase>("aim");
  const lastSnapRef = useRef<HudSnapshot | null>(null);
  const lastTimeRef = useRef<number>(0);

  // keep callbacks fresh without restarting the rAF — updated in a layout
  // effect (never during render) so the rAF closure always reads current values
  const cbRef = useRef({ onLevelWon, onGameOver, onSnapshot, sfx, theme, active });
  useLayoutEffect(() => {
    cbRef.current = { onLevelWon, onGameOver, onSnapshot, sfx, theme, active };
  });

  const toInternal = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: FIELD.w / 2, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * FIELD.w,
        y: ((clientY - rect.top) / rect.height) * FIELD.h,
      };
    },
    [canvasRef],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const p = toInternal(e.clientX, e.clientY);
      aimAngleRef.current = clampAim(Math.atan2(p.x - s.launcher.x, p.y - s.launcher.y));
    },
    [stateRef, toInternal],
  );

  const handleClick = useCallback(() => {
    shootRef.current = true;
  }, []);

  useEffect(() => {
    let raf = 0;
    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      const s = stateRef.current;
      const canvas = canvasRef.current;
      if (!s || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // dt in frames (60fps = 1), clamped against tab stalls
      const prev = lastTimeRef.current || time;
      lastTimeRef.current = time;
      const dt = Math.min(2, ((time - prev) / 1000) * 60);

      const { onLevelWon: won, onGameOver: over, onSnapshot: snap, sfx: snd, theme: th, active: on } =
        cbRef.current;

      if (on) {
        const input: Input = shootRef.current
          ? { kind: "shoot" }
          : { kind: "aim", angle: aimAngleRef.current };
        shootRef.current = false;

        const { events } = step(s, input, dt);
        applyFeel(s, events);
        playForEvents(events, snd);

        // phase transitions → fire once
        if (s.phase !== prevPhaseRef.current) {
          if (s.phase === "won") won(s.score);
          else if (s.phase === "lost") over(s.score);
          prevPhaseRef.current = s.phase;
        }

        // HUD snapshot only when something changed
        const cur: HudSnapshot = {
          score: s.score,
          ballsLeft: s.ballsLeft,
          orangeLeft: s.orangeLeft,
          level: s.level,
          phase: s.phase,
          combo: s.combo,
        };
        const last = lastSnapRef.current;
        if (
          !last ||
          last.score !== cur.score ||
          last.ballsLeft !== cur.ballsLeft ||
          last.orangeLeft !== cur.orangeLeft ||
          last.level !== cur.level ||
          last.phase !== cur.phase ||
          last.combo !== cur.combo
        ) {
          lastSnapRef.current = cur;
          snap(cur);
        }
      }

      drawFrame(ctx, s, cbRef.current.theme);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, stateRef]);

  // reset phase tracking when a brand-new game is installed
  const resetTracking = useCallback((phase: Phase) => {
    prevPhaseRef.current = phase;
    lastSnapRef.current = null;
  }, []);

  return { handlePointerMove, handleClick, resetTracking };
}
