"use client";

import { useState, useCallback } from "react";
import type { RankingEntry, TierId } from "../constants";
import { GameCard } from "./GameCard";
import { GameRow } from "./GameRow";

const NUMBERED_TIERS = new Set<TierId>(["diamond", "gold", "silver", "bronze"]);

interface TierRowProps {
  tier: { id: TierId; label: string; emoji: string; color: string };
  games: RankingEntry[];
  readOnly?: boolean;
  viewLayout: "list" | "grid";
  recentlyMovedIds?: Set<number>;
  onDrop: (rankingId: number, toTier: TierId, toIndex?: number) => void;
  onAddFromCatalog?: (gameId: number, toTier: TierId, toIndex?: number) => void;
  onAddFromIgdb?: (game: import("../constants").IgdbSearchResult, toTier: TierId, toIndex?: number) => void;
  onRemove?: (gameId: number) => void;
  onUpdateNote?: (rankingId: number, objectiveNote: number | null, noteText: string | null, playedOn?: string | null) => void;
  onMove?: (rankingId: number, toTier: TierId) => void;
  onReorder?: (rankingId: number, toIndex: number) => void;
  onSwap?: (rankingId: number, targetRankingId: number) => void;
  onDetailClick?: (ranking: RankingEntry) => void;
  globalRankOffset?: number;
}

export function TierRow({ tier, games, readOnly, viewLayout, recentlyMovedIds, onDrop, onAddFromCatalog, onAddFromIgdb, onRemove, onUpdateNote, onMove, onReorder, onSwap, onDetailClick, globalRankOffset }: TierRowProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropIndex, setDropIndex] = useState<{ idx: number; before: boolean } | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<number | null>(null);
  const [insertTarget, setInsertTarget] = useState<{ rankingId: number; before: boolean } | null>(null);
  const [dragState, setDragState] = useState<{ ranking: RankingEntry; x: number; y: number } | null>(null);

  const showRankNumbers = NUMBERED_TIERS.has(tier.id);

  // ── Floating card preview ──
  const handleCardDragStart = useCallback((ranking: RankingEntry, x: number, y: number) => {
    setDragState({ ranking, x, y });
  }, []);

  const clearDragState = useCallback(() => {
    setDragState(null);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setDragOver(false);
    setSwapTargetId(null);
    setInsertTarget(null);
    setDragState(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (raw.startsWith("igdb:")) {
      try {
        const game = JSON.parse(raw.slice(5));
        onAddFromIgdb?.(game, tier.id, games.length);
      } catch { /* ignore malformed drop */ }
    } else if (raw.startsWith("catalog:") || raw.startsWith("new:")) {
      const gameId = parseInt(raw.includes("catalog:") ? raw.slice(8) : raw.slice(4), 10);
      if (!isNaN(gameId)) onAddFromCatalog?.(gameId, tier.id, games.length);
    } else {
      const rankingId = parseInt(raw, 10);
      if (!isNaN(rankingId)) {
        const entry = games.find((g) => g.id === rankingId);
        if (entry && entry.tier === tier.id) return;
        onDrop(rankingId, tier.id);
      }
    }
  };

  const handleItemDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const before = e.clientY < midY;
    setDropIndex({ idx: index, before });
  }, [readOnly]);

  const handleItemDrop = useCallback((e: React.DragEvent, index: number) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setDropIndex(null);
    const raw = e.dataTransfer.getData("text/plain");
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const before = e.clientY < midY;
    const toIndex = before ? index : index + 1;

    // Catalog / IGDB drops at a specific position
    if (raw.startsWith("igdb:")) {
      try {
        const game = JSON.parse(raw.slice(5));
        onAddFromIgdb?.(game, tier.id, toIndex);
      } catch { /* ignore malformed drop */ }
      return;
    }
    if (raw.startsWith("catalog:") || raw.startsWith("new:")) {
      const gameId = parseInt(raw.includes("catalog:") ? raw.slice(8) : raw.slice(4), 10);
      if (!isNaN(gameId)) onAddFromCatalog?.(gameId, tier.id, toIndex);
      return;
    }

    // Existing ranking reorder
    const rankingId = parseInt(raw, 10);
    if (isNaN(rankingId)) return;
    const entry = games.find((g) => g.id === rankingId);
    if (!entry) return;
    if (entry.tier !== tier.id) {
      onDrop(rankingId, tier.id, toIndex);
      return;
    }
    if (!onReorder) return;
    onReorder(rankingId, toIndex);
  }, [readOnly, games, tier.id, onDrop, onReorder, onAddFromCatalog, onAddFromIgdb]);

  const handleItemDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDropIndex(null);
    }
  }, []);

  // ── Grid mode: 3-zone handlers (insert before / swap / insert after) ──
  //
  // Each card is split horizontally into 3 zones:
  //   ▐███▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓███▌
  //   ▐███▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓███▌
  //    ← insert    ↕ swap    insert →
  //    before                after
  //
  const handleGridItemDragOver = useCallback((e: React.DragEvent, rankingId: number) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const ratio = relX / rect.width;

    if (ratio < 0.3) {
      // Left edge — insert before this card
      setSwapTargetId(null);
      setInsertTarget({ rankingId, before: true });
    } else if (ratio > 0.7) {
      // Right edge — insert after this card
      setSwapTargetId(null);
      setInsertTarget({ rankingId, before: false });
    } else {
      // Center — swap with this card
      setInsertTarget(null);
      setSwapTargetId((prev) => (prev === rankingId ? prev : rankingId));
    }
  }, [readOnly]);

  const handleGridItemDrop = useCallback((e: React.DragEvent, targetRankingId: number, targetIndex: number) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const ratio = relX / rect.width;
    const inLeftZone = ratio < 0.3;
    const inRightZone = ratio > 0.7;

    setSwapTargetId(null);
    setInsertTarget(null);
    setDragState(null);

    const raw = e.dataTransfer.getData("text/plain");

    // Determine the effective insert index based on zone
    const effectiveIndex = inLeftZone ? targetIndex : inRightZone ? targetIndex + 1 : targetIndex;

    // Catalog / IGDB drops — always insert, never swap
    if (raw.startsWith("igdb:")) {
      try {
        const game = JSON.parse(raw.slice(5));
        onAddFromIgdb?.(game, tier.id, effectiveIndex);
      } catch { /* ignore malformed drop */ }
      return;
    }
    if (raw.startsWith("catalog:") || raw.startsWith("new:")) {
      const gameId = parseInt(raw.includes("catalog:") ? raw.slice(8) : raw.slice(4), 10);
      if (!isNaN(gameId)) onAddFromCatalog?.(gameId, tier.id, effectiveIndex);
      return;
    }

    // Existing ranking
    const rankingId = parseInt(raw, 10);
    if (isNaN(rankingId)) return;

    const entry = games.find((g) => g.id === rankingId);
    if (!entry) {
      // From another tier — insert at target position
      onDrop(rankingId, tier.id, effectiveIndex);
      return;
    }

    // Same tier
    if (rankingId === targetRankingId) return; // dropped on itself

    if (inLeftZone || inRightZone) {
      // Edge zone — insert at position
      onReorder?.(rankingId, effectiveIndex);
    } else {
      // Center zone — swap
      onSwap?.(rankingId, targetRankingId);
    }
  }, [readOnly, games, tier.id, onDrop, onReorder, onSwap, onAddFromCatalog, onAddFromIgdb]);

  const handleGridItemDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setSwapTargetId(null);
      setInsertTarget(null);
    }
  }, []);

  const sorted = [...games].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="rounded flex flex-col"
      style={{
        background: dragOver ? "var(--t-accent-hover)" : "var(--t-bg-dark)",
        borderTop: "2px solid var(--t-border-light)",
        borderLeft: "2px solid var(--t-border-light)",
        borderBottom: "2px solid var(--t-border-dark)",
        borderRight: "2px solid var(--t-border-dark)",
        transition: "background 0.15s",
      }}
    >
      {/* Header — clickable to collapse */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0 w-full text-left"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--t-text)",
          borderBottom: collapsed ? "none" : "1px solid var(--t-border-dark)",
        }}
      >
        <span style={{ fontSize: "var(--t-text-md)", transition: "transform 0.15s", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
          ▼
        </span>
        <span style={{ fontSize: "var(--t-text-lg)" }}>{tier.emoji}</span>
        <span className="font-bold" style={{ fontSize: "var(--t-text-sm)", color: tier.color }}>
          {tier.label}
        </span>
        <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
          · {games.length} jeu{games.length !== 1 ? "x" : ""}
        </span>
      </button>

      {/* Game list */}
      {!collapsed && (
        viewLayout === "grid" ? (
          <div
            className="flex gap-2 p-2 flex-1 overflow-auto flex-wrap"
            onDragOverCapture={(e) => {
              // Capture phase: track mouse for floating preview, fires even if children stopPropagation
              setDragState((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
            }}
            onDragEndCapture={() => setDragState(null)}
          >
            {sorted.map((r, index) => {
              const isSwapTarget = swapTargetId === r.id;
              const isInsertBefore = insertTarget?.rankingId === r.id && insertTarget?.before;
              const isInsertAfter = insertTarget?.rankingId === r.id && !insertTarget?.before;
              return (
                <div
                  key={r.id}
                  onDragOver={(e) => handleGridItemDragOver(e, r.id)}
                  onDragLeave={handleGridItemDragLeave}
                  onDrop={(e) => handleGridItemDrop(e, r.id, index)}
                  className="rounded"
                  style={{
                    // ── Swap glow ──
                    outline: isSwapTarget ? "3px solid var(--t-accent)" : "3px solid transparent",
                    outlineOffset: 3,
                    boxShadow: isSwapTarget ? "0 0 16px 4px var(--t-accent)" : "none",
                    filter: isSwapTarget ? "brightness(1.2)" : "none",
                    transform: isSwapTarget ? "scale(1.07)" : "scale(1)",
                    // ── Insert bars ──
                    borderLeft: isInsertBefore ? "4px solid var(--t-accent)" : "4px solid transparent",
                    borderRight: isInsertAfter ? "4px solid var(--t-accent)" : "4px solid transparent",
                    // ── Shared ──
                    transition: "outline 0.12s, box-shadow 0.12s, filter 0.12s, transform 0.12s, border 0.08s",
                    zIndex: isSwapTarget ? 2 : isInsertBefore || isInsertAfter ? 1 : 0,
                    position: "relative",
                  }}
                >
                  {/* Insert arrow indicator */}
                  {(isInsertBefore || isInsertAfter) && (
                    <div
                      className="absolute flex items-center justify-center"
                      style={{
                        top: 0,
                        bottom: 0,
                        [isInsertBefore ? "left" : "right"]: -10,
                        width: 20,
                        color: "var(--t-accent)",
                        fontSize: "var(--t-text-lg)",
                        fontWeight: "bold",
                        zIndex: 5,
                        pointerEvents: "none",
                        textShadow: "0 0 8px var(--t-accent)",
                      }}
                    >
                      {isInsertBefore ? "◀" : "▶"}
                    </div>
                  )}
                  <GameCard
                    ranking={r}
                    readOnly={readOnly}
                    isNew={recentlyMovedIds?.has(r.id)}
                    onRemove={onRemove}
                    onUpdateNote={onUpdateNote}
                    onDetailClick={onDetailClick}
                    onDragStartCard={handleCardDragStart}
                  />
                </div>
              );
            })}
            {games.length === 0 && (
              <div
                className="flex items-center justify-center w-full flex-1"
                style={{ color: "var(--t-text-muted)", fontSize: "var(--t-text-xs)", minHeight: 80 }}
              >
                {readOnly ? "Aucun jeu" : "Glisse un jeu ici"}
              </div>
            )}
          </div>
        ) : (
          <div
            className="gap-2 p-2 flex-1 overflow-auto"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              alignContent: "start",
            }}
          >
            {sorted.map((r, index) => {
              const rankNum = showRankNumbers ? (globalRankOffset ?? 0) + index + 1 : null;
              const isDropBefore = dropIndex?.idx === index && dropIndex?.before;
              const isDropAfter = dropIndex?.idx === index && !dropIndex?.before;
              return (
                <div
                  key={r.id}
                  onDragOver={(e) => handleItemDragOver(e, index)}
                  onDragLeave={handleItemDragLeave}
                  onDrop={(e) => handleItemDrop(e, index)}
                  style={{
                    borderTop: isDropBefore ? "2px solid var(--t-accent)" : "2px solid transparent",
                    borderBottom: isDropAfter ? "2px solid var(--t-accent)" : "2px solid transparent",
                  }}
                >
                  <GameRow
                    ranking={r}
                    readOnly={readOnly}
                    isNew={recentlyMovedIds?.has(r.id)}
                    onRemove={onRemove}
                    onUpdateNote={onUpdateNote}
                    onMove={onMove}
                    onDetailClick={onDetailClick}
                    rankNumber={rankNum}
                  />
                </div>
              );
            })}
            {games.length === 0 && (
              <div
                className="flex items-center justify-center"
                style={{ color: "var(--t-text-muted)", fontSize: "var(--t-text-xs)", minHeight: 64 }}
              >
                {readOnly ? "Aucun jeu" : "Glisse un jeu ici"}
              </div>
            )}
          </div>
        )
      )}

      {/* Floating drag preview — fully opaque, follows cursor, no browser ghost */}
      {dragState && (
        <div
          style={{
            position: "fixed",
            left: dragState.x - 70,
            top: dragState.y - 15,
            width: 140,
            aspectRatio: "2/3",
            zIndex: 9999,
            pointerEvents: "none",
            opacity: 1,
            transform: "rotate(-3deg)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 2px var(--t-accent)",
            borderRadius: 4,
            overflow: "hidden",
            background: "var(--t-card-bg, #1a1a2e)",
          }}
        >
          {dragState.ranking.game?.coverUrl ? (
            <img
              src={dragState.ranking.game.coverUrl}
              alt={dragState.ranking.game.name ?? ""}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: "var(--t-bg-dark)" }}
            >
              <span style={{ fontSize: "var(--t-text-2xl)" }}>🎮</span>
            </div>
          )}
          <div
            className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
            style={{
              background: "linear-gradient(transparent, rgba(0,0,0,0.9))",
            }}
          >
            <div
              className="text-center leading-tight"
              style={{
                fontSize: "calc(var(--t-text-xs) * 0.82)",
                color: "#fff",
                textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {dragState.ranking.game?.name ?? "Inconnu"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
