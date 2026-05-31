"use client";

import { useState, useEffect, useRef } from "react";
import { useSoundContext } from "@/lib/contexts/sound-context";
import { getPlatformColor, type RankingEntry } from "../constants";

interface GameDetailModalProps {
  ranking: RankingEntry;
  readOnly?: boolean;
  onClose: () => void;
  onRemove?: (gameId: number) => void;
}

/** Pixels of mouse movement before a drag activates (avoids accidental drag on click). */
const DRAG_THRESHOLD = 4;

export function GameDetailModal({ ranking, readOnly, onClose, onRemove }: GameDetailModalProps) {
  const { playClick, playDelete } = useSoundContext();
  const game = ranking.game!;
  const [commStats, setCommStats] = useState<{ avgNote: number | null; count: number } | null>(null);
  const [fallbackVideos, setFallbackVideos] = useState<Array<{ videoId: string; name: string | null }> | null>(null);
  const [videoExpanded, setVideoExpanded] = useState(false);

  // ── Draggable panel state ──
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPanelX: number;
    startPanelY: number;
    dragging: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Center the panel on first render
  useEffect(() => {
    if (panelPos) return;
    const w = videoExpanded ? window.innerWidth : 480;
    setPanelPos({
      x: Math.max(0, (window.innerWidth - w) / 2),
      y: Math.max(0, (window.innerHeight - 500) / 2),
    });
    // We only want this on mount — expanded changes should NOT re-center
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drag handlers ──
  const handlePanelMouseDown = (e: React.MouseEvent) => {
    // Don't start drag on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, iframe, details, summary, a, [data-no-drag]")) return;
    // Don't drag when video is expanded (fullscreen-like mode)
    if (videoExpanded) return;

    e.preventDefault();
    const pos = panelPos ?? { x: 0, y: 0 };
    dragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPanelX: pos.x,
      startPanelY: pos.y,
      dragging: false,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startMouseX;
      const dy = ev.clientY - dragRef.current.startMouseY;
      if (!dragRef.current.dragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        dragRef.current.dragging = true;
        setIsDragging(true);
      }
      if (dragRef.current.dragging) {
        setPanelPos({
          x: dragRef.current.startPanelX + dx,
          y: dragRef.current.startPanelY + dy,
        });
      }
    };

    const onMouseUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    fetch(`/api/gunthrank/games/${game.id}/community-stats`)
      .then((r) => r.json())
      .then((d) => setCommStats(d as { avgNote: number | null; count: number }))
      .catch(() => {});
  }, [game.id]);

  // Fetch videos on-the-fly for games that don't have them stored yet
  useEffect(() => {
    if (!game.igdbId) return;
    const existing = (() => {
      if (!game.videos) return [];
      try { return JSON.parse(game.videos as string); } catch { return []; }
    })();
    if (existing.length > 0) return; // already has videos
    fetch(`/api/igdb/videos?igdbId=${game.igdbId}`)
      .then((r) => r.json())
      .then((d) => { if (d.videos?.length) setFallbackVideos(d.videos); })
      .catch(() => {});
  }, [game.igdbId, game.videos]);

  const platforms: string[] = (() => {
    if (!game.platforms) return [];
    try { return JSON.parse(game.platforms); } catch { return []; }
  })();

  const genres: string[] = (() => {
    if (!game.genres) return [];
    try { return JSON.parse(game.genres); } catch { return []; }
  })();

  const videos: Array<{ videoId: string; name: string | null }> = (() => {
    const stored = (() => {
      if (!game.videos) return [];
      try { return JSON.parse(game.videos as string); } catch { return []; }
    })();
    if (stored.length > 0) return stored;
    if (fallbackVideos) return fallbackVideos;
    return [];
  })();

  if (!panelPos) return null; // wait for initial position

  return (
    <div
      ref={panelRef}
      onMouseDown={handlePanelMouseDown}
      className="flex flex-col gap-3 p-4 overflow-auto"
      style={{
        position: "fixed",
        zIndex: 100,
        left: videoExpanded ? 0 : panelPos.x,
        top: videoExpanded ? 0 : panelPos.y,
        background: videoExpanded ? "#000" : "var(--t-bg)",
        borderTop: "2px solid var(--t-border-light)",
        borderLeft: "2px solid var(--t-border-light)",
        borderBottom: "2px solid var(--t-border-dark)",
        borderRight: "2px solid var(--t-border-dark)",
        width: videoExpanded ? "100%" : 480,
        height: videoExpanded ? "100%" : "auto",
        maxHeight: videoExpanded ? "none" : "calc(100vh - 40px)",
        color: "var(--t-text)",
        fontSize: "var(--t-text-sm)",
        cursor: isDragging ? "grabbing" : "default",
        userSelect: isDragging ? "none" : undefined,
        transition: videoExpanded ? "width 0.2s ease, height 0.2s ease, left 0.2s, top 0.2s" : undefined,
      }}
    >
      {/* Close button */}
      <button
        onClick={() => { playClick(); if (videoExpanded) setVideoExpanded(false); else onClose(); }}
        className="absolute top-2 right-2 px-2 py-0.5 font-bold"
        style={{
          fontSize: "var(--t-text-xs)",
          background: "var(--t-bg-dark)",
          color: "var(--t-text)",
          borderTop: "2px solid var(--t-border-light)",
          borderLeft: "2px solid var(--t-border-light)",
          borderBottom: "2px solid var(--t-border-dark)",
          borderRight: "2px solid var(--t-border-dark)",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        ✕
      </button>

      {/* Cover art — hide when expanded */}
      {!videoExpanded && (
      <div className="flex justify-center">
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt={game.name}
            style={{
              maxHeight: 200,
              objectFit: "contain",
              border: "2px solid var(--t-border-dark)",
            }}
          />
        ) : (
          <div
            className="flex items-center justify-center"
            style={{
              width: 140,
              height: 200,
              background: "var(--t-bg-dark)",
              border: "2px solid var(--t-border-dark)",
              fontSize: "var(--t-text-3xl)",
            }}
          >
            🎮
          </div>
        )}
      </div>
      )}

      {/* Trailer */}
      {videos.length > 0 && (() => {
        const trailer = videos[0]!;
        return (
        <div
          data-no-drag
          style={{
            position: "relative",
            paddingBottom: videoExpanded ? undefined : "56.25%",
            height: videoExpanded ? "100%" : 0,
            overflow: "hidden",
            border: videoExpanded ? "none" : "2px solid var(--t-border-dark)",
            background: "#000",
            flex: videoExpanded ? 1 : undefined,
          }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${trailer.videoId}?modestbranding=1&rel=0`}
            title={trailer.name ?? "Trailer"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
          <button
            onClick={() => setVideoExpanded(!videoExpanded)}
            className="absolute flex items-center justify-center"
            style={{
              bottom: 6,
              right: 6,
              width: 30,
              height: 28,
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              cursor: "pointer",
              fontSize: "var(--t-text-md)",
              borderRadius: 2,
              zIndex: 2,
              lineHeight: 1,
            }}
            title={videoExpanded ? "Réduire" : "Plein écran"}
          >
            {videoExpanded ? "✕" : "⛶"}
          </button>
        </div>
        );
      })()}

      {!videoExpanded && (
      <>
      {/* Name */}
      <h2 style={{ fontSize: "var(--t-text-lg)", fontWeight: 700, textAlign: "center" }}>
        {game.name}
        {game.releaseDate && (
          <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", marginLeft: 8 }}>
            ({game.releaseDate})
          </span>
        )}
      </h2>

      {/* Platforms */}
      {platforms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {platforms.map((p) => {
            const color = getPlatformColor(p);
            return (
              <span
                key={p}
                className="px-2 py-0.5"
                style={{
                  fontSize: "var(--t-text-xs)",
                  background: color ? `${color}44` : "var(--t-bg-dark)",
                  color: color ?? "var(--t-text)",
                  border: `1px solid ${color ?? "var(--t-border-dark)"}`,
                }}
              >
                {p}
              </span>
            );
          })}
        </div>
      )}

      {/* Genres */}
      {genres.length > 0 && (
        <div style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
          {genres.join(" · ")}
        </div>
      )}

      {/* Summary — French if available, otherwise English */}
      {(game.summaryFr || game.summary) && (
        <div>
          <div style={{ fontSize: "var(--t-text-xs)", fontWeight: 600, marginBottom: 4 }}>
            Résumé
          </div>
          <p style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", lineHeight: 1.5 }}>
            {(() => {
              const text = game.summaryFr ?? game.summary!;
              return text.length > 600 ? text.slice(0, 600) + "…" : text;
            })()}
          </p>
          {game.summaryFr && game.summary && (
            <details style={{ marginTop: 4 }}>
              <summary style={{ fontSize: "calc(var(--t-text-xs) * 0.8)", color: "var(--t-text-muted)", cursor: "pointer" }}>
                Voir l'original (EN)
              </summary>
              <p style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", lineHeight: 1.5, marginTop: 4 }}>
                {game.summary.length > 600 ? game.summary.slice(0, 600) + "…" : game.summary}
              </p>
            </details>
          )}
        </div>
      )}

      <hr style={{ borderColor: "var(--t-border-dark)" }} />

      {/* User's note */}
      <div>
        <div style={{ fontSize: "var(--t-text-xs)", fontWeight: 600, marginBottom: 4 }}>
          Ma note
        </div>
        <div className="flex items-center gap-3">
          {ranking.objectiveNote != null ? (
            <>
              <span style={{ fontSize: "var(--t-text-md)", fontWeight: 700 }}>
                {ranking.objectiveNote}/10
              </span>
              <div
                className="flex-1"
                style={{
                  height: 8,
                  background: "var(--t-bg-dark)",
                  border: "1px solid var(--t-border-dark)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(ranking.objectiveNote / 10) * 100}%`,
                    background: "var(--t-accent)",
                  }}
                />
              </div>
            </>
          ) : (
            <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
              Pas encore noté
            </span>
          )}
        </div>
        {ranking.noteText && (
          <p style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", marginTop: 4, fontStyle: "italic" }}>
            &ldquo;{ranking.noteText}&rdquo;
          </p>
        )}
      </div>

      {/* Community stats */}
      <div>
        <div style={{ fontSize: "var(--t-text-xs)", fontWeight: 600, marginBottom: 4 }}>
          Communauté
        </div>
        {commStats ? (
          commStats.count > 0 ? (
            <span style={{ fontSize: "var(--t-text-sm)" }}>
              Moyenne : <strong>{commStats.avgNote}/10</strong> ({commStats.count} vote{commStats.count > 1 ? "s" : ""})
            </span>
          ) : (
            <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
              Pas encore noté par la communauté
            </span>
          )
        ) : (
          <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
            Chargement...
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {!readOnly && onRemove && (
          <button
            onClick={() => { playDelete(); onRemove(game.id); onClose(); }}
            className="px-3 py-1"
            style={{
              fontSize: "var(--t-text-xs)",
              background: "var(--t-error)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Retirer du classement
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => { playClick(); onClose(); }}
          className="px-3 py-1"
          style={{
            fontSize: "var(--t-text-xs)",
            background: "var(--t-bg-dark)",
            color: "var(--t-text)",
            borderTop: "2px solid var(--t-border-light)",
            borderLeft: "2px solid var(--t-border-light)",
            borderBottom: "2px solid var(--t-border-dark)",
            borderRight: "2px solid var(--t-border-dark)",
            cursor: "pointer",
          }}
        >
          Fermer
        </button>
      </div>
      </>
      )}
    </div>
  );
}
