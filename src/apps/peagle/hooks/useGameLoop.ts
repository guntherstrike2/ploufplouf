"use client";

import { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import type { RefObject } from "react";
import { useSoundContext } from "@/lib/contexts/sound-context";
import { drawFrame } from "../renderer";
import { resolveTheme } from "../engine/game-theme";
import { tick } from "../engine/state/tick";
import { makeInitialState } from "../engine/state/init";
import { refreshAssetCache, ASSETS_CHANGED_EVENT } from "../engine/assets";
import { W, H, LAUNCHER_X, LAUNCHER_Y, LAUNCH_SPEED } from "../engine/constants";
import { isTarget } from "../engine/peg-kinds";
import type { GameState, UiState } from "../engine/types";
import type { RunState } from "../engine/roguelite";
import type { GameEvent } from "../engine/events";
import type { DevConfig } from "../components/DevPanel";

interface UseGameLoopOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mouseRef: RefObject<{ x: number; y: number }>;
  runStateRef: RefObject<RunState>;
  devConfigRef: RefObject<DevConfig | null>;
  onUiSync: (ui: UiState) => void;
  onOrangeTotalChange: (total: number) => void;
  onBestScore: (score: number) => void;
  onScoreSubmit: (score: number, won: boolean) => void;
  onLevelWon: () => void;
}

function clampAngle(angle: number): number {
  return Math.max(0.15, Math.min(Math.PI - 0.15, angle));
}

export function useGameLoop({
  canvasRef,
  mouseRef,
  runStateRef,
  devConfigRef,
  onUiSync,
  onOrangeTotalChange,
  onBestScore,
  onScoreSubmit,
  onLevelWon,
}: UseGameLoopOptions) {
  // eslint-disable-next-line react-hooks/refs -- stateRef n'est initialisé qu'une fois au montage
  const stateRef = useRef<GameState>(makeInitialState(1, runStateRef.current, false, 0));
  const animRef = useRef<number>(0);
  const orangeTotalRef = useRef(0);

  // Refs stables pour les callbacks — mutées en useLayoutEffect pour rester à jour
  const onScoreSubmitRef = useRef(onScoreSubmit);
  const onLevelWonRef = useRef(onLevelWon);
  useLayoutEffect(() => {
    onScoreSubmitRef.current = onScoreSubmit;
    onLevelWonRef.current = onLevelWon;
  });

  const { playPop, playBip, playVictory, playDelete } = useSoundContext();

  const handleEvent = useCallback((ev: GameEvent) => {
    switch (ev.kind) {
      case "sound":
        if (ev.id === "pop") playPop();
        else if (ev.id === "bip") playBip();
        else if (ev.id === "victory") playVictory();
        else if (ev.id === "delete") playDelete();
        break;
      case "level-won":
        onLevelWonRef.current();
        break;
      case "level-lost":
        onScoreSubmitRef.current(ev.score, false);
        break;
      case "best-score":
        onBestScore(ev.score);
        break;
      case "score-submit":
        onScoreSubmitRef.current(ev.score, ev.won);
        break;
    }
  }, [playPop, playBip, playVictory, playDelete, onBestScore]);

  const syncUI = useCallback((orangeLeft?: number) => {
    const s = stateRef.current;
    const ol = orangeLeft ?? s.pegs.filter(p => isTarget(p) && !p.hit).length;
    onUiSync({
      balls: s.balls,
      score: s.score,
      orangeLeft: ol,
      orangeTotal: orangeTotalRef.current,
      phase: s.phase,
      message: s.message,
      combo: s.combo,
      level: s.level,
      stars: Math.floor(s.score / 10000),
    });
  }, [onUiSync]);

  const resetGame = useCallback((keepLevel = false, overrideLevel?: number) => {
    const s = stateRef.current;
    const targetLevel = overrideLevel ?? (keepLevel ? s.level : 1);
    const newState = makeInitialState(targetLevel, runStateRef.current, keepLevel && !overrideLevel, s.score);

    // Overrides dev (admins uniquement)
    const dev = devConfigRef.current;
    if (dev) {
      if (dev.godMode) newState.balls = 9999;
      if (dev.orangePct !== null) {
        const pct = dev.orangePct / 100;
        // On ne touche pas aux bumpers (obstacles) : on bascule normal ↔ orange.
        const swappable = newState.pegs.filter(p => p.kind !== "bumper");
        for (const p of swappable) p.kind = "normal";
        const count = Math.max(1, Math.round(swappable.length * pct));
        const order = [...swappable.keys()].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(count, order.length); i++) swappable[order[i]!]!.kind = "orange";
        newState.orangeLeft = newState.pegs.filter(isTarget).length;
      }
    }

    orangeTotalRef.current = newState.pegs.filter(isTarget).length;
    onOrangeTotalChange(orangeTotalRef.current);
    stateRef.current = newState;
    syncUI();
  }, [syncUI, onOrangeTotalChange, runStateRef, devConfigRef]);

  const nextLevel = useCallback(() => {
    stateRef.current.level += 1;
    resetGame(true);
  }, [resetGame]);

  const skipLevel = useCallback(() => {
    stateRef.current.level += 1;
    resetGame(true);
  }, [resetGame]);

  function getAngle() {
    const dx = mouseRef.current.x - LAUNCHER_X;
    const dy = mouseRef.current.y - LAUNCHER_Y;
    return clampAngle(Math.atan2(dy, dx));
  }

  const fireBallAtClientPos = useCallback((rect: DOMRect, clientX: number, clientY: number) => {
    const s = stateRef.current;
    if (s.phase !== "aim" || s.ball) return;

    const mx = (clientX - rect.left) * (W / rect.width);
    const my = (clientY - rect.top) * (H / rect.height);
    const angle = clampAngle(Math.atan2(my - LAUNCHER_Y, mx - LAUNCHER_X));

    s.ball = { x: LAUNCHER_X, y: LAUNCHER_Y, vx: Math.cos(angle) * LAUNCH_SPEED, vy: Math.sin(angle) * LAUNCH_SPEED, active: true, trail: [], trailHead: 0 };
    s.balls -= 1;
    s.turnScoreStart = s.score;
    s.phase = "firing";
    syncUI();
  }, [syncUI]);

  const handleClick = useCallback((e: { currentTarget: { getBoundingClientRect(): DOMRect }; clientX: number; clientY: number }) => {
    fireBallAtClientPos(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  }, [fireBallAtClientPos]);

  // Support tactile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateAimFromTouch = (t: Touch) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (t.clientX - rect.left) * (W / rect.width),
        y: (t.clientY - rect.top) * (H / rect.height),
      };
    };

    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; if (t) updateAimFromTouch(t); };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; if (t) updateAimFromTouch(t); };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (!t) return;
      updateAimFromTouch(t);
      fireBallAtClientPos(canvas.getBoundingClientRect(), t.clientX, t.clientY);
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [fireBallAtClientPos, mouseRef, canvasRef]);

  // Sync UI initiale
  useEffect(() => {
    orangeTotalRef.current = stateRef.current.pegs.filter(isTarget).length;
    onOrangeTotalChange(orangeTotalRef.current);
    syncUI();
  }, [syncUI, onOrangeTotalChange]);

  // Sync des assets : recharge le choix de la Galerie (autre fenêtre) en live
  useEffect(() => {
    refreshAssetCache();
    window.addEventListener(ASSETS_CHANGED_EVENT, refreshAssetCache);
    return () => window.removeEventListener(ASSETS_CHANGED_EVENT, refreshAssetCache);
  }, []);

  // Boucle rAF
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function frame() {
      const s = stateRef.current;

      // God mode : recharge les œufs chaque frame pour qu'ils n'atteignent jamais 0
      if (devConfigRef.current?.godMode && s.phase !== "won" && s.phase !== "lost") {
        if (s.balls < 99) s.balls = 99;
      }

      const { events, syncUI: shouldSync, orangeLeft } = tick(s);

      for (const ev of events) handleEvent(ev);
      if (shouldSync) syncUI(orangeLeft);

      drawFrame(ctx, stateRef.current, getAngle(), orangeLeft, {
        theme: resolveTheme(),
        showHitboxes: devConfigRef.current?.showHitboxes ?? false,
      });
      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleEvent, syncUI]);

  return { stateRef, handleClick, resetGame, nextLevel, skipLevel };
}
