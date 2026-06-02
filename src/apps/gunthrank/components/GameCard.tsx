"use client";

import { useState } from "react";
import { useKiffTheme } from "../kiff-theme-context";
import { getPlatformColor, type RankingEntry } from "../constants";

interface GameCardProps {
  ranking: RankingEntry;
  readOnly?: boolean;
  isNew?: boolean;
  onRemove?: (gameId: number) => void;
  onUpdateNote?: (rankingId: number, objectiveNote: number | null, noteText: string | null, playedOn?: string | null) => void;
  onDetailClick?: (ranking: RankingEntry) => void;
  onDragStartCard?: (ranking: RankingEntry, x: number, y: number) => void;
}

export function GameCard({ ranking, readOnly, isNew, onRemove, onUpdateNote, onDetailClick, onDragStartCard }: GameCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [noteValue, setNoteValue] = useState(ranking.objectiveNote ?? 5);
  const [noteText, setNoteText] = useState(ranking.noteText ?? "");
  const [playedOn, setPlayedOn] = useState(ranking.playedOn ?? "");

  const { theme } = useKiffTheme();
  const coverUrl = ranking.game?.coverUrl;
  const gameName = ranking.game?.name ?? "Inconnu";
  const platformColor = getPlatformColor(ranking.playedOn);
  const hasNote = ranking.objectiveNote != null;

  const cardBorderTop = theme.cardPlatform === "fill" && platformColor
    ? `2px solid ${platformColor}`
    : theme.cardPlatform === "border" && platformColor
      ? `2px solid ${platformColor}88`
      : "2px solid var(--t-border-light)";
  const cardBorderLeft = cardBorderTop;
  const cardBg = theme.cardPlatform === "fill" && platformColor
    ? platformColor
    : "var(--t-card-bg)";

  let platforms: string[] = [];
  try {
    if (typeof ranking.game?.platforms === "string") platforms = JSON.parse(ranking.game.platforms);
  } catch { /* ignore malformed JSON */ }

  const handleDragStart = (e: React.DragEvent) => {
    if (readOnly) return;
    e.dataTransfer.setData("text/plain", String(ranking.id));
    e.dataTransfer.effectAllowed = "move";
    // Hide browser's semi-transparent ghost — we render our own opaque floating card
    const emptyImg = document.createElement("canvas");
    emptyImg.width = 1;
    emptyImg.height = 1;
    e.dataTransfer.setDragImage(emptyImg, 0, 0);
    setIsDragging(true);
    onDragStartCard?.(ranking, e.clientX, e.clientY);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleSaveNote = () => {
    onUpdateNote?.(ranking.id, noteValue, noteText || null, playedOn || null);
    setExpanded(false);
  };

  const handleCancel = () => {
    setNoteValue(ranking.objectiveNote ?? 5);
    setNoteText(ranking.noteText ?? "");
    setPlayedOn(ranking.playedOn ?? "");
    setExpanded(false);
  };

  return (
    <div
      draggable={!readOnly}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`flex-shrink-0 rounded cursor-grab active:cursor-grabbing select-none overflow-hidden${isNew ? " animate-[pop_0.3s_ease-out]" : ""}`}
      style={{
        width: 140,
        background: cardBg,
        borderTop: isDragging ? "2px dashed var(--t-accent)" : cardBorderTop,
        borderLeft: isDragging ? "2px dashed var(--t-accent)" : cardBorderLeft,
        borderBottom: isDragging ? "2px dashed var(--t-accent)" : "2px solid var(--t-border-dark)",
        borderRight: isDragging ? "2px dashed var(--t-accent)" : "2px solid var(--t-border-dark)",
        opacity: isDragging ? 0.25 : 1,
        transition: "opacity 0.12s",
      }}
    >
      {/* Cover image + name overlay */}
      <div
        className="relative w-full cursor-pointer"
        style={{ aspectRatio: "2/3" }}
        onClick={() => { if (readOnly) { onDetailClick?.(ranking); } else { setExpanded(!expanded); } }}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={gameName}
            className="w-full h-full object-cover"
            loading="lazy"
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

        {/* Balatro-style bottom banner */}
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col justify-end"
          style={{
            height: "36%",
            background: `
              linear-gradient(180deg,
                transparent 0%,
                rgba(0,0,0,0.3) 15%,
                rgba(10,10,26,0.88) 40%,
                rgba(10,10,26,0.96) 100%
              ),
              repeating-linear-gradient(
                -35deg,
                transparent,
                transparent 3px,
                rgba(255,255,255,0.015) 3px,
                rgba(255,255,255,0.015) 6px
              )
            `,
            borderTop: "1.5px solid rgba(255,255,255,0.25)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            padding: "6px 6px 5px 6px",
          }}
        >
          {/* Decorative accent line */}
          <div
            className="w-full flex-shrink-0"
            style={{
              height: 2,
              background: "var(--t-accent)",
              opacity: 0.7,
              borderRadius: 1,
              marginBottom: 3,
            }}
          />

          {/* Game name */}
          <div
            className="text-center leading-tight flex-shrink-0"
            style={{
              fontSize: "calc(var(--t-text-xs) * 0.88)",
              color: "#fff",
              fontWeight: 700,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              letterSpacing: "0.01em",
            }}
            title={gameName}
          >
            {gameName}
          </div>

          {/* Click hint — subtle pulsing dots */}
          {!readOnly && (
            <div
              className="flex items-center justify-center gap-1 flex-shrink-0"
              style={{ marginTop: 2, opacity: 0.6 }}
            >
              <span style={{ fontSize: "6px", color: "var(--t-accent)", lineHeight: 1 }}>◆</span>
              <span style={{ fontSize: "6px", color: "var(--t-accent)", lineHeight: 1, opacity: 0.5 }}>◆</span>
              <span style={{ fontSize: "6px", color: "var(--t-accent)", lineHeight: 1, opacity: 0.25 }}>◆</span>
            </div>
          )}
        </div>

        {/* Note badge + edit button */}
        {hasNote && (
          <div
            className="absolute top-0.5 right-0.5 px-1 py-0.5 font-bold rounded"
            style={{
              fontSize: "calc(var(--t-text-xs) * 0.75)",
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              lineHeight: 1,
            }}
          >
            {ranking.objectiveNote}/10
          </div>
        )}
        <button
          className="absolute top-0.5 left-0.5 w-7 h-7 flex items-center justify-center rounded opacity-60 hover:opacity-100"
          style={{
            fontSize: "calc(var(--t-text-xs) * 0.9)",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            lineHeight: 1,
          }}
          onClick={(e) => { e.stopPropagation(); onDetailClick?.(ranking); }}
          title="Voir la fiche"
        >
          🔍
        </button>
      </div>

      {/* Expanded: note inputs + platform */}
      {expanded && !readOnly && (
        <div
          className="p-2 border-t flex flex-col gap-1.5"
          style={{ borderColor: "var(--t-border-dark)", background: "var(--t-bg)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Platform selector */}
          {platforms.length > 0 && (
            <div>
              <label style={{ fontSize: "calc(var(--t-text-xs) * 0.82)", color: "var(--t-text-muted)", display: "block", marginBottom: 1 }}>
                Plateforme :
              </label>
              <select
                value={playedOn}
                onChange={(e) => setPlayedOn(e.target.value)}
                className="px-1 py-0.5 w-full"
                style={{
                  fontSize: "calc(var(--t-text-xs) * 0.82)",
                  background: "var(--t-app-bg)",
                  color: "var(--t-text)",
                  borderTop: "2px solid var(--t-border-dark)",
                  borderLeft: "2px solid var(--t-border-dark)",
                  borderBottom: "2px solid var(--t-border-light)",
                  borderRight: "2px solid var(--t-border-light)",
                }}
              >
                <option value="">Non précisé</option>
                {platforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note slider */}
          <div>
            <label style={{ fontSize: "calc(var(--t-text-xs) * 0.82)", color: "var(--t-text-muted)" }}>
              Note : <strong>{noteValue}/10</strong>
            </label>
            <input
              type="range"
              min={0} max={10} step={1}
              value={noteValue}
              onChange={(e) => setNoteValue(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>

          {/* Personal note */}
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Note perso..."
            className="w-full p-1"
            style={{
              fontSize: "var(--t-text-xs)",
              background: "var(--t-bg)",
              color: "var(--t-text)",
              borderTop: "2px solid var(--t-border-dark)",
              borderLeft: "2px solid var(--t-border-dark)",
              borderBottom: "2px solid var(--t-border-light)",
              borderRight: "2px solid var(--t-border-light)",
              resize: "none",
              height: 48,
            }}
            rows={2}
          />

          {/* Action buttons — Sauver full-width, then Annuler + Retirer */}
          <button
            onClick={handleSaveNote}
            className="px-2 py-1 font-bold w-full"
            style={{
              fontSize: "var(--t-text-xs)",
              background: "var(--t-accent)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Sauver
          </button>
          <div className="flex gap-1">
            <button
              onClick={handleCancel}
              className="px-2 py-0.5 flex-1"
              style={{
                fontSize: "calc(var(--t-text-xs) * 0.9)",
                background: "var(--t-bg-dark)",
                color: "var(--t-text)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
            {onRemove && (
              <button
                onClick={() => onRemove?.(ranking.gameId)}
                className="px-2 py-0.5 flex-1"
                style={{
                  fontSize: "calc(var(--t-text-xs) * 0.9)",
                  background: "var(--t-error)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Retirer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
