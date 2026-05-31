"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import { useSoundContext } from "@/lib/contexts/sound-context";
import { useOpenApp } from "@/lib/hooks/use-open-app";
import { useNotify } from "@/lib/contexts/notification-context";
import { useCelebration } from "@/lib/hooks/use-celebration";
import { useGunthrankData } from "./hooks/use-gunthrank-data";
import { TierRow } from "./components/TierRow";
import { GameDetailModal } from "./components/GameDetailModal";
import { StatsDashboard } from "./components/StatsDashboard";
import { OverlayView } from "./components/OverlayView";
import { CatalogPanel } from "./components/CatalogPanel";
import { KiffThemeProvider, useKiffTheme } from "./kiff-theme-context";
import { TIERS, type TierId, type IgdbSearchResult, type RankingEntry } from "./constants";
import { KIFF_THEMES } from "./kiff-themes";
import type { CelebrationOptions } from "@/types/plouf-plouf";

function ThemeDropdown() {
  const { theme, setThemeId } = useKiffTheme();
  const { playClick } = useSoundContext();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => { playClick(); setOpen(!open); }}
        className="px-2 py-1 flex items-center gap-1"
        style={{
          fontSize: "var(--t-text-xs)",
          background: "var(--t-bg-dark)",
          color: "var(--t-text)",
          borderTop: "2px solid var(--t-border-light)",
          borderLeft: "2px solid var(--t-border-light)",
          borderBottom: "2px solid var(--t-border-dark)",
          borderRight: "2px solid var(--t-border-dark)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {/* Mini swatches */}
        <span className="flex gap-px" style={{ width: 16, height: 10 }}>
          <span style={{ flex: 1, background: theme.preview.bg }} />
          <span style={{ flex: 1, background: theme.preview.accent }} />
        </span>
        {theme.name} ▾
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute top-full left-0 mt-0.5 rounded p-1.5 z-20"
            style={{
              background: "var(--t-bg)",
              borderTop: "2px solid var(--t-border-light)",
              borderLeft: "2px solid var(--t-border-light)",
              borderBottom: "2px solid var(--t-border-dark)",
              borderRight: "2px solid var(--t-border-dark)",
              width: 220,
              maxHeight: 320,
              overflow: "auto",
            }}
          >
            {KIFF_THEMES.map((t) => {
              const isActive = theme.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { playClick(); setThemeId(t.id); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1 rounded text-left"
                  style={{
                    background: isActive ? "var(--t-accent-hover)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "var(--t-text-xs)",
                    color: "var(--t-text)",
                  }}
                >
                  <span className="flex gap-px flex-shrink-0" style={{ width: 28, height: 12 }}>
                    <span style={{ flex: 1, background: t.preview.bg }} />
                    <span style={{ flex: 1, background: t.preview.titlebarFrom }} />
                    <span style={{ flex: 1, background: t.preview.accent }} />
                    <span style={{ flex: 1, background: t.preview.text }} />
                  </span>
                  <span>{t.emoji} {t.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function GunthrankApp({ windowId }: { windowId: string }) {
  return (
    <KiffThemeProvider>
      <GunthrankAppInner windowId={windowId} />
    </KiffThemeProvider>
  );
}

function GunthrankAppInner({ windowId }: { windowId: string }) {
  const { user } = useAuth();
  const { playClick, playPop, playDelete, playVictory, playTierDiamond, playTierGold, playTierSilver, playTierBronze, playTierBanger, playTierCaca } = useSoundContext();
  const { openApp } = useOpenApp();
  const notify = useNotify();
  const tierListRef = useRef<HTMLDivElement>(null);
  const { theme } = useKiffTheme();
  const { canvasRef, start: startCelebration } = useCelebration();

  const {
    viewMode,
    devMode, setDevMode,
    rankings, loading,
    viewedUser,
    availableUsers, fetchAvailableUsers,
    selectUser, goToMyRankings,
    filters, setFilters,
    allPlatforms, allGenres, allYears,
    addGame, addFromCatalog, removeRanking, moveGame, reorderGame, swapGame, updateNote,
  } = useGunthrankData();

  const [showStats, setShowStats] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showCatalog, setShowCatalog] = useState(true);
  const [detailRanking, setDetailRanking] = useState<RankingEntry | null>(null);
  const [recentlyMovedIds, setRecentlyMovedIds] = useState<Set<number>>(new Set());
  const [viewLayout, setViewLayout] = useState<"list" | "grid">(() => {
    try { return (localStorage.getItem("gunthrank-view-layout") as "list" | "grid") ?? "list"; } catch { return "list"; }
  });
  const [effectsOn, setEffectsOn] = useState(() => {
    try { return localStorage.getItem("gunthrank-effects") !== "false"; } catch { return true; }
  });
  const effectsRef = useRef(effectsOn);
  effectsRef.current = effectsOn;

  const toggleEffects = () => {
    const next = !effectsOn;
    setEffectsOn(next);
    effectsRef.current = next;
    try { localStorage.setItem("gunthrank-effects", String(next)); } catch { /* noop */ }
    playClick();
  };

  const toggleViewLayout = () => {
    const next = viewLayout === "list" ? "grid" : "list";
    setViewLayout(next);
    try { localStorage.setItem("gunthrank-view-layout", next); } catch { /* noop */ }
  };

  const readOnly = viewMode === "other" && !devMode;

  const handleOpenUserPicker = () => {
    fetchAvailableUsers();
  };

  const celebrateTier = useCallback((tier: TierId) => {
    if (!effectsRef.current) return;
    const configs: Record<TierId, {
      type: CelebrationOptions["type"];
      density: number;
      duration: number;
      color1: string;
      color2: string;
      color3: string;
      flash: boolean;
      speedMultiplier: number;
    }> = {
      diamond: { type: "trophy-diamond",density: 220, duration: 3.5, color1: "#B9F2FF", color2: "#E0F7FF", color3: "#FFFFFF", flash: true,  speedMultiplier: 0.7 },
      gold:    { type: "trophy-gold",   density: 120, duration: 4,   color1: "#FFD700", color2: "#FFC107", color3: "#FFE082", flash: false, speedMultiplier: 0.5 },
      silver:  { type: "trophy-silver", density: 90,  duration: 3.5, color1: "#C0C0C0", color2: "#E0E0E0", color3: "#FFFFFF", flash: false, speedMultiplier: 0.55 },
      bronze:  { type: "trophy-bronze", density: 70,  duration: 3.5, color1: "#CD7F32", color2: "#D2A679", color3: "#F5DEB3", flash: false, speedMultiplier: 0.6 },
      banger:  { type: "rain",          density: 50,  duration: 2,   color1: "#9B8EA8", color2: "#B8ACCC", color3: "#D4CCE0", flash: false, speedMultiplier: 1 },
      caca:    { type: "poop",          density: 120, duration: 2.5, color1: "#8B7355", color2: "#6B4226", color3: "#4A3728", flash: false, speedMultiplier: 1 },
    };
    const c = configs[tier];
    startCelebration({
      preset: "custom",
      type: c.type,
      text: "",
      density: c.density,
      duration: c.duration,
      color1: c.color1,
      color2: c.color2,
      color3: c.color3,
      flash: c.flash,
      rainbow: false,
      shake: 0,
      marquee: false,
      bigText: false,
      damageNumbers: false,
      bgPulse: false,
      epicResult: false,
      randomPreset: false,
      forceTransparent: false,
      winnerColor: "#fff",
      winnerSubColor: "#ccc",
      speedMultiplier: c.speedMultiplier,
    });
  }, [startCelebration]);

  const tierSounds: Record<TierId, () => void> = {
    diamond: playTierDiamond,
    gold: playTierGold,
    silver: playTierSilver,
    bronze: playTierBronze,
    banger: playTierBanger,
    caca: playTierCaca,
  };

  const handleMoveGame = (rankingId: number, toTier: TierId, toIndex?: number) => {
    const entry = rankings.find((r) => r.id === rankingId);
    if (!entry) return;
    const oldTier = entry.tier;
    moveGame(rankingId, toTier, toIndex ?? 0);
    if (toTier !== oldTier) {
      setRecentlyMovedIds((prev) => { const next = new Set(prev); next.add(rankingId); return next; });
      setTimeout(() => setRecentlyMovedIds((prev) => { const next = new Set(prev); next.delete(rankingId); return next; }), 400);
      tierSounds[toTier]();
      celebrateTier(toTier);
    } else {
      playPop();
    }
  };

  const handleMoveToTier = (rankingId: number, toTier: TierId) => {
    const entry = rankings.find((r) => r.id === rankingId);
    if (!entry) return;
    moveGame(rankingId, toTier, 0);
    playPop();
  };

  const handleReorder = (rankingId: number, toIndex: number) => {
    reorderGame(rankingId, toIndex);
    playClick();
  };

  const handleSwap = (rankingId: number, targetRankingId: number) => {
    swapGame(rankingId, targetRankingId);
    playPop();
  };

  const handleExport = async () => {
    if (!tierListRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(tierListRef.current, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "classement-du-kiff.png";
      a.click();
      playVictory();
      notify({ type: "success", title: "Image exportée !" });
    } catch (e) {
      notify({ type: "error", title: "Erreur d'export..." });
    }
  };

  const handleRemove = async (gameId: number) => {
    playDelete();
    await removeRanking(gameId);
    notify({ type: "info", title: "Jeu retiré du classement" });
  };

  const handleAddFromCatalog = async (gameId: number, toTier: TierId, toIndex?: number) => {
    playPop();
    await addFromCatalog(gameId, toTier, toIndex);
    tierSounds[toTier]();
    celebrateTier(toTier);
    notify({ type: "success", title: "Ajouté au classement !" });
  };

  const handleAddFromIgdb = async (igdbGame: IgdbSearchResult, toTier: TierId, toIndex?: number) => {
    playPop();
    if (devMode) {
      // In dev mode, store directly with IGDB data embedded
      await addGame({
        igdbId: igdbGame.igdbId,
        name: igdbGame.name,
        slug: igdbGame.slug,
        coverUrl: igdbGame.coverUrl,
        platforms: igdbGame.platforms,
        genres: igdbGame.genres,
        releaseDate: igdbGame.releaseYear,
        summary: igdbGame.summary,
        tier: toTier,
        toIndex,
      });
    } else {
      // Add to catalog first, then create ranking
      const gameRes = await fetch("/api/gunthrank/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          igdbId: igdbGame.igdbId,
          name: igdbGame.name,
          slug: igdbGame.slug,
          coverUrl: igdbGame.coverUrl,
          platforms: igdbGame.platforms,
          genres: igdbGame.genres,
          releaseDate: igdbGame.releaseYear,
          summary: igdbGame.summary,
        }),
      });
      const { game } = await gameRes.json() as { game: { id: number } };
      await addFromCatalog(game.id, toTier, toIndex);
    }
    tierSounds[toTier]();
    celebrateTier(toTier);
    notify({ type: "success", title: `${igdbGame.name} ajouté !` });
  };

  if (showOverlay) {
    return (
      <OverlayView
        rankings={rankings}
        viewMode={viewMode}
        viewedUser={viewedUser}
        onExit={() => setShowOverlay(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ ...theme.vars, background: "var(--t-app-bg)" }}>

      {/* Dev mode banner */}
      {devMode && (
        <div
          className="px-3 py-1 text-center font-bold"
          style={{
            fontSize: "var(--t-text-xs)",
            color: "#fff",
            background: "#ff3300",
            borderBottom: "1px solid var(--t-border-dark)",
          }}
        >
          MODE DEV — Données stockées en localStorage (pas d'auth requise)
        </div>
      )}

      {/* Read-only banner */}
      {readOnly && viewedUser && (
        <div
          className="px-3 py-1 text-center"
          style={{
            fontSize: "var(--t-text-xs)",
            color: "var(--t-text-muted)",
            background: "var(--t-bg)",
            borderBottom: "1px solid var(--t-border-dark)",
          }}
        >
          Consultation seule — Classement de {viewedUser.username ?? viewedUser.name}
        </div>
      )}

      {/* Stats panel */}
      {showStats && (
        <StatsDashboard
          rankings={rankings}
          allPlatforms={allPlatforms}
          allGenres={allGenres}
          onClose={() => setShowStats(false)}
        />
      )}

      {/* Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <div
          className="flex flex-col gap-0.5 p-2 overflow-auto flex-shrink-0"
          style={{
            width: 168,
            background: "var(--t-bg)",
            borderRight: "2px solid var(--t-border-dark)",
          }}
        >
          {/* App title */}
          <div
            className="text-center font-bold pb-2 flex-shrink-0"
            style={{
              fontSize: "var(--t-text-sm)",
              color: "var(--t-accent)",
              letterSpacing: "0.02em",
              borderBottom: "1px solid var(--t-border-dark)",
              marginBottom: 2,
            }}
          >
            🏆 GunthRank
          </div>

          {/* ── VUE ── */}
          <div className="flex-shrink-0" style={{ marginTop: 4 }}>
            <div
              className="px-1 py-0.5 font-bold"
              style={{ fontSize: "calc(var(--t-text-xs) * 0.9)", color: "var(--t-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              Vue
            </div>
            <button
              onClick={() => { playClick(); goToMyRankings(); }}
              className="w-full text-left px-2 py-1"
              style={{
                fontSize: "var(--t-text-sm)",
                background: viewMode === "mine" ? "var(--t-accent)" : "var(--t-bg-dark)",
                color: viewMode === "mine" ? "#fff" : "var(--t-text)",
                borderTop: "2px solid var(--t-border-light)",
                borderLeft: "2px solid var(--t-border-light)",
                borderBottom: "2px solid var(--t-border-dark)",
                borderRight: "2px solid var(--t-border-dark)",
                cursor: "pointer",
              }}
            >
              👤 Mon classement
            </button>
            <select
              value={viewMode === "other" && viewedUser ? viewedUser.id : ""}
              onChange={(e) => { if (!e.target.value) return; playClick(); selectUser(e.target.value); }}
              onFocus={handleOpenUserPicker}
              className="w-full px-1 py-1 mt-0.5"
              style={{
                fontSize: "var(--t-text-sm)",
                background: "var(--t-bg-dark)",
                color: "var(--t-text)",
                borderTop: "2px solid var(--t-border-dark)",
                borderLeft: "2px solid var(--t-border-dark)",
                borderBottom: "2px solid var(--t-border-light)",
                borderRight: "2px solid var(--t-border-light)",
                cursor: "pointer",
              }}
            >
              <option value="">Voir un autre...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.username ?? u.name}</option>
              ))}
            </select>
            <button
              onClick={() => { playClick(); toggleViewLayout(); }}
              className="w-full text-left px-2 py-1 mt-0.5"
              style={{
                fontSize: "var(--t-text-sm)",
                background: "var(--t-bg-dark)",
                color: "var(--t-text)",
                borderTop: "2px solid var(--t-border-light)",
                borderLeft: "2px solid var(--t-border-light)",
                borderBottom: "2px solid var(--t-border-dark)",
                borderRight: "2px solid var(--t-border-dark)",
                cursor: "pointer",
              }}
            >
              {viewLayout === "list" ? "📋 Liste" : "⊞ Grille"}
            </button>
          </div>

          {/* ── FILTRES ── */}
          <div className="flex-shrink-0" style={{ marginTop: 6 }}>
            <div
              className="px-1 py-0.5 font-bold flex items-center justify-between"
              style={{ fontSize: "calc(var(--t-text-xs) * 0.9)", color: "var(--t-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              Filtres
              {(filters.platform || filters.genre || filters.year) && (
                <button
                  onClick={() => { playClick(); setFilters({ platform: null, genre: null, year: null, tiers: [] }); }}
                  style={{
                    fontSize: "calc(var(--t-text-xs) * 0.8)",
                    background: "var(--t-error)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    padding: "1px 4px",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={filters.platform ?? ""}
              onChange={(e) => { playClick(); setFilters({ ...filters, platform: e.target.value || null }); }}
              className="w-full px-1 py-1"
              style={{
                fontSize: "var(--t-text-sm)",
                background: "var(--t-bg-dark)",
                color: "var(--t-text)",
                borderTop: "2px solid var(--t-border-dark)",
                borderLeft: "2px solid var(--t-border-dark)",
                borderBottom: "2px solid var(--t-border-light)",
                borderRight: "2px solid var(--t-border-light)",
              }}
            >
              <option value="">🖥️ Plateforme</option>
              {allPlatforms.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
            <select
              value={filters.genre ?? ""}
              onChange={(e) => { playClick(); setFilters({ ...filters, genre: e.target.value || null }); }}
              className="w-full px-1 py-1 mt-0.5"
              style={{
                fontSize: "var(--t-text-sm)",
                background: "var(--t-bg-dark)",
                color: "var(--t-text)",
                borderTop: "2px solid var(--t-border-dark)",
                borderLeft: "2px solid var(--t-border-dark)",
                borderBottom: "2px solid var(--t-border-light)",
                borderRight: "2px solid var(--t-border-light)",
              }}
            >
              <option value="">🎮 Genre</option>
              {allGenres.map((g) => (<option key={g} value={g}>{g}</option>))}
            </select>
            <select
              value={filters.year ?? ""}
              onChange={(e) => { playClick(); setFilters({ ...filters, year: e.target.value ? parseInt(e.target.value, 10) : null }); }}
              className="w-full px-1 py-1 mt-0.5"
              style={{
                fontSize: "var(--t-text-sm)",
                background: "var(--t-bg-dark)",
                color: "var(--t-text)",
                borderTop: "2px solid var(--t-border-dark)",
                borderLeft: "2px solid var(--t-border-dark)",
                borderBottom: "2px solid var(--t-border-light)",
                borderRight: "2px solid var(--t-border-light)",
              }}
            >
              <option value="">📅 Année</option>
              {allYears.map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>

          {/* ── OUTILS ── */}
          <div className="flex-shrink-0" style={{ marginTop: 6 }}>
            <div
              className="px-1 py-0.5 font-bold"
              style={{ fontSize: "calc(var(--t-text-xs) * 0.9)", color: "var(--t-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              Outils
            </div>
            {!readOnly && (
              <button
                onClick={() => { playClick(); setShowCatalog(!showCatalog); }}
                className="w-full text-left px-2 py-1"
                style={{
                  fontSize: "var(--t-text-sm)",
                  background: showCatalog ? "var(--t-accent)" : "var(--t-bg-dark)",
                  color: showCatalog ? "#fff" : "var(--t-text)",
                  borderTop: "2px solid var(--t-border-light)",
                  borderLeft: "2px solid var(--t-border-light)",
                  borderBottom: "2px solid var(--t-border-dark)",
                  borderRight: "2px solid var(--t-border-dark)",
                  cursor: "pointer",
                }}
              >
                {showCatalog ? "🔍 Rechercher ▾" : "🔍 Rechercher"}
              </button>
            )}
            <button
              onClick={() => { playClick(); setShowStats(!showStats); }}
              className="w-full text-left px-2 py-1 mt-0.5"
              style={{
                fontSize: "var(--t-text-sm)",
                background: showStats ? "var(--t-accent)" : "var(--t-bg-dark)",
                color: showStats ? "#fff" : "var(--t-text)",
                borderTop: "2px solid var(--t-border-light)",
                borderLeft: "2px solid var(--t-border-light)",
                borderBottom: "2px solid var(--t-border-dark)",
                borderRight: "2px solid var(--t-border-dark)",
                cursor: "pointer",
              }}
            >
              {showStats ? "📊 Stats ▾" : "📊 Stats"}
            </button>
            <button
              onClick={() => setShowOverlay(true)}
              className="w-full text-left px-2 py-1 mt-0.5"
              style={{
                fontSize: "var(--t-text-sm)",
                background: "var(--t-bg-dark)",
                color: "var(--t-text)",
                borderTop: "2px solid var(--t-border-light)",
                borderLeft: "2px solid var(--t-border-light)",
                borderBottom: "2px solid var(--t-border-dark)",
                borderRight: "2px solid var(--t-border-dark)",
                cursor: "pointer",
              }}
            >
              📺 Overlay
            </button>
            <button
              onClick={handleExport}
              className="w-full text-left px-2 py-1 mt-0.5"
              style={{
                fontSize: "var(--t-text-sm)",
                background: "var(--t-bg-dark)",
                color: "var(--t-text)",
                borderTop: "2px solid var(--t-border-light)",
                borderLeft: "2px solid var(--t-border-light)",
                borderBottom: "2px solid var(--t-border-dark)",
                borderRight: "2px solid var(--t-border-dark)",
                cursor: "pointer",
              }}
            >
              📷 Export
            </button>
          </div>

          {/* ── RÉGLAGES ── */}
          <div className="flex-shrink-0" style={{ marginTop: 6 }}>
            <div
              className="px-1 py-0.5 font-bold"
              style={{ fontSize: "calc(var(--t-text-xs) * 0.9)", color: "var(--t-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              Réglages
            </div>
            <div className="mt-0.5">
              <ThemeDropdown />
            </div>
            <div className="flex gap-0.5 mt-0.5">
              <button
                onClick={toggleEffects}
                className="flex-1 text-center px-1 py-1"
                style={{
                  fontSize: "var(--t-text-sm)",
                  background: effectsOn ? "var(--t-bg)" : "var(--t-bg-dark)",
                  color: effectsOn ? "var(--t-text)" : "var(--t-text-muted)",
                  borderTop: effectsOn ? "2px solid var(--t-border-dark)" : "2px solid var(--t-border-light)",
                  borderLeft: effectsOn ? "2px solid var(--t-border-dark)" : "2px solid var(--t-border-light)",
                  borderBottom: effectsOn ? "2px solid var(--t-border-light)" : "2px solid var(--t-border-dark)",
                  borderRight: effectsOn ? "2px solid var(--t-border-light)" : "2px solid var(--t-border-dark)",
                  cursor: "pointer",
                  opacity: effectsOn ? 1 : 0.55,
                }}
                title={effectsOn ? "Effets visuels activés" : "Effets visuels désactivés — son uniquement"}
              >
                {effectsOn ? "✨ ON" : "✨ OFF"}
              </button>
              <button
                onClick={() => { playClick(); setDevMode(!devMode); }}
                className="flex-1 text-center px-1 py-1"
                style={{
                  fontSize: "var(--t-text-sm)",
                  background: devMode ? "#ff3300" : "var(--t-bg-dark)",
                  color: devMode ? "#fff" : "var(--t-text-muted)",
                  borderTop: devMode ? "2px solid var(--t-border-dark)" : "2px solid var(--t-border-light)",
                  borderLeft: devMode ? "2px solid var(--t-border-dark)" : "2px solid var(--t-border-light)",
                  borderBottom: devMode ? "2px solid var(--t-border-light)" : "2px solid var(--t-border-dark)",
                  borderRight: devMode ? "2px solid var(--t-border-light)" : "2px solid var(--t-border-dark)",
                  cursor: "pointer",
                }}
              >
                DEV
              </button>
            </div>
          </div>
        </div>

        {/* Tier list + Catalog */}
        {showCatalog && !readOnly && (
          <CatalogPanel
            onClose={() => setShowCatalog(false)}
            onAddFromCatalog={handleAddFromCatalog}
            onAddFromIgdb={handleAddFromIgdb}
          />
        )}
        <div ref={tierListRef} className="flex flex-col gap-3 p-3 overflow-auto flex-1 tier-list-root">
          {viewMode === "mine" && !user && !devMode ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4" style={{ minHeight: 300 }}>
              <p style={{ fontSize: "var(--t-text-md)", color: "var(--t-text-muted)" }}>
                Connecte-toi pour créer ton classement !
              </p>
              <button
                onClick={() => openApp("login")}
                className="px-4 py-2 font-bold"
                style={{
                  fontSize: "var(--t-text-sm)",
                  background: "var(--t-accent)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Se connecter
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center flex-1" style={{ minHeight: 300 }}>
              <span style={{ fontSize: "var(--t-text-md)", color: "var(--t-text-muted)" }}>
                Chargement...
              </span>
            </div>
          ) : (
            TIERS.reduce<{ offset: number; rows: React.ReactNode[] }>((acc, tier) => {
              const tierGames = rankings.filter((r) => r.tier === tier.id);
              const isNumbered = ["diamond", "gold", "silver", "bronze"].includes(tier.id);
              const row = (
                <TierRow
                  key={tier.id}
                  tier={tier}
                  games={tierGames}
                  readOnly={readOnly}
                  viewLayout={viewLayout}
                  recentlyMovedIds={recentlyMovedIds}
                  onDrop={handleMoveGame}
                  onAddFromCatalog={handleAddFromCatalog}
                  onAddFromIgdb={handleAddFromIgdb}
                  onRemove={handleRemove}
                  onUpdateNote={updateNote}
                  onMove={handleMoveToTier}
                  onReorder={handleReorder}
                  onSwap={handleSwap}
                  onDetailClick={setDetailRanking}
                  globalRankOffset={isNumbered ? acc.offset : undefined}
                />
              );
              acc.rows.push(row);
              if (isNumbered) acc.offset += tierGames.length;
              return acc;
            }, { offset: 0, rows: [] }).rows
          )}
        </div>
      </div>

      {/* Game Detail Modal */}
      {detailRanking && (
        <GameDetailModal
          ranking={detailRanking}
          readOnly={readOnly}
          onClose={() => setDetailRanking(null)}
          onRemove={handleRemove}
        />
      )}

      {/* Celebration particles canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 100, width: "100%", height: "100%" }} />
    </div>
  );
}
