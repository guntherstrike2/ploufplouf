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
    onUpdateNote?.(ranking.id, noteValue, noteText || null);
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
        className="relative w-full"
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

        {/* Name overlay at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
          style={{
            background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          }}
        >
          <div
            className="text-center leading-tight"
            style={{
              fontSize: "calc(var(--t-text-xs) * 0.82)",
              color: "#fff",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}
            title={gameName}
          >
            {gameName}
          </div>
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
          className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded opacity-70 hover:opacity-100"
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

      {/* Expanded: note inputs */}
      {expanded && !readOnly && (
        <div
          className="p-2 border-t"
          style={{ borderColor: "var(--t-border-dark)", background: "var(--t-bg)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <label style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
            Note objective : {noteValue}/10
          </label>
          <input
            type="range"
            min={0} max={10} step={1}
            value={noteValue}
            onChange={(e) => setNoteValue(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Note perso..."
            className="w-full mt-1 p-1"
            style={{
              fontSize: "var(--t-text-xs)",
              background: "var(--t-bg)",
              color: "var(--t-text)",
              borderTop: "2px solid var(--t-border-dark)",
              borderLeft: "2px solid var(--t-border-dark)",
              borderBottom: "2px solid var(--t-border-light)",
              borderRight: "2px solid var(--t-border-light)",
              resize: "none",
              height: 56,
            }}
            rows={3}
          />
          <div className="flex justify-between mt-1">
            <button
              onClick={handleSaveNote}
              className="px-2 py-0.5"
              style={{
                fontSize: "var(--t-text-xs)",
                background: "var(--t-accent)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              OK
            </button>
            <button
              onClick={() => onRemove?.(ranking.gameId)}
              className="px-2 py-0.5"
              style={{
                fontSize: "var(--t-text-xs)",
                background: "var(--t-error)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Retirer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
