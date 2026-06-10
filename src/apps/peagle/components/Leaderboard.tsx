"use client";

import "../peagle.css";
import "../palette-style";
import type { LeaderboardEntry } from "../engine/types";
import { PG, GRADIENT } from "../styles";
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

/**
 * Classement plein écran — même DA que les menus actuels (Instructions,
 * Changelog, Options) : carte forêt diégétique `pg-settings-card`, header
 * titre + badge à la `PegDialog`, séparateurs pixel, corps scrollable, footer
 * fixe avec `PegBtn`. Les rangs reprennent le langage du mini-classement de
 * game over (`pg-go-rank-*`, badges or/argent/bronze).
 */
export function Leaderboard({ entries, loading, currentUserId, onRefresh, showLoginHint, onBack }: LeaderboardProps) {
  return (
    <div
      className="peagle-root pg-screen"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: GRADIENT.backdrop3,
        fontFamily: "var(--pg-font)",
        position: "relative",
        padding: 16,
      }}
    >
      {/* Carte forêt diégétique — identique aux dialogs (pas de titlebar OS). */}
      <div
        className="pg-settings-card"
        style={{
          width: "min(420px, 100%)",
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* En-tête : titre + badge dans la matière de la carte. */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 16px 10px",
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>🦅</span>
          <span style={{
            fontFamily: "var(--pg-font)",
            fontSize: 9,
            letterSpacing: "0.1em",
            color: PG.text,
            flex: 1,
          }}>
            GREAT HUNTERS
          </span>
          <span style={{
            fontFamily: "var(--pg-font)",
            fontSize: 8,
            letterSpacing: "0.06em",
            color: PG.gold,
            flexShrink: 0,
          }}>
            TOP 10
          </span>
        </div>

        <div className="pg-settings-divider" aria-hidden style={{ margin: "0 16px", flexShrink: 0 }} />

        {/* Corps scrollable. */}
        <div
          className="pg-no-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Tableau — section encadrée à la Instructions. */}
          <div
            style={{
              flexShrink: 0,
              border: `2px solid ${PG.border}`,
              borderRadius: 6,
              background: PG.bg,
              overflow: "hidden",
            }}
          >
            {/* En-tête de colonnes. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1fr 24px auto",
                gap: 8,
                alignItems: "center",
                padding: "6px 12px",
                borderBottom: `1px solid ${PG.border}`,
                background: "linear-gradient(to bottom, #1c3812 0%, #0c1c08 100%)",
                boxShadow: `inset 0 1px 0 0 ${PG.bevelHi}, inset 0 -2px 0 0 ${PG.gold}33`,
              }}
            >
              {(["#", "HUNTER", "", "SCORE"] as const).map((h, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: "var(--pg-font)",
                    fontSize: 7,
                    color: PG.textMuted,
                    letterSpacing: "0.12em",
                    textAlign: i === 3 ? "right" : "left",
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
                  padding: "28px 12px",
                  textAlign: "center",
                  color: PG.textMuted,
                  fontFamily: "var(--pg-font-ui)",
                  fontSize: 14,
                  letterSpacing: "0.02em",
                }}
              >
                Reading the hunters&apos; registry...
              </div>
            )}

            {/* Vide */}
            {!loading && entries.length === 0 && (
              <div
                style={{
                  padding: "28px 12px",
                  textAlign: "center",
                  color: PG.textMuted,
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontFamily: "var(--pg-font-ui)",
                }}
              >
                No eagle on record.<br />The sky is empty.<br />Be the first predator.
              </div>
            )}

            {/* Lignes */}
            {!loading && entries.map((entry, i) => {
              const name = entry.displayUsername || entry.username || entry.name;
              const isMe = !!(currentUserId && entry.userId === currentUserId);
              const rank = i + 1;
              return (
                <div
                  key={entry.userId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "30px 1fr 24px auto",
                    gap: 8,
                    alignItems: "center",
                    padding: "7px 12px",
                    borderTop: i === 0 ? "none" : `1px solid ${PG.border}`,
                    background: isMe ? "rgba(126,209,58,0.14)" : "transparent",
                    boxShadow: isMe ? "inset 0 0 0 1px rgba(126,209,58,0.28)" : "none",
                    animation: "pg-row-slide 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                    animationDelay: `${i * 0.04}s`,
                  }}
                >
                  {/* Rang */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <RankBadge rank={rank} />
                  </div>

                  {/* Nom */}
                  <span
                    style={{
                      fontFamily: "var(--pg-font-ui)",
                      fontSize: 15,
                      color: isMe ? PG.greenHi : PG.text,
                      letterSpacing: "0.01em",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                    {isMe && (
                      <span style={{ color: PG.green }}> · you</span>
                    )}
                  </span>

                  {/* Picto vol / chute */}
                  <span style={{ fontSize: 13, textAlign: "center", lineHeight: 1 }}>
                    {entry.won ? "🦅" : "🪦"}
                  </span>

                  {/* Score */}
                  <span
                    style={{
                      fontFamily: "var(--pg-font)",
                      fontSize: 8,
                      fontWeight: "bold",
                      color: rank <= 3 ? PG.cream : PG.text,
                      textAlign: "right",
                      textShadow: "0 1px 0 rgba(0,0,0,0.9)",
                    }}
                  >
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Indice connexion — dans le corps, ton discret. */}
          {showLoginHint && (
            <div
              style={{
                flexShrink: 0,
                fontFamily: "var(--pg-font-ui)",
                fontSize: 14,
                color: PG.textMuted,
                textAlign: "center",
                lineHeight: 1.5,
                padding: "2px 4px",
              }}
            >
              Log in to stake your nest in the rankings.
            </div>
          )}
        </div>

        <div className="pg-settings-divider" aria-hidden style={{ margin: "0 16px", flexShrink: 0 }} />

        {/* Footer fixe : retour + refresh. */}
        <div
          style={{
            flexShrink: 0,
            padding: "10px 16px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <PegBtn onClick={onBack} variant="primary" size="sm">
            MENU
          </PegBtn>
          <PegBtn onClick={onRefresh} disabled={loading} variant="ghost" size="sm">
            {loading ? "..." : "REFRESH"}
          </PegBtn>
        </div>
      </div>
    </div>
  );
}
