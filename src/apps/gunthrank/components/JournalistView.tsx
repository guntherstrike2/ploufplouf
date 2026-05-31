"use client";

import { useMemo } from "react";
import { useKiffTheme } from "../kiff-theme-context";
import {
  type RankingEntry,
  type JournalistEntry,
  computeJournalistList,
  getPlatformColor,
} from "../constants";

interface JournalistViewProps {
  /** Liste filtrée (plateforme/genre/année) à afficher. */
  rankings: RankingEntry[];
  /** Liste brute complète pour le calcul du kiff rank (tiebreaker). */
  allRankingsForKiff: RankingEntry[];
  readOnly?: boolean;
  searchQuery: string;
  onDetailClick?: (ranking: RankingEntry) => void;
}

/** Retourne la largeur du stroke-dasharray pour le cercle de pourcentage. */
function circleDash(pct: number): number {
  const circ = 2 * Math.PI * 28; // r=28
  return (pct / 100) * circ;
}

// ── Badge de pourcentage circulaire ──
function PctBadge({ entry, size }: { entry: JournalistEntry; size: "sm" | "lg" }) {
  const { percentage, category } = entry;
  const r = size === "lg" ? 28 : 20;
  const circ = 2 * Math.PI * r;
  const dash = circleDash(percentage);
  const dims = size === "lg" ? 72 : 48;

  return (
    <div
      className="flex-shrink-0 relative flex items-center justify-center font-bold"
      style={{ width: dims, height: dims }}
      title={`${percentage}% — ${category.label}`}
    >
      <svg
        width={dims}
        height={dims}
        viewBox={`0 0 ${dims} ${dims}`}
        style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
      >
        <circle
          cx={dims / 2}
          cy={dims / 2}
          r={r}
          fill="none"
          stroke={category.color + "30"}
          strokeWidth={size === "lg" ? 4 : 3}
        />
        <circle
          cx={dims / 2}
          cy={dims / 2}
          r={r}
          fill="none"
          stroke={category.color}
          strokeWidth={size === "lg" ? 4 : 3}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <span
        style={{
          fontSize: size === "lg" ? "calc(var(--t-text-md) * 1.1)" : "var(--t-text-sm)",
          color: category.color,
          textShadow: `0 0 12px ${category.color}60`,
          position: "relative",
        }}
      >
        {percentage}
      </span>
    </div>
  );
}

// ── Ligne magazine (façon colonne de test Console+) ──
function JournalistRow({
  entry,
  readOnly,
  onDetailClick,
}: {
  entry: JournalistEntry;
  readOnly?: boolean;
  onDetailClick?: (ranking: RankingEntry) => void;
}) {
  const { ranking, percentage, category, rank } = entry;
  const coverUrl = ranking.game?.coverUrl;
  const gameName = ranking.game?.name ?? "Inconnu";
  const noteText = ranking.noteText?.slice(0, 160) ?? null;
  const platformColor = getPlatformColor(ranking.playedOn);

  let genres: string[] = [];
  try {
    if (typeof ranking.game?.genres === "string") genres = JSON.parse(ranking.game.genres);
  } catch { /* noop */ }

  const metaParts: string[] = [];
  if (ranking.playedOn) metaParts.push(ranking.playedOn);
  if (genres[0]) metaParts.push(genres[0]);
  if (ranking.game?.releaseDate) metaParts.push(String(ranking.game.releaseDate));

  return (
    <div
      onClick={() => onDetailClick?.(ranking)}
      className="flex items-stretch rounded overflow-hidden cursor-pointer select-none"
      style={{
        background: "#1a1a2e",
        border: `2px solid ${category.color}20`,
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        minHeight: 96,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = category.color + "60";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px rgba(0,0,0,0.5), 0 0 16px ${category.color}15`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = category.color + "20";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.3)";
      }}
    >
      {/* Rank + platform color bar */}
      <div className="flex items-stretch flex-shrink-0">
        {/* Rank column */}
        <div
          className="flex items-center justify-center font-bold"
          style={{
            width: 36,
            background: rank <= 3 ? category.color : "#111",
            color: rank <= 3 ? "#1a1a2e" : "#fff",
            fontSize: "var(--t-text-md)",
            borderRight: rank <= 3 ? "none" : "1px solid #333",
          }}
        >
          {rank}
        </div>
        {/* Platform color accent */}
        {platformColor && (
          <div style={{ width: 4, background: platformColor }} />
        )}
      </div>

      {/* Cover */}
      <div
        className="flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ width: 64, background: "#16162a" }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt={gameName} className="w-full h-full object-cover" loading="lazy" draggable={false} />
        ) : (
          <span style={{ fontSize: "var(--t-text-lg)" }}>🎮</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-2">
        {/* Category label — solid fill badge */}
        <div
          style={{
            fontSize: "var(--t-text-xs)",
            color: "#fff",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            background: "var(--t-accent)",
            borderRadius: "4px",
            textShadow: "0 1px 3px rgba(0,0,0,0.45)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            padding: "3px 10px",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4em",
            alignSelf: "center",
          }}
        >
          <span style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }}>{category.emoji}</span>
          <span style={{ fontSize: "calc(var(--t-text-xs) * 0.85)", opacity: 0.8 }}>◆</span>
          <span>{category.label}</span>
          <span style={{ fontSize: "calc(var(--t-text-xs) * 0.85)", opacity: 0.8 }}>◆</span>
          <span style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }}>{category.emoji}</span>
        </div>

        {/* Game name */}
        <div className="font-bold truncate" style={{ fontSize: "var(--t-text-sm)", color: "#fff" }}>
          {gameName}
        </div>

        {/* Meta line */}
        {metaParts.length > 0 && (
          <div style={{ fontSize: "calc(var(--t-text-xs) * 0.82)", color: "#888" }}>
            {metaParts.join(" · ")}
          </div>
        )}

        {/* Note perso */}
        {noteText && (
          <div
            className="italic leading-snug truncate"
            style={{
              fontSize: "calc(var(--t-text-xs) * 0.82)",
              color: "#aaa",
              marginTop: 2,
            }}
          >
            &ldquo;{noteText}{ranking.noteText && ranking.noteText.length > 160 ? "…" : ""}&rdquo;
          </div>
        )}
      </div>

      {/* Percentage badge */}
      <div className="flex-shrink-0 flex items-center justify-center px-3">
        <PctBadge entry={entry} size="lg" />
      </div>
    </div>
  );
}

// ── Composant principal ──
export function JournalistView({
  rankings,
  allRankingsForKiff,
  readOnly,
  searchQuery,
  onDetailClick,
}: JournalistViewProps) {
  const { theme } = useKiffTheme();

  const entries = useMemo(() => {
    let list = computeJournalistList(rankings, allRankingsForKiff);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((e) => e.ranking.game?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [rankings, allRankingsForKiff, searchQuery]);

  const hasNotes = rankings.some((r) => r.objectiveNote != null);
  const allTotal = allRankingsForKiff.filter((r) => r.objectiveNote != null).length;

  if (!hasNotes) {
    return (
      <div
        className="flex flex-col items-center justify-center flex-1 gap-4"
        style={{ minHeight: 300 }}
      >
        <span style={{ fontSize: "var(--t-text-3xl)" }}>📰</span>
        <p style={{ fontSize: "var(--t-text-md)", color: "var(--t-text-muted)", textAlign: "center", maxWidth: 360 }}>
          Aucun jeu noté pour le moment !
        </p>
        <p style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", textAlign: "center" }}>
          Note des jeux dans les modes Liste ou Grille pour les voir apparaître ici.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* ── Masthead KIFF+ ── */}
      <div
        className="flex-shrink-0"
        style={{
          background: `linear-gradient(180deg, #e63946 0%, #c1121f 100%)`,
          borderBottom: "4px solid #ffd700",
          padding: "12px 20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative diagonal stripes */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(
              -20deg,
              transparent,
              transparent 20px,
              rgba(255,255,255,0.03) 20px,
              rgba(255,255,255,0.03) 40px
            )`,
            pointerEvents: "none",
          }}
        />

        {/* Title */}
        <div className="flex items-baseline gap-3">
          <span
            className="font-bold tracking-tight"
            style={{
              fontSize: "calc(var(--t-text-3xl) * 1.4)",
              color: "#fff",
              textShadow: "2px 2px 0 rgba(0,0,0,0.4), 0 0 40px rgba(255,215,0,0.3)",
              fontFamily: "var(--t-font-display), monospace",
              letterSpacing: "-0.02em",
            }}
          >
            KIFF+
          </span>
          <span
            style={{
              fontSize: "var(--t-text-xs)",
              color: "#ffd700",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              textShadow: "0 0 10px rgba(255,215,0,0.3)",
            }}
          >
            LE MAGAZINE QUI NOTE SANS PITIÉ
          </span>
        </div>

        {/* Decorative bar */}
        <div
          className="flex items-center gap-2"
          style={{ marginTop: 4, fontSize: "calc(var(--t-text-xs) * 0.78)", color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}
        >
          <span>📰 N°42</span>
          <span>·</span>
          <span>TESTS</span>
          <span>·</span>
          <span>VERDICTS</span>
          <span>·</span>
          <span>COMPARATIFS</span>
          <span>·</span>
          <span>{allTotal} JEUX TESTÉS</span>
        </div>
      </div>

      {/* ── Sub-header: compteur + info tri ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-1.5"
        style={{
          background: "#111",
          borderBottom: "1px solid #333",
          fontSize: "calc(var(--t-text-xs) * 0.78)",
          color: "#888",
        }}
      >
        <span>
          {entries.length} jeu{entries.length !== 1 ? "x" : ""} classé{entries.length !== 1 ? "s" : ""}
          {searchQuery && ` pour "${searchQuery}"`}
        </span>
        <span>
          Trié par note · Tiebreaker : classement général
        </span>
      </div>

      {/* ── Liste magazine ── */}
      <div className="flex flex-col gap-1.5 p-3">
        {entries.map((e) => (
          <JournalistRow
            key={e.ranking.id}
            entry={e}
            readOnly={readOnly}
            onDetailClick={onDetailClick}
          />
        ))}
      </div>

      {/* Empty state for search */}
      {entries.length === 0 && searchQuery && (
        <div className="flex-1 flex items-center justify-center">
          <span style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
            Aucun jeu noté ne correspond à &ldquo;{searchQuery}&rdquo;
          </span>
        </div>
      )}
    </div>
  );
}
