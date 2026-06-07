"use client";

import "../peagle.css";
import type { LeaderboardEntry } from "../engine/types";
import { PG } from "../styles";
import { PixelSprite } from "./PixelSprite";
import { PegBtn } from "./PegBtn";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  currentUserId?: string;
  onRefresh: () => void;
  showLoginHint: boolean;
  onBack: () => void;
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? "pg-lb-badge pg-lb-badge-gold"
    : rank === 2 ? "pg-lb-badge pg-lb-badge-silver"
    : rank === 3 ? "pg-lb-badge pg-lb-badge-bronze"
    : "pg-lb-badge pg-lb-badge-plain";
  return <span className={cls}>{rank}</span>;
}

export function Leaderboard({ entries, loading, currentUserId, onRefresh, showLoginHint, onBack }: LeaderboardProps) {
  return (
    <div
      className="peagle-root"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "linear-gradient(to bottom, #0e1e0a 0%, #0a1606 50%, #060e04 100%)",
        fontFamily: "var(--pg-font)",
        position: "relative",
      }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 14px",
          borderBottom: `2px solid #050d03`,
          background: "linear-gradient(to bottom, #1a3410 0%, #111f0b 55%, #0d1a08 100%)",
          boxShadow: `inset 0 1px 0 0 ${PG.bevelHi}, inset 0 -2px 0 0 ${PG.goldDark}`,
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        <PegBtn onClick={onBack} variant="primary" size="sm">
          MENU
        </PegBtn>

        <span
          style={{
            fontSize: 8,
            fontWeight: "bold",
            color: PG.gold,
            flex: 1,
            letterSpacing: "0.1em",
            display: "flex",
            alignItems: "center",
            gap: 8,
            textShadow: "0 0 10px rgba(220,180,50,0.45), 0 1px 0 rgba(0,0,0,0.95)",
          }}
        >
          <PixelSprite name="eagle" scale={2} />
          GRANDS CHASSEURS — TOP 10
        </span>

        <PegBtn
          onClick={onRefresh}
          disabled={loading}
          variant="ghost"
          size="sm"
        >
          {loading ? "..." : "ACTUALISER"}
        </PegBtn>
      </div>

      {/* ── Table container ──────────────────────────────────────────────── */}
      <div
        className="pg-lux-panel"
        style={{
          flex: 1,
          overflow: "auto",
          margin: "14px 14px",
          animation: "none",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "52px 1fr 38px 100px",
            gap: 8,
            padding: "10px 16px",
            borderBottom: `2px solid #050d03`,
            background: "linear-gradient(to bottom, #1a3410 0%, #0e1e08 100%)",
            boxShadow: `inset 0 1px 0 0 ${PG.bevelHi}, inset 0 -2px 0 0 ${PG.goldDark}`,
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          {(["#", "CHASSEUR", "VOL", "SCORE"] as const).map((h, i) => (
            <span
              key={h}
              style={{
                fontSize: 7,
                color: PG.textMuted,
                letterSpacing: "0.1em",
                textAlign: i === 3 ? "right" : i === 2 ? "center" : "left",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: PG.textMuted,
              fontSize: 8,
              letterSpacing: "0.08em",
            }}
          >
            Chargement...
          </div>
        )}

        {/* Empty */}
        {!loading && entries.length === 0 && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: PG.textMuted,
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: "var(--pg-font-ui)",
            }}
          >
            Aucun aigle inscrit.<br />Le ciel est vide.<br />Soyez le premier prédateur.
          </div>
        )}

        {/* Rows */}
        {!loading && entries.map((entry, i) => {
          const name = entry.displayUsername || entry.username || entry.name;
          const isMe = !!(currentUserId && entry.userId === currentUserId);
          const rank = i + 1;
          return (
            <div
              key={entry.userId}
              className="pg-lb-row"
              style={{
                background: isMe
                  ? "rgba(126,209,58,0.12)"
                  : i % 2 === 0
                    ? "transparent"
                    : "rgba(0,0,0,0.16)",
                animation: "pg-row-slide 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                animationDelay: `${i * 0.05}s`,
              }}
            >
              {/* Rang */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <RankBadge rank={rank} />
              </div>

              {/* Nom */}
              <span
                style={{
                  fontSize: 8,
                  color: isMe ? PG.leaf : PG.text,
                  fontWeight: isMe ? "bold" : "normal",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textShadow: isMe ? `0 0 8px ${PG.leaf}55` : "none",
                }}
              >
                {name}
                {isMe && (
                  <span style={{ color: PG.leafDim, fontWeight: "normal" }}> (votre nid)</span>
                )}
              </span>

              {/* Icône vol */}
              <span style={{ display: "flex", justifyContent: "center" }}>
                <PixelSprite name={entry.won ? "eagle" : "grave"} scale={2} />
              </span>

              {/* Score */}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: "bold",
                  color: rank <= 3 ? PG.cream : PG.text,
                  textAlign: "right",
                  textShadow: rank <= 3 ? `0 0 8px rgba(242,230,194,0.25)` : "none",
                }}
              >
                {entry.score.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Login hint ───────────────────────────────────────────────────── */}
      {showLoginHint && (
        <div
          className="pg-hero-score"
          style={{
            margin: "0 14px 14px",
            padding: "10px 18px",
            fontSize: 13,
            color: PG.textMuted,
            textAlign: "center",
            lineHeight: 1.5,
            fontFamily: "var(--pg-font-ui)",
          }}
        >
          Connectez-vous pour marquer votre territoire dans le classement des nids
        </div>
      )}
    </div>
  );
}
