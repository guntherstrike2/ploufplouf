"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { AppProps } from "@/types";
import { useAuth } from "@/lib/contexts/auth-context";
import { useMusic } from "./hooks/useMusic";
import { useGameLoop } from "./hooks/useGameLoop";
import { usePeagleSounds } from "./hooks/usePeagleSounds";
import { GameCanvas } from "./components/GameCanvas";
import { Leaderboard } from "./components/Leaderboard";
import { LoadingScreen } from "./components/LoadingScreen";
import { MainMenu } from "./components/MainMenu";
import { UpgradePicker } from "./components/UpgradePicker";
import { SidePanel } from "./components/SidePanel";
import { DevPanel } from "./components/DevPanel";
import type { DevConfig, DevTriggerScreen } from "./components/DevPanel";
import { W } from "./engine/constants";
import type { UiState, LeaderboardEntry, UpgradeId } from "./engine/types";
import type { RunState } from "./engine/roguelite";
import { makeInitialRunState, makeRunStateWithSeed, generateUpgradeOffer } from "./engine/roguelite";

type Screen = "loading" | "menu" | "game" | "leaderboard";

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

  const [screen, setScreen] = useState<Screen>("loading");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  // Visibilité de l'écran de jeu — pilote le gel de la boucle rAF (cf. useGameLoop).
  const gameVisibleRef = useRef(false);
  const [ui, setUi] = useState<UiState>({
    balls: 12, score: 0, orangeLeft: 0, orangeTotal: 0,
    phase: "aim", message: "", combo: 0, level: 1, stars: 0, clutch: false, isNewRecord: false,
  });
  const [currentSeed, setCurrentSeed] = useState<number>(EMPTY_RUN.seed);

  const [bestScore, setBestScore] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("peagle98_best") ?? "0", 10);
  });
  const bestScoreRef = useRef(bestScore);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  // Offre d'upgrade entre deux niveaux
  const [upgradeOffer, setUpgradeOffer] = useState<UpgradeId[] | null>(null);
  const upgradeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelUpgradeTimer = useCallback(() => {
    if (upgradeTimerRef.current) { clearTimeout(upgradeTimerRef.current); upgradeTimerRef.current = null; }
  }, []);

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

  useEffect(() => {
    gameVisibleRef.current = screen === "game";
  }, [screen]);

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
      // Rafraîchit le classement avec le score fraîchement enregistré, pour que
      // l'écran de game over montre la position réelle du joueur.
      fetchLeaderboard();
    } catch { /* silent */ }
  }, [user, scoreSubmitted, fetchLeaderboard]);

  // À l'entrée en défaite, on précharge le classement (même pour les joueurs non
  // connectés, qui voient le top sans y figurer). La soumission rafraîchit ensuite.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ui.phase === "lost") fetchLeaderboard();
  }, [ui.phase, fetchLeaderboard]);

  const handleLevelWon = useCallback(() => {
    cancelUpgradeTimer();
    const offer = generateUpgradeOffer(runStateRef.current.upgrades, runStateRef.current.seed);
    upgradeTimerRef.current = setTimeout(() => {
      upgradeTimerRef.current = null;
      setUpgradeOffer(offer);
    }, 3000);
  }, [cancelUpgradeTimer]);

  const recordBestScore = useCallback((score: number) => {
    setBestScore(prev => {
      if (score <= prev) return prev;
      bestScoreRef.current = score;
      try { localStorage.setItem("peagle98_best", String(score)); } catch { /* quota / private mode */ }
      return score;
    });
  }, [bestScoreRef]);

  const { musicMuted, toggleMusic, fadeOutAndRestart, fadeToGameTrack, cutToGameOverTrack, getBeat } = useMusic(screen !== "loading");
  const { playEagleCryLong, playGameOverStinger } = usePeagleSounds();

  // Cri de l'aigle à l'entrée en clutch mode — la musique reste inchangée.
  const prevInClutchRef = useRef(false);
  const inClutch = screen === "game" && ui.clutch;
  useEffect(() => {
    if (screen !== "game") { prevInClutchRef.current = false; return; }
    if (inClutch && !prevInClutchRef.current) {
      playEagleCryLong();
    }
    prevInClutchRef.current = inClutch;
  }, [inClutch, screen, playEagleCryLong]);

  // Cut musical + stinger au moment du game over.
  const prevPhaseRef = useRef(ui.phase);
  useEffect(() => {
    if (ui.phase === "lost" && prevPhaseRef.current !== "lost") {
      cutToGameOverTrack();
      playGameOverStinger();
    }
    prevPhaseRef.current = ui.phase;
  }, [ui.phase, cutToGameOverTrack, playGameOverStinger]);

  const handleUiSync = useCallback((uiState: UiState) => setUi(uiState), []);
  const handleOrangeTotalChange = useCallback((total: number) => setUi(u => ({ ...u, orangeTotal: total })), []);

  const { handlePointerDown, handlePointerMove, handlePointerUp, resetGame, nextLevel, skipLevel, forceWin, forceLose, forceDay, forceNight, forceNewRecord } = useGameLoop({
    canvasRef,
    mouseRef,
    runStateRef,
    devConfigRef,
    pausedRef,
    visibleRef: gameVisibleRef,
    bestScoreRef,
    onUiSync: handleUiSync,
    onOrangeTotalChange: handleOrangeTotalChange,
    onBestScore: recordBestScore,
    onScoreSubmit: submitScore,
    onLevelWon: handleLevelWon,
    onRequestPause: () => setPaused(true),
  });

  const handleUpgradePick = useCallback((id: UpgradeId) => {
    cancelUpgradeTimer();
    runStateRef.current = { ...runStateRef.current, upgrades: [...runStateRef.current.upgrades, id] };
    setUpgradeOffer(null);
    fadeToGameTrack();
    nextLevel();
  }, [nextLevel, fadeToGameTrack, cancelUpgradeTimer]);

  const handleUpgradeSkip = useCallback(() => {
    cancelUpgradeTimer();
    setUpgradeOffer(null);
    fadeToGameTrack();
    nextLevel();
  }, [nextLevel, fadeToGameTrack, cancelUpgradeTimer]);

  const startRun = useCallback((seedOverride?: number) => {
    cancelUpgradeTimer();
    setHasSeenIntro(true);
    devConfigRef.current = null;
    setDevSessionActive(false);
    const run = seedOverride !== undefined
      ? makeRunStateWithSeed(seedOverride)
      : makeInitialRunState();
    runStateRef.current = run;
    setCurrentSeed(run.seed);
    resetGame(false);
    setScoreSubmitted(false);
    setUpgradeOffer(null);
    setPaused(false);
    fadeToGameTrack();
    transitionTo("game");
  }, [resetGame, transitionTo, fadeToGameTrack, cancelUpgradeTimer]);

  const handleDevLaunch = useCallback((cfg: DevConfig) => {
    cancelUpgradeTimer();
    setHasSeenIntro(true);
    devConfigRef.current = cfg;
    const run = { ...makeInitialRunState(), upgrades: cfg.upgrades };
    runStateRef.current = run;
    setCurrentSeed(run.seed);
    resetGame(false, cfg.startLevel);
    setScoreSubmitted(false);
    setUpgradeOffer(null);
    setDevSessionActive(true);
    setShowDevPanelInGame(false);
    setPaused(false);
    fadeToGameTrack();
    transitionTo("game");
  }, [resetGame, transitionTo, fadeToGameTrack, cancelUpgradeTimer]);

  const handleGoToMenu = useCallback(() => {
    cancelUpgradeTimer();
    fadeOutAndRestart();
    transitionTo("menu", () => {
      setUpgradeOffer(null);
      setPaused(false);
    });
  }, [transitionTo, fadeOutAndRestart, cancelUpgradeTimer]);

  const handleGoToLeaderboard = useCallback(() => {
    setHasSeenIntro(true);
    transitionTo("leaderboard", () => {
      setPaused(false);
      fetchLeaderboard();
    });
  }, [transitionTo, fetchLeaderboard]);

  const handleReplay = useCallback(() => {
    cancelUpgradeTimer();
    const run = makeInitialRunState();
    runStateRef.current = run;
    devConfigRef.current = null;
    setCurrentSeed(run.seed);
    resetGame(false);
    setScoreSubmitted(false);
    setUpgradeOffer(null);
    setPaused(false);
    setDevSessionActive(false);
    fadeToGameTrack();
    transitionTo("game");
  }, [resetGame, fadeToGameTrack, cancelUpgradeTimer, transitionTo]);

  // Rejouer avec exactement le même seed (upgrades remises à zéro).
  const handleReplaySeed = useCallback(() => {
    cancelUpgradeTimer();
    const seed = runStateRef.current.seed;
    runStateRef.current = makeRunStateWithSeed(seed);
    devConfigRef.current = null;
    // setCurrentSeed reste inchangé (même seed)
    resetGame(false);
    setScoreSubmitted(false);
    setUpgradeOffer(null);
    setPaused(false);
    setDevSessionActive(false);
    fadeToGameTrack();
    transitionTo("game");
  }, [resetGame, fadeToGameTrack, cancelUpgradeTimer, transitionTo]);

  const handleAssetsReady = useCallback(() => {
    transitionTo("menu");
  }, [transitionTo]);

  const handleTriggerScreen = useCallback((s: DevTriggerScreen) => {
    if (s === "win") forceWin();
    else if (s === "lose") forceLose();
    else if (s === "day") forceDay();
    else if (s === "new-record") forceNewRecord();
    else forceNight();
  }, [forceWin, forceLose, forceDay, forceNight, forceNewRecord]);

  // Callbacks stables passés à GameCanvas (mémoïsé) — évite de casser sa memo.
  const handleResume = useCallback(() => setPaused(false), []);
  const handleOpenDevPanel = useCallback(() => setShowDevPanelInGame(true), []);

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ background: "var(--t-bg)", fontFamily: "var(--t-font-display)", position: "relative" }}
    >
      {screen === "loading" && (
        <LoadingScreen onReady={handleAssetsReady} />
      )}

      {screen === "menu" && (
        <MainMenu
          isAdmin={isAdmin}
          onPlay={() => startRun()}
          onPlayWithSeed={(seed) => startRun(seed)}
          onLeaderboard={handleGoToLeaderboard}
          onDevLaunch={handleDevLaunch}
          musicMuted={musicMuted}
          onToggleMusic={toggleMusic}
          skipIntro={hasSeenIntro}
          getBeat={getBeat}
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
            onTriggerScreen={handleTriggerScreen}
          />
        )}

        {/* Layout responsive : vertical (mobile) ou horizontal (16/9+) */}
        <div className="pg-game-layout peagle-root" style={{ flex: 1, overflow: "hidden", alignItems: "stretch" }}>
          <SidePanel side="left" clutchMode={ui.clutch} />

          <div className="pg-canvas-area">
            <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <GameCanvas
                canvasRef={canvasRef}
                ui={ui}
                currentSeed={currentSeed}
                leaderboard={leaderboard}
                lbLoading={lbLoading}
                user={user}
                isAdmin={isAdmin}
                showDevTools={isAdmin && devSessionActive}
                upgradeOfferPending={!!upgradeOffer}
                paused={paused}
                musicMuted={musicMuted}
                onResume={handleResume}
                onToggleMusic={toggleMusic}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onReplay={handleReplay}
                onReplaySeed={handleReplaySeed}
                onLeaderboard={handleGoToLeaderboard}
                onMenu={handleGoToMenu}
                onSkipLevel={skipLevel}
                onOpenDevPanel={handleOpenDevPanel}
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

          <SidePanel side="right" clutchMode={ui.clutch} />
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
