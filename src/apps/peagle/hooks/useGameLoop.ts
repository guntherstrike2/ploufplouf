"use client";

import { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import type { RefObject } from "react";
import { usePeagleSounds } from "./usePeagleSounds";
import { drawFrame } from "../renderer";
import { PAUSE_HIT } from "../renderer/hud";
import { resolveTheme, invalidateTheme } from "../engine/game-theme";
import { tick } from "../engine/state/tick";
import { makeInitialState } from "../engine/state/init";
import { refreshAssetCache, ASSETS_CHANGED_EVENT } from "../engine/assets";
import { W, H, LAUNCHER_Y, LAUNCH_SPEED, LAUNCHER_MARGIN, LAUNCHER_GRAB_R } from "../engine/constants";
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
  pausedRef: RefObject<boolean>;
  onUiSync: (ui: UiState) => void;
  onOrangeTotalChange: (total: number) => void;
  onBestScore: (score: number) => void;
  onScoreSubmit: (score: number, won: boolean) => void;
  onLevelWon: () => void;
  onRequestPause: () => void;
}

function clampAngle(angle: number): number {
  return Math.max(0.15, Math.min(Math.PI - 0.15, angle));
}

function clampLauncherX(x: number): number {
  return Math.max(LAUNCHER_MARGIN, Math.min(W - LAUNCHER_MARGIN, x));
}

// Petite gerbe de plumes au point (x, y) — feedback juicy de saisie / lâcher.
function spawnFeathers(s: GameState, x: number, y: number, n: number): void {
  const colors = ["#f5f3ec", "#e8e2d0", "#a06a34", "#7a4a22"];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.5 + Math.random() * 1.9;
    s.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 0.6,
      life: 1,
      maxLife: 0.7 + Math.random() * 0.5,
      color: colors[(Math.random() * colors.length) | 0]!,
      size: 1.5 + Math.random() * 1.6,
    });
  }
}

export function useGameLoop({
  canvasRef,
  mouseRef,
  runStateRef,
  devConfigRef,
  pausedRef,
  onUiSync,
  onOrangeTotalChange,
  onBestScore,
  onScoreSubmit,
  onLevelWon,
  onRequestPause,
}: UseGameLoopOptions) {
  // eslint-disable-next-line react-hooks/refs -- stateRef n'est initialisé qu'une fois au montage
  const stateRef = useRef<GameState>(makeInitialState(1, runStateRef.current, false, 0));
  const animRef = useRef<number>(0);
  const orangeTotalRef = useRef(0);

  // Refs stables pour les callbacks — mutées en useLayoutEffect pour rester à jour
  const onScoreSubmitRef = useRef(onScoreSubmit);
  const onLevelWonRef = useRef(onLevelWon);
  const onRequestPauseRef = useRef(onRequestPause);
  useLayoutEffect(() => {
    onScoreSubmitRef.current = onScoreSubmit;
    onLevelWonRef.current = onLevelWon;
    onRequestPauseRef.current = onRequestPause;
  });

  const {
    playPegHit, playOrangePegHit, playBumperHit,
    playWallBounce, playBucketCatch, playJackpot,
    playLevelClear, playPegClear, playGameOver,
    playGrab,
  } = usePeagleSounds();

  const handleEvent = useCallback((ev: GameEvent) => {
    switch (ev.kind) {
      case "sound": {
        const combo = stateRef.current.combo;
        const x     = ev.x;
        switch (ev.id) {
          case "peg-hit":     playPegHit(combo, x); break;
          case "orange-hit":  playOrangePegHit(combo, x); break;
          case "bumper-hit":  playBumperHit(); break;
          case "wall-bounce": playWallBounce(); break;
          case "victory":     playBucketCatch(); break;
          case "jackpot":     playJackpot(); break;
          case "level-clear": playLevelClear(); break;
          case "peg-clear":   playPegClear(); break;
          case "game-over":   playGameOver(); break;
          // legacy fallbacks
          case "pop":   playPegClear(); break;
          case "bip":   playWallBounce(); break;
          case "delete": playGameOver(); break;
        }
        break;
      }
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
  }, [
    playPegHit, playOrangePegHit, playBumperHit,
    playWallBounce, playBucketCatch, playJackpot,
    playLevelClear, playPegClear, playGameOver,
    onBestScore,
  ]);

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
    const s = stateRef.current;
    const dx = mouseRef.current.x - s.launcherX;
    const dy = mouseRef.current.y - LAUNCHER_Y;
    return clampAngle(Math.atan2(dy, dx));
  }

  const fireBallAtClientPos = useCallback((rect: DOMRect, clientX: number, clientY: number) => {
    const s = stateRef.current;
    if (s.phase !== "aim" || s.ball) return;

    const mx = (clientX - rect.left) * (W / rect.width);
    const my = (clientY - rect.top) * (H / rect.height);
    const angle = clampAngle(Math.atan2(my - LAUNCHER_Y, mx - s.launcherX));

    s.ball = { x: s.launcherX, y: LAUNCHER_Y, vx: Math.cos(angle) * LAUNCH_SPEED, vy: Math.sin(angle) * LAUNCH_SPEED, active: true, trail: [], trailHead: 0, squash: 0 };
    s.balls -= 1;
    s.turnScoreStart = s.score;
    s.phase = "firing";
    syncUI();
  }, [syncUI]);

  // ── Entrée pointeur unifiée (souris + tactile + stylet) ──────────────────────
  // Saisir l'aigle (zone autour du lanceur) → drag horizontal. Cliquer ailleurs
  // dans la zone de jeu → tirer.
  const draggingRef = useRef(false);
  const grabOffsetRef = useRef(0);
  const pressFireRef = useRef(false);

  const toCanvas = (rect: DOMRect, clientX: number, clientY: number) => ({
    x: (clientX - rect.left) * (W / rect.width),
    y: (clientY - rect.top) * (H / rect.height),
  });

  const handlePointerDown = useCallback((e: {
    currentTarget: { getBoundingClientRect(): DOMRect; setPointerCapture?: (id: number) => void };
    clientX: number; clientY: number; pointerId: number; preventDefault?: () => void;
  }) => {
    e.preventDefault?.();
    const rect = e.currentTarget.getBoundingClientRect();
    const p = toCanvas(rect, e.clientX, e.clientY);
    const s = stateRef.current;

    // Bouton pause taillé dans l'enseigne HUD (dessiné en canvas) → hit-test
    if (
      (s.phase === "aim" || s.phase === "firing") &&
      p.x >= PAUSE_HIT.x && p.x <= PAUSE_HIT.x + PAUSE_HIT.w &&
      p.y >= PAUSE_HIT.y && p.y <= PAUSE_HIT.y + PAUSE_HIT.h
    ) {
      onRequestPauseRef.current();
      return;
    }

    if (s.phase === "aim" && !s.ball) {
      const dx = p.x - s.launcherX, dy = p.y - LAUNCHER_Y;
      if (dx * dx + dy * dy <= LAUNCHER_GRAB_R * LAUNCHER_GRAB_R) {
        // Saisie de l'aigle → mode drag
        draggingRef.current = true;
        grabOffsetRef.current = s.launcherX - p.x;
        s.launcherDragging = true;
        spawnFeathers(s, s.launcherX, LAUNCHER_Y + 6, 6);
        playGrab();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        return;
      }
    }
    // Sinon : pression dans la zone de jeu → tir au relâchement
    pressFireRef.current = true;
    mouseRef.current = p;
  }, [mouseRef]);

  const handlePointerMove = useCallback((e: {
    currentTarget: { getBoundingClientRect(): DOMRect }; clientX: number; clientY: number;
  }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = toCanvas(rect, e.clientX, e.clientY);
    if (draggingRef.current) {
      stateRef.current.launcherTargetX = clampLauncherX(p.x + grabOffsetRef.current);
    } else {
      mouseRef.current = p;
    }
  }, [mouseRef]);

  const handlePointerUp = useCallback((e: {
    currentTarget: { getBoundingClientRect(): DOMRect; releasePointerCapture?: (id: number) => void };
    clientX: number; clientY: number; pointerId: number;
  }) => {
    if (draggingRef.current) {
      draggingRef.current = false;
      const s = stateRef.current;
      s.launcherDragging = false;
      s.launcherTargetX = clampLauncherX(s.launcherTargetX);
      spawnFeathers(s, s.launcherX, LAUNCHER_Y + 6, 4);
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      pressFireRef.current = false;
      return;
    }
    if (pressFireRef.current) {
      pressFireRef.current = false;
      fireBallAtClientPos(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
    }
  }, [fireBallAtClientPos]);

  // Sync UI initiale
  useEffect(() => {
    orangeTotalRef.current = stateRef.current.pegs.filter(p => isTarget(p)).length;
    onOrangeTotalChange(orangeTotalRef.current);
    syncUI();
  }, [syncUI, onOrangeTotalChange]);

  // Sync des assets : recharge le choix de la Galerie (autre fenêtre) en live.
  // On recharge le cache d'assets ET on invalide le thème mémoïsé (dérivé de ces
  // assets) pour que le prochain resolveTheme() le recompose.
  useEffect(() => {
    const onAssetsChanged = () => { refreshAssetCache(); invalidateTheme(); };
    onAssetsChanged();
    window.addEventListener(ASSETS_CHANGED_EVENT, onAssetsChanged);
    return () => window.removeEventListener(ASSETS_CHANGED_EVENT, onAssetsChanged);
  }, []);

  // Boucle rAF
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function frame() {
      const s = stateRef.current;

      // Pause : on gèle la simulation mais on continue de rendre la frame courante
      // (le plateau reste visible derrière le menu de pause).
      if (pausedRef.current) {
        const ol = s.pegs.reduce((n, p) => n + (isTarget(p) && !p.hit ? 1 : 0), 0);
        drawFrame(ctx, s, getAngle(), ol, {
          theme: resolveTheme(),
          showHitboxes: devConfigRef.current?.showHitboxes ?? false,
          orangeTotal: orangeTotalRef.current,
        });
        animRef.current = requestAnimationFrame(frame);
        return;
      }

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
        orangeTotal: orangeTotalRef.current,
      });

      // Curseur dynamique : main ouverte au survol de l'aigle, main fermée pendant
      // le drag → on comprend qu'on peut l'attraper et le déplacer.
      const mp = mouseRef.current;
      const dgx = mp.x - s.launcherX, dgy = mp.y - LAUNCHER_Y;
      const overBird = s.phase === "aim" && !s.ball &&
        dgx * dgx + dgy * dgy <= LAUNCHER_GRAB_R * LAUNCHER_GRAB_R;
      s.launcherHovered = overBird;
      canvas!.style.cursor = s.launcherDragging
        ? "grabbing"
        : overBird
          ? "grab"
          : s.phase === "aim"
            ? "crosshair"
            : "default";

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleEvent, syncUI]);

  return { stateRef, handlePointerDown, handlePointerMove, handlePointerUp, resetGame, nextLevel, skipLevel };
}
