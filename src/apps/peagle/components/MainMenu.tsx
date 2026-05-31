"use client";

import { useState } from "react";
import "../peagle.css";
import { captionBtn } from "../styles";
import { DevPanel } from "./DevPanel";
import type { DevConfig } from "./DevPanel";

const NW = {
  bg:        "#060e04",
  surface:   "#0c1a08",
  surface2:  "#122010",
  hi:        "#3a6030",
  sh:        "#020501",
  gold:      "#88cc44",
  goldLight: "#aaee66",
  amber:     "#66bb33",
  text:      "#c8e8b0",
  textMuted: "#4a7040",
  cyan:      "#44ccaa",
  titleFrom: "#0a1a06",
  titleTo:   "#060e04",
} as const;

const TIPS = [
  "ASTUCE : Les cibles orange sont les vraies cibles. Les bleues ? Bonus de points.",
  "ASTUCE : Lancez l'œuf avec la souris. Visez, cliquez. C'est tout.",
  "ASTUCE : Le panier en bas rattrape les œufs qui tombent. Profitez-en.",
  "ASTUCE : Enchaînez les pegs sans rater pour faire grimper le combo.",
  "ASTUCE : Cassez toutes les cibles oranges pour gagner le niveau et choisir un bonus.",
];

interface MainMenuProps {
  bestScore: number;
  displayName: string | null;
  isAdmin: boolean;
  onPlay: () => void;
  onLeaderboard: () => void;
  onDevLaunch: (cfg: DevConfig) => void;
}

export function MainMenu({ bestScore, displayName, isAdmin, onPlay, onLeaderboard, onDevLaunch }: MainMenuProps) {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]!);
  const [showDev, setShowDev] = useState(false);

  return (
    <div
      className="peagle-root"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to bottom, #122010 0%, #0a1806 55%, #060e04 100%)",
        overflow: "hidden",
        userSelect: "none",
        position: "relative",
      }}
    >
      {showDev && (
        <DevPanel
          onClose={() => setShowDev(false)}
          onLaunch={(cfg) => { setShowDev(false); onDevLaunch(cfg); }}
        />
      )}

      <div
        style={{
          width: 320,
          flexShrink: 0,
          zIndex: 2,
          background: NW.surface,
          borderWidth: 3,
          borderStyle: "solid",
          borderTopColor: NW.hi,
          borderLeftColor: NW.hi,
          borderBottomColor: NW.sh,
          borderRightColor: NW.sh,
          boxShadow: `6px 6px 0 rgba(0,0,0,0.8), 0 0 50px rgba(120,200,40,0.1)`,
        }}
      >
        {/* Titlebar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: `linear-gradient(to right, ${NW.titleFrom}, ${NW.titleTo})`,
            padding: "5px 6px 5px 8px",
            gap: 4,
            borderBottom: `1px solid ${NW.gold}55`,
          }}
        >
          <span style={{
            fontSize: 9,
            color: NW.goldLight,
            flex: 1,
            fontFamily: "var(--pg-font)",
            letterSpacing: "0.05em",
            textShadow: `0 0 8px ${NW.gold}88`,
          }}>
            🦅 PEAGLE 98
          </span>
          {(["─", "□", "×"] as const).map((ch) => (
            <div
              key={ch}
              style={{
                ...captionBtn,
                background: NW.surface2,
                borderTopColor: NW.hi,
                borderLeftColor: NW.hi,
                borderBottomColor: NW.sh,
                borderRightColor: NW.sh,
                color: NW.textMuted,
              }}
            >
              {ch}
            </div>
          ))}
        </div>

        <div style={{ padding: "28px 28px 20px" }}>
          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div
              style={{
                fontSize: 34,
                marginBottom: 12,
                lineHeight: 1,
              }}
            >
              🦅
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: NW.goldLight,
                fontFamily: "var(--pg-font)",
                letterSpacing: "0.08em",
                textShadow: `0 0 12px ${NW.gold}88`,
                marginBottom: 10,
              }}
            >
              PEAGLE 98
            </div>
            <div
              style={{
                fontSize: 8,
                color: NW.gold,
                letterSpacing: "0.12em",
                fontFamily: "var(--pg-font)",
                animation: "pg-blink 2s step-end infinite",
                textShadow: `0 0 8px ${NW.gold}66`,
              }}
            >
              ✦ CASSEZ TOUTES LES CIBLES ORANGES ✦
            </div>
          </div>

          <div
            style={{
              height: 1,
              background: `linear-gradient(to right, transparent, ${NW.gold}44, transparent)`,
              marginBottom: 20,
            }}
          />

          {/* Boutons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <button
              onClick={onPlay}
              autoFocus
              style={{
                width: "100%",
                padding: "12px 0",
                fontFamily: "var(--pg-font)",
                fontSize: 9,
                textAlign: "center",
                letterSpacing: "0.06em",
                cursor: "pointer",
                background: `linear-gradient(to bottom, ${NW.amber}, #3a7a00)`,
                color: NW.text,
                borderWidth: 2,
                borderStyle: "solid",
                borderTopColor: NW.goldLight,
                borderLeftColor: NW.goldLight,
                borderBottomColor: NW.sh,
                borderRightColor: NW.sh,
                textShadow: "0 1px 0 rgba(0,0,0,0.6)",
              }}
            >
              ▶  NOUVELLE PARTIE
            </button>

            <button
              onClick={onLeaderboard}
              style={{
                width: "100%",
                padding: "9px 0",
                fontFamily: "var(--pg-font)",
                fontSize: 8,
                textAlign: "center",
                letterSpacing: "0.04em",
                cursor: "pointer",
                background: NW.surface2,
                color: NW.text,
                borderWidth: 2,
                borderStyle: "solid",
                borderTopColor: NW.hi,
                borderLeftColor: NW.hi,
                borderBottomColor: NW.sh,
                borderRightColor: NW.sh,
              }}
            >
              ★  CLASSEMENT
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowDev(true)}
                style={{
                  width: "100%",
                  padding: "7px 0",
                  fontFamily: "var(--pg-font)",
                  fontSize: 7,
                  textAlign: "center",
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                  background: NW.surface2,
                  color: "#aa55ee",
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderTopColor: "#aa55ee",
                  borderLeftColor: "#aa55ee",
                  borderBottomColor: NW.sh,
                  borderRightColor: NW.sh,
                }}
              >
                ⚙  DEV TOOLS
              </button>
            )}
          </div>

          <div
            style={{
              height: 1,
              background: `linear-gradient(to right, transparent, ${NW.gold}44, transparent)`,
              marginBottom: 14,
            }}
          />

          {/* Tip */}
          <div
            style={{
              fontSize: 7,
              color: NW.textMuted,
              fontFamily: "var(--pg-font)",
              marginBottom: 12,
              lineHeight: 1.5,
              padding: "6px 8px",
              borderWidth: 1,
              borderStyle: "solid",
              borderTopColor: NW.sh,
              borderLeftColor: NW.sh,
              borderBottomColor: NW.hi,
              borderRightColor: NW.hi,
              background: "rgba(0,0,0,0.3)",
            }}
          >
            {tip}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 7,
              color: NW.textMuted,
              fontFamily: "var(--pg-font)",
            }}
          >
            <span>
              {bestScore > 0 ? (
                <>⭐ <span style={{ color: NW.gold }}>{bestScore.toLocaleString()}</span></>
              ) : (
                "-- PAS DE SCORE --"
              )}
            </span>
            <span style={{ color: displayName ? NW.cyan : NW.textMuted }}>
              {displayName ? `▶ ${displayName}` : "NON CONNECTÉ"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
