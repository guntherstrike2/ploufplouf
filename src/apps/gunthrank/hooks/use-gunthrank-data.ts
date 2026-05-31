"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import type { RankingEntry, GameCatalogEntry, TierId, IgdbSearchResult, Filters } from "../constants";

export type { Filters, TierId };

const DEV_KEY = "gunthrank-dev-rankings";

function loadDevRankings(): RankingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DEV_KEY) ?? "[]");
  } catch { return []; }
}

function saveDevRankings(r: RankingEntry[]) {
  localStorage.setItem(DEV_KEY, JSON.stringify(r));
}

export interface UserInfo {
  id: string;
  name: string;
  username: string | null;
}

export function useGunthrankData() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"mine" | "other">("mine");
  const [devMode, setDevMode] = useState(false);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [games, setGames] = useState<GameCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewedUser, setViewedUser] = useState<UserInfo | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserInfo[]>([]);
  const [filters, setFilters] = useState<Filters>({ platform: null, genre: null, year: null, tiers: [] });

  // ── Dev mode: load from localStorage on mount ──
  useEffect(() => {
    if (devMode) setRankings(loadDevRankings());
  }, [devMode]);

  const fetchAvailableUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/gunthrank/public/users");
      const data = await res.json() as { users: UserInfo[] };
      setAvailableUsers(data.users);
      return data.users;
    } catch { return []; }
  }, []);

  const fetchRankings = useCallback(async () => {
    if (devMode) { setRankings(loadDevRankings()); setLoading(false); return; }
    setLoading(true);
    try {
      if (viewMode === "other" && selectedUserId) {
        const res = await fetch(`/api/gunthrank/public?userId=${selectedUserId}`);
        const data = await res.json() as { user: UserInfo | null; rankings: RankingEntry[] };
        setViewedUser(data.user);
        setRankings(data.rankings);
      } else if (user) {
        setViewedUser(null);
        const res = await fetch("/api/gunthrank/rankings");
        const data = await res.json() as { rankings: RankingEntry[] };
        setRankings(data.rankings);
      } else {
        setViewedUser(null);
        setRankings([]);
      }
    } finally {
      setLoading(false);
    }
  }, [viewMode, user, devMode, selectedUserId]);

  useEffect(() => { fetchRankings(); }, [fetchRankings]);

  // ── User selection ──
  const selectUser = useCallback((userId: string) => {
    setSelectedUserId(userId);
    setViewMode("other");
  }, []);

  const goToMyRankings = useCallback(() => {
    setSelectedUserId(null);
    setViewedUser(null);
    setViewMode("mine");
  }, []);

  const fetchGames = useCallback(async (q: string) => {
    if (devMode) {
      const res = await fetch(`/api/gunthrank/games?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { games: GameCatalogEntry[] };
      return data.games;
    }
    const res = await fetch(`/api/gunthrank/games?q=${encodeURIComponent(q)}`);
    const data = await res.json() as { games: GameCatalogEntry[] };
    return data.games;
  }, [devMode]);

  const searchIgdb = useCallback(async (query: string) => {
    const res = await fetch("/api/igdb/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json() as { results: IgdbSearchResult[]; offline?: boolean };
    return data;
  }, []);

  const addGame = useCallback(async (gameData: {
    igdbId?: number | null;
    name: string;
    slug?: string | null;
    coverUrl?: string | null;
    platforms?: string[] | null;
    genres?: string[] | null;
    releaseDate?: number | null;
    summary?: string | null;
    videos?: Array<{ videoId: string; name: string | null }> | null;
    tier: string;
    toIndex?: number;
    objectiveNote?: number | null;
    noteText?: string | null;
    playedOn?: string | null;
  }) => {
    const { toIndex, ...data } = gameData;
    if (devMode) {
      const devGame: GameCatalogEntry = {
        id: Date.now(),
        igdbId: data.igdbId ?? null,
        name: data.name,
        slug: data.slug ?? null,
        coverUrl: data.coverUrl ?? null,
        platforms: data.platforms ? JSON.stringify(data.platforms) : null,
        genres: data.genres ? JSON.stringify(data.genres) : null,
        releaseDate: data.releaseDate ?? null,
        summary: data.summary ?? null,
        summaryFr: null,
        videos: data.videos ? JSON.stringify(data.videos) : null,
        createdAt: new Date(),
      };
      const newId = Date.now() + 1;
      const devRanking: RankingEntry = {
        id: newId,
        userId: "dev",
        gameId: devGame.id,
        tier: data.tier,
        objectiveNote: data.objectiveNote ?? null,
        noteText: data.noteText ?? null,
        playedOn: data.playedOn ?? null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        game: devGame,
      };
      setRankings((prev) => {
        let next = [...prev, devRanking];
        if (toIndex !== undefined) {
          const tier = data.tier;
          const inTier = next.filter((r) => r.tier === tier).sort((a, b) => a.sortOrder - b.sortOrder);
          const target = inTier.find((r) => r.id === newId)!;
          const others = inTier.filter((r) => r.id !== newId);
          const clamped = Math.max(0, Math.min(toIndex, others.length));
          const reordered = [...others.slice(0, clamped), target, ...others.slice(clamped)];
          next = next.map((r) => {
            const idx = reordered.findIndex((rr) => rr.id === r.id);
            return idx >= 0 ? { ...r, sortOrder: idx } : r;
          });
        }
        saveDevRankings(next);
        return next;
      });
      return devRanking;
    }

    // Add to catalog
    const gameRes = await fetch("/api/gunthrank/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        igdbId: data.igdbId,
        name: data.name,
        slug: data.slug,
        coverUrl: data.coverUrl,
        platforms: data.platforms,
        genres: data.genres,
        releaseDate: data.releaseDate,
        summary: data.summary,
      }),
    });
    const { game } = await gameRes.json() as { game: GameCatalogEntry };

    const rankRes = await fetch("/api/gunthrank/rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: game.id,
        tier: data.tier,
        objectiveNote: data.objectiveNote,
        noteText: data.noteText,
        playedOn: data.playedOn,
      }),
    });
    const { ranking } = await rankRes.json() as { ranking: RankingEntry };

    const newEntry = { ...ranking, game };
    setRankings((prev) => {
      let next = [...prev, newEntry];
      if (toIndex !== undefined) {
        const tier = data.tier;
        const inTier = next.filter((r) => r.tier === tier).sort((a, b) => a.sortOrder - b.sortOrder);
        const others = inTier.filter((r) => r.id !== ranking.id);
        const clamped = Math.max(0, Math.min(toIndex, others.length));
        const reordered = [...others.slice(0, clamped), { ...newEntry, sortOrder: clamped }, ...others.slice(clamped)];
        const updates = reordered.map((r, i) => ({ id: r.id, tier: r.tier, sortOrder: i }));
        fetch("/api/gunthrank/rankings/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        }).catch(() => {});
        next = next.map((r) => {
          const idx = reordered.findIndex((rr) => rr.id === r.id);
          return idx >= 0 ? { ...r, sortOrder: idx } : r;
        });
      }
      return next;
    });
    return ranking;
  }, [devMode]);

  const addFromCatalog = useCallback(async (gameId: number, tier: string, toIndex?: number) => {
    if (devMode) {
      const existing = rankings.find((r) => r.gameId === gameId);
      if (!existing?.game) return;
      const newId = Date.now();
      const devRanking: RankingEntry = {
        id: newId,
        userId: "dev",
        gameId: existing.gameId,
        tier,
        objectiveNote: null,
        noteText: null,
        playedOn: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        game: existing.game,
      };
      setRankings((prev) => {
        let next = [...prev, devRanking];
        if (toIndex !== undefined) {
          const inTier = next.filter((r) => r.tier === tier).sort((a, b) => a.sortOrder - b.sortOrder);
          const target = inTier.find((r) => r.id === newId)!;
          const others = inTier.filter((r) => r.id !== newId);
          const clamped = Math.max(0, Math.min(toIndex, others.length));
          const reordered = [...others.slice(0, clamped), target, ...others.slice(clamped)];
          next = next.map((r) => {
            const idx = reordered.findIndex((rr) => rr.id === r.id);
            return idx >= 0 ? { ...r, sortOrder: idx } : r;
          });
        }
        saveDevRankings(next);
        return next;
      });
      return devRanking;
    }

    const rankRes = await fetch("/api/gunthrank/rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, tier }),
    });
    const { ranking } = await rankRes.json() as { ranking: RankingEntry };
    const gameRes = await fetch(`/api/gunthrank/games?q=${encodeURIComponent("")}`);
    const { games: allGames } = await gameRes.json() as { games: GameCatalogEntry[] };
    const game = allGames.find((g) => g.id === gameId) ?? null;
    const newEntry = { ...ranking, game };
    setRankings((prev) => {
      let next = [...prev, newEntry];
      if (toIndex !== undefined) {
        const inTier = next.filter((r) => r.tier === tier).sort((a, b) => a.sortOrder - b.sortOrder);
        const others = inTier.filter((r) => r.id !== ranking.id);
        const clamped = Math.max(0, Math.min(toIndex, others.length));
        const reordered = [...others.slice(0, clamped), { ...newEntry, sortOrder: clamped }, ...others.slice(clamped)];
        const updates = reordered.map((r, i) => ({ id: r.id, tier: r.tier, sortOrder: i }));
        fetch("/api/gunthrank/rankings/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        }).catch(() => {});
        next = next.map((r) => {
          const idx = reordered.findIndex((rr) => rr.id === r.id);
          return idx >= 0 ? { ...r, sortOrder: idx } : r;
        });
      }
      return next;
    });
    return ranking;
  }, [devMode, rankings]);

  const removeRanking = useCallback(async (gameId: number) => {
    if (devMode) {
      setRankings((prev) => { const next = prev.filter((r) => r.gameId !== gameId); saveDevRankings(next); return next; });
      return;
    }
    await fetch(`/api/gunthrank/rankings?gameId=${gameId}`, { method: "DELETE" });
    setRankings((prev) => prev.filter((r) => r.gameId !== gameId));
  }, [devMode]);

  const moveGame = useCallback(async (rankingId: number, toTier: string, toIndex: number) => {
    setRankings((prev) => {
      const entry = prev.find((r) => r.id === rankingId);
      if (!entry) return prev;
      const othersInTarget = prev.filter((r) => r.tier === toTier && r.id !== rankingId).sort((a, b) => a.sortOrder - b.sortOrder);
      const moved = { ...entry, tier: toTier as TierId, sortOrder: toIndex };
      const reordered = [
        ...othersInTarget.slice(0, toIndex),
        moved,
        ...othersInTarget.slice(toIndex),
      ];
      const updated = prev.map((r) => (r.id === rankingId ? { ...r, tier: toTier as TierId, sortOrder: toIndex } : r));
      if (devMode) {
        const full = updated.map((r) => {
          const inReorder = reordered.find((rr) => rr.id === r.id);
          return inReorder ? { ...r, sortOrder: inReorder.sortOrder } : r;
        });
        saveDevRankings(full);
        return full;
      }
      const updates = reordered.map((r, i) => ({ id: r.id, tier: r.tier, sortOrder: i }));
      fetch("/api/gunthrank/rankings/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      }).catch(() => {});
      return updated;
    });
  }, [devMode]);

  const reorderGame = useCallback(async (rankingId: number, toIndex: number) => {
    setRankings((prev) => {
      const entry = prev.find((r) => r.id === rankingId);
      if (!entry) return prev;
      const tier = entry.tier;
      const sortedFull = prev
        .filter((r) => r.tier === tier)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const srcIdx = sortedFull.findIndex((r) => r.id === rankingId);
      const othersInTier = sortedFull.filter((r) => r.id !== rankingId);
      // If dropping after the source position, account for the removed item shifting indices
      const effectiveIdx = toIndex > srcIdx ? toIndex - 1 : toIndex;
      const clampedIdx = Math.max(0, Math.min(effectiveIdx, othersInTier.length));
      const reordered = [
        ...othersInTier.slice(0, clampedIdx),
        { ...entry, sortOrder: clampedIdx },
        ...othersInTier.slice(clampedIdx),
      ];
      const full = prev.map((r) => {
        const idx = reordered.findIndex((rr) => rr.id === r.id);
        return idx >= 0 ? { ...r, sortOrder: idx } : r;
      });
      if (devMode) {
        saveDevRankings(full);
      } else {
        const updates = reordered.map((r, i) => ({ id: r.id, tier: r.tier, sortOrder: i }));
        fetch("/api/gunthrank/rankings/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        }).catch(() => {});
      }
      return full;
    });
  }, [devMode]);

  const swapGame = useCallback(async (rankingIdA: number, rankingIdB: number) => {
    setRankings((prev) => {
      const entryA = prev.find((r) => r.id === rankingIdA);
      const entryB = prev.find((r) => r.id === rankingIdB);
      if (!entryA || !entryB || entryA.tier !== entryB.tier) return prev;

      const next = prev.map((r) => {
        if (r.id === rankingIdA) return { ...r, sortOrder: entryB.sortOrder };
        if (r.id === rankingIdB) return { ...r, sortOrder: entryA.sortOrder };
        return r;
      });

      if (devMode) {
        saveDevRankings(next);
      } else {
        const updates = [
          { id: rankingIdA, tier: entryA.tier, sortOrder: entryB.sortOrder },
          { id: rankingIdB, tier: entryB.tier, sortOrder: entryA.sortOrder },
        ];
        fetch("/api/gunthrank/rankings/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        }).catch(() => {});
      }
      return next;
    });
  }, [devMode]);

  const updateNote = useCallback(async (rankingId: number, objectiveNote: number | null, noteText: string | null, playedOn?: string | null) => {
    setRankings((prev) => {
      const next = prev.map((r) =>
        r.id === rankingId ? { ...r, objectiveNote, noteText, playedOn: playedOn !== undefined ? playedOn : r.playedOn } : r
      );
      if (devMode) saveDevRankings(next);
      return next;
    });
    if (devMode) return;
    const entry = rankings.find((r) => r.id === rankingId);
    if (!entry) return;
    await fetch("/api/gunthrank/rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: entry.gameId, tier: entry.tier, objectiveNote, noteText, playedOn }),
    });
  }, [rankings, devMode]);

  const filteredRankings = useMemo(() => {
    return rankings.filter((r) => {
      if (filters.tiers.length > 0 && !filters.tiers.includes(r.tier as TierId)) return false;
      const game = r.game;
      if (!game) return true;
      if (filters.platform && game.platforms) {
        const platforms: string[] = JSON.parse(game.platforms);
        if (!platforms.includes(filters.platform)) return false;
      }
      if (filters.genre && game.genres) {
        const genres: string[] = JSON.parse(game.genres);
        if (!genres.includes(filters.genre)) return false;
      }
      if (filters.year && game.releaseDate && game.releaseDate !== filters.year) return false;
      return true;
    });
  }, [rankings, filters]);

  const allPlatforms = useMemo(() => {
    const set = new Set<string>();
    rankings.forEach((r) => {
      if (r.game?.platforms) {
        (JSON.parse(r.game.platforms) as string[]).forEach((p) => set.add(p));
      }
    });
    return [...set].sort();
  }, [rankings]);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    rankings.forEach((r) => {
      if (r.game?.genres) {
        (JSON.parse(r.game.genres) as string[]).forEach((g) => set.add(g));
      }
    });
    return [...set].sort();
  }, [rankings]);

  const allYears = useMemo(() => {
    const set = new Set<number>();
    rankings.forEach((r) => {
      if (r.game?.releaseDate) set.add(r.game.releaseDate);
    });
    return [...set].sort((a, b) => b - a);
  }, [rankings]);

  return {
    viewMode, setViewMode,
    devMode, setDevMode,
    rankings: filteredRankings,
    allRankings: rankings,
    loading,
    viewedUser,
    selectedUserId,
    availableUsers,
    fetchAvailableUsers,
    selectUser,
    goToMyRankings,
    filters, setFilters,
    allPlatforms, allGenres, allYears,
    fetchGames, searchIgdb,
    addGame, addFromCatalog, removeRanking, moveGame, reorderGame, swapGame, updateNote,
  };
}
