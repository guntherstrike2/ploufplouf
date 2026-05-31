"use client";

// ─── Peagle — app entry: screen state machine + wiring ───────────────────────
// Owns the screen flow (menu → game → upgrade → game … → over) and the RunState.
// Contains NO game rules: it creates games from a resolved config, renders the
// canvas, and reacts to core events surfaced by the loop hook.

import { useCallback, useRef, useState } from "react";
import type { AppProps } from "@/types";
import { useSoundContext } from "@/lib/contexts/sound-context";

import { DEFAULT_THEME } from "./content/themes";
import { createGame } from "./core/create";
import type { GameState } from "./core/types";
import { advanceLevel, newRun, resolveConfig, type RunState } from "./rogue/run";
import { generateOffer } from "./rogue/offer";
import type { UpgradeId } from "./rogue/upgrades";

import { GameCanvas } from "./ui/GameCanvas";
import { Hud } from "./ui/Hud";
import { MainMenu } from "./ui/MainMenu";
import { GameOverOverlay, UpgradePicker } from "./ui/UpgradePicker";
import { useGameLoop, type HudSnapshot } from "./ui/useGameLoop";

type Screen = "menu" | "game" | "upgrade" | "over";

const BEST_KEY = "peagle2_best";

function readBest(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
}

export function PeagleApp(_props: AppProps) {
  void _props;
  const sound = useSoundContext();
  const sfx = {
    playClick: sound.playClick,
    playPop: sound.playPop,
    playBip: sound.playBip,
    playVictory: sound.playVictory,
    playDelete: sound.playDelete,
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const runRef = useRef<RunState>(newRun());

  const [screen, setScreen] = useState<Screen>("menu");
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [offer, setOffer] = useState<UpgradeId[]>([]);
  const [best, setBest] = useState<number>(readBest);
  const [finalScore, setFinalScore] = useState(0);

  // ── core callbacks (independent of the loop hook) ────────────────────────
  const handleSnapshot = useCallback((s: HudSnapshot) => {
    setSnap(s);
    setBest((b) => {
      if (s.score <= b) return b;
      if (typeof window !== "undefined") localStorage.setItem(BEST_KEY, String(s.score));
      return s.score;
    });
  }, []);

  const handleLevelWon = useCallback((score: number) => {
    runRef.current = { ...runRef.current, score };
    setOffer(generateOffer(3));
    setScreen("upgrade");
  }, []);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setBest((b) => {
      if (score <= b) return b;
      if (typeof window !== "undefined") localStorage.setItem(BEST_KEY, String(score));
      return score;
    });
    setScreen("over");
  }, []);

  const { handlePointerMove, handleClick, resetTracking } = useGameLoop({
    canvasRef,
    stateRef,
    theme: DEFAULT_THEME,
    sfx,
    active: screen === "game",
    onLevelWon: handleLevelWon,
    onGameOver: handleGameOver,
    onSnapshot: handleSnapshot,
  });

  // ── level lifecycle (uses resetTracking returned by the loop hook) ───────
  const installLevel = useCallback(
    (run: RunState, startScore: number) => {
      stateRef.current = createGame(resolveConfig(run), run.level, startScore);
      resetTracking("aim");
    },
    [resetTracking],
  );

  const startGame = useCallback(() => {
    sound.init();
    runRef.current = newRun();
    installLevel(runRef.current, 0);
    setSnap(null);
    setScreen("game");
  }, [installLevel, sound]);

  const handlePick = useCallback(
    (id: UpgradeId) => {
      const carried = runRef.current.score;
      const next = advanceLevel({ ...runRef.current, upgrades: [...runRef.current.upgrades, id] }, 0);
      runRef.current = next;
      installLevel(next, carried);
      setScreen("game");
    },
    [installLevel],
  );

  if (screen === "menu") {
    return <MainMenu best={best} onPlay={startGame} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--t-bg)" }}>
      {snap && <Hud snap={snap} />}
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
        <GameCanvas ref={canvasRef} onPointerMove={handlePointerMove} onPointerDown={handleClick} />
        {screen === "upgrade" && <UpgradePicker offer={offer} onPick={handlePick} />}
        {screen === "over" && (
          <GameOverOverlay
            score={finalScore}
            best={best}
            onRetry={startGame}
            onMenu={() => setScreen("menu")}
          />
        )}
      </div>
    </div>
  );
}
