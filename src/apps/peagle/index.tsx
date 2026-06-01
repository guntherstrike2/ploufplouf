"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { AppProps } from "@/types";
import { useAuth } from "@/lib/contexts/auth-context";
import { useMusic } from "./hooks/useMusic";
import { useGameLoop } from "./hooks/useGameLoop";
import { GameCanvas } from "./components/GameCanvas";
import { Leaderboard } from "./components/Leaderboard";
import { MainMenu } from "./components/MainMenu";
import { UpgradePicker } from "./components/UpgradePicker";
import { SidePanel } from "./components/SidePanel";
import { DevPanel } from "./components/DevPanel";
import type { DevConfig } from "./components/DevPanel";
import { W } from "./engine/constants";
import type { UiState, LeaderboardEntry, UpgradeId } from "./engine/types";
import type { RunState } from "./engine/roguelite";
import { makeInitialRunState, generateUpgradeOffer } from "./engine/roguelite";

type Screen = "menu" | "game" | "leaderboard";

const EMPTY_RUN: RunState = makeInitialRunState();

export function PeagleApp({ windowId: _windowId }: AppProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: W / 2, y: 0 });
  const runStateRef = useRef<RunState>(EMPTY_RUN);
  const devConfigRef = useRef<DevConfig | null>(null);
  const [devSessionActive, setDevSessionActive] = useState(false);
  const [showDevPanelInGame, setShowDevPanelInGame] = useState(false);

  const [screen, setScreen] = useState<Screen>("menu");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  const [ui, setUi] = useState<UiState>({
    balls: 12, score: 0, orangeLeft: 0, orangeTotal: 0,
    phase: "aim", message: "", combo: 0, level: 1, stars: 0,
  });
  const [bestScore, setBestScore] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("peagle98_best") ?? "0", 10);
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  // Offre d'upgrade entre deux niveaux
  const [upgradeOffer, setUpgradeOffer] = useState<UpgradeId[] | null>(null);

  // ── Screen transition overlay (simple CSS transition, pas de keyframes) ──
  const [overlayOpaque, setOverlayOpaque] = useState(false);
  // Indique si l'utilisateur a déjà vu l'intro → au retour menu on la skippe.
  const [hasSeenIntro, setHasSeenIntro] = useState(false);

  const transitionTo = useCallback((target: Screen, setup?: () => void) => {
    setOverlayOpaque(true);
    setTimeout(() => {
      setup?.();
      setScreen(target);
      // Double rAF : attend que React ait rendu le nouvel écran avant de révéler
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setOverlayOpaque(false);
      }));
    }, 200);
  }, []);

  const userId = user?.id;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!userId) { setIsAdmin(false); return; }
    fetch("/api/admin/check")
      .then(r => r.json())
      .then((d: { isAdmin: boolean }) => setIsAdmin(d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [userId]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const fetchLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const res = await fetch("/api/peagle/scores");
      const data = await res.json() as LeaderboardEntry[];
      setLeaderboard(data);
    } catch { /* silent */ }
    finally { setLbLoading(false); }
  }, []);

  const submitScore = useCallback(async (score: number, won: boolean) => {
    if (!user || scoreSubmitted) return;
    setScoreSubmitted(true);
    try {
      await fetch("/api/peagle/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, won }),
      });
    } catch { /* silent */ }
  }, [user, scoreSubmitted]);

  const handleLevelWon = useCallback(() => {
    setUpgradeOffer(generateUpgradeOffer(runStateRef.current.upgrades));
  }, []);

  const recordBestScore = useCallback((score: number) => {
    setBestScore(prev => {
      if (score <= prev) return prev;
      try { localStorage.setItem("peagle98_best", String(score)); } catch { /* quota / private mode */ }
      return score;
    });
  }, []);

  const { musicMuted, toggleMusic } = useMusic();

  const handleUiSync = useCallback((uiState: UiState) => setUi(uiState), []);
  const handleOrangeTotalChange = useCallback((total: number) => setUi(u => ({ ...u, orangeTotal: total })), []);

  const { handlePointerDown, handlePointerMove, handlePointerUp, resetGame, nextLevel, skipLevel } = useGameLoop({
    canvasRef,
    mouseRef,
    runStateRef,
    devConfigRef,
    pausedRef,
    onUiSync: handleUiSync,
    onOrangeTotalChange: handleOrangeTotalChange,
    onBestScore: recordBestScore,
    onScoreSubmit: submitScore,
    onLevelWon: handleLevelWon,
    onRequestPause: () => setPaused(true),
  });

  const handleUpgradePick = useCallback((id: UpgradeId) => {
    runStateRef.current = { ...runStateRef.current, upgrades: [...runStateRef.current.upgrades, id] };
    setUpgradeOffer(null);
    nextLevel();
  }, [nextLevel]);

  const handleUpgradeSkip = useCallback(() => {
    setUpgradeOffer(null);
    nextLevel();
  }, [nextLevel]);

  const startRun = useCallback(() => {
    setHasSeenIntro(true);
    devConfigRef.current = null;
    setDevSessionActive(false);
    runStateRef.current = makeInitialRunState();
    resetGame(false);
    setScoreSubmitted(false);
    setUpgradeOffer(null);
    setPaused(false);
    transitionTo("game");
  }, [resetGame, transitionTo]);

  const handleDevLaunch = useCallback((cfg: DevConfig) => {
    setHasSeenIntro(true);
    devConfigRef.current = cfg;
    runStateRef.current = { ...makeInitialRunState(), upgrades: cfg.upgrades };
    resetGame(false, cfg.startLevel);
    setScoreSubmitted(false);
    setUpgradeOffer(null);
    setDevSessionActive(true);
    setShowDevPanelInGame(false);
    setPaused(false);
    transitionTo("game");
  }, [resetGame, transitionTo]);

  const handleGoToMenu = useCallback(() => {
    transitionTo("menu", () => {
      setUpgradeOffer(null);
      setPaused(false);
    });
  }, [transitionTo]);

  const handleGoToLeaderboard = useCallback(() => {
    setHasSeenIntro(true);
    transitionTo("leaderboard", () => {
      setPaused(false);
      fetchLeaderboard();
    });
  }, [transitionTo, fetchLeaderboard]);

  const handleReplay = useCallback(() => {
    runStateRef.current = makeInitialRunState();
    resetGame(false);
    setScoreSubmitted(false);
    setUpgradeOffer(null);
    setPaused(false);
  }, [resetGame]);

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ background: "var(--t-bg)", fontFamily: "var(--t-font-display)", position: "relative" }}
    >
      {screen === "menu" && (
        <MainMenu
          isAdmin={isAdmin}
          onPlay={startRun}
          onLeaderboard={handleGoToLeaderboard}
          onDevLaunch={handleDevLaunch}
          musicMuted={musicMuted}
          onToggleMusic={toggleMusic}
          skipIntro={hasSeenIntro}
        />
      )}

      {screen === "leaderboard" && (
        <Leaderboard
          entries={leaderboard}
          loading={lbLoading}
          currentUserId={user?.id}
          onRefresh={fetchLeaderboard}
          showLoginHint={!user}
          onBack={handleGoToMenu}
        />
      )}

      {/* Écran de jeu — le canvas reste monté pour garder la boucle vivante */}
      <div
        style={{
          display: screen === "game" ? "flex" : "none",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
          background: "linear-gradient(to bottom, #122010 0%, #0a1806 50%, #060e04 100%)",
        }}
      >
        {showDevPanelInGame && (
          <DevPanel
            onClose={() => setShowDevPanelInGame(false)}
            onLaunch={handleDevLaunch}
          />
        )}

        {/* Layout responsive : vertical (mobile) ou horizontal (16/9+) */}
        <div className="pg-game-layout peagle-root" style={{ flex: 1, overflow: "hidden", alignItems: "stretch" }}>
          <SidePanel side="left" feverMode={ui.orangeLeft > 0 && ui.orangeLeft <= 3} />

          <div className="pg-canvas-area">
            <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <GameCanvas
                canvasRef={canvasRef}
                ui={ui}
                bestScore={bestScore}
                user={user}
                isAdmin={isAdmin}
                showDevTools={isAdmin && devSessionActive}
                upgradeOfferPending={!!upgradeOffer}
                paused={paused}
                musicMuted={musicMuted}
                onResume={() => setPaused(false)}
                onToggleMusic={toggleMusic}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onReplay={handleReplay}
                onLeaderboard={handleGoToLeaderboard}
                onMenu={handleGoToMenu}
                onSkipLevel={skipLevel}
                onOpenDevPanel={() => setShowDevPanelInGame(true)}
              />

              {upgradeOffer && (
                <UpgradePicker
                  offers={upgradeOffer}
                  level={ui.level}
                  score={ui.score}
                  onPick={handleUpgradePick}
                  onSkip={handleUpgradeSkip}
                />
              )}
            </div>
          </div>

          <SidePanel side="right" feverMode={ui.orangeLeft > 0 && ui.orangeLeft <= 3} />
        </div>
      </div>

      {/* ── Transition overlay — CSS transition, toujours monté ─────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 200,
          background: "#030804",
          pointerEvents: "none",
          opacity: overlayOpaque ? 1 : 0,
          transition: overlayOpaque
            ? "opacity 0.18s cubic-bezier(0.4, 0, 1, 1)"
            : "opacity 0.35s cubic-bezier(0, 0, 0.4, 1)",
        }}
      />
    </div>
  );
}
