"use client";

import { useState } from "react";
import "../peagle.css";
import { DevPanel } from "./DevPanel";
import type { DevConfig } from "./DevPanel";
import { TitleCanvas } from "./TitleCanvas";

const NW = {
  gold: "#88cc44"
} as const;

interface MainMenuProps {
  isAdmin: boolean;
  onPlay: () => void;
  onLeaderboard: () => void;
  onDevLaunch: (cfg: DevConfig) => void;
}

export function MainMenu({
  isAdmin,
  onPlay,
  onLeaderboard,
  onDevLaunch
}: MainMenuProps) {
  const [showDev, setShowDev] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className="peagle-root"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background:
          "linear-gradient(to bottom, #122010 0%, #0a1806 55%, #060e04 100%)",
        overflow: "hidden",
        userSelect: "none",
        position: "relative"
      }}
    >
      {/* Intro animée + décor en boucle (canvas, derrière tout) */}
      <TitleCanvas onMenuReveal={() => setShowMenu(true)} />

      {showDev && (
        <DevPanel
          onClose={() => setShowDev(false)}
          onLaunch={(cfg) => {
            setShowDev(false);
            onDevLaunch(cfg);
          }}
        />
      )}

      {/* Indice "passer l'intro" — visible tant que le menu n'est pas révélé */}
      {!showMenu && (
        <div
          style={{
            position: "absolute",
            bottom: 18,
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 2,
            fontSize: 8,
            color: NW.gold,
            fontFamily: "var(--pg-font)",
            letterSpacing: "0.1em",
            textShadow: `0 0 8px ${NW.gold}88, 0 2px 4px rgba(0,0,0,0.9)`,
            animation: "pg-blink 1.1s step-end infinite",
            pointerEvents: "none"
          }}
        >
          ▶ TOUCHEZ POUR PASSER
        </div>
      )}

      {/* Menu diégétique — pas de fenêtre OS, intégré à la scène, tactile */}
      <div
        className="pg-menu-panel"
        style={{
          zIndex: 2,
          marginBottom: "clamp(16px, 5vh, 44px)",
          opacity: showMenu ? 1 : 0,
          transform: showMenu ? "translateY(0)" : "translateY(40px)",
          transition:
            "opacity 0.45s ease-out, transform 0.45s cubic-bezier(0.34,1.56,0.64,1)",
          pointerEvents: showMenu ? "auto" : "none"
        }}
      >
        <button className="pg-menu-btn pg-menu-btn-primary" onClick={onPlay}>
          JOUER
        </button>

        <button className="pg-menu-btn" onClick={onLeaderboard}>
          CLASSEMENT
        </button>

        {isAdmin && (
          <button
            className="pg-menu-btn pg-menu-btn-dev"
            onClick={() => setShowDev(true)}
          >
            DEV TOOLS
          </button>
        )}

        {showMenu && (
          <div className="pg-welcome-banner">
            Thanks for testing
            <br />
            <span className="pg-alpha">V0.1.0(alpha)</span>
          </div>
        )}
      </div>
    </div>
  );
}
