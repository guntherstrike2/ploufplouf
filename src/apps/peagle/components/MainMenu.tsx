"use client";

import { useState, useRef, useCallback } from "react";
import "../peagle.css";
import { useSoundContext } from "@/lib/contexts/sound-context";
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
  musicMuted: boolean;
  onToggleMusic: () => void;
  skipIntro?: boolean;
}

export function MainMenu({
  isAdmin,
  onPlay,
  onLeaderboard,
  onDevLaunch,
  musicMuted,
  onToggleMusic,
  skipIntro = false,
}: MainMenuProps) {
  const [showDev, setShowDev] = useState(false);
  // Si skipIntro, le menu est directement visible (l'overlay de transition couvre le reveal)
  const [showMenu, setShowMenu] = useState(skipIntro);
  const [showSettings, setShowSettings] = useState(false);
  const { playClick, playBip } = useSoundContext();

  // Texte des boutons qui réagit aux impacts d'œufs sur le titre.
  // Onde de choc lointaine → amplitude volontairement minuscule (~force × 3px),
  // avec un léger décalage par bouton pour que la secousse « descende » le menu.
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const handleImpact = useCallback((force: number) => {
    const amp = 1 + force * 2.4; // ~1 à 3.4px max — bien plus faible que le titre
    btnRefs.current.forEach((el, i) => {
      if (!el) return;
      el.animate(
        [
          { transform: "translateY(0)" },
          { transform: `translateY(${amp}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 200, delay: i * 45, easing: "cubic-bezier(0.34,1.56,0.64,1)" },
      );
    });
  }, []);

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
      <TitleCanvas skipIntro={skipIntro} onMenuReveal={() => setShowMenu(true)} onImpact={handleImpact} />

      {showDev && (
        <DevPanel
          onClose={() => setShowDev(false)}
          onLaunch={(cfg) => {
            setShowDev(false);
            onDevLaunch(cfg);
          }}
        />
      )}

      {/* Panneau Réglages — overlay pixel centré. */}
      {showSettings && (
        <div
          className="pg-settings-overlay"
          onClick={() => { playClick(); setShowSettings(false); }}
        >
          <div className="pg-dialog pg-settings-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pg-titlebar">
              <span className="pg-caption-btn">⚙</span>
              <span style={{ fontSize: 9, letterSpacing: "0.1em" }}>RÉGLAGES</span>
            </div>
            <div className="pg-settings-body">
              <div className="pg-settings-row">
                <span>MUSIQUE</span>
                <button
                  className={`pg-btn ${musicMuted ? "" : "pg-btn-primary"}`}
                  onPointerEnter={playBip}
                  onClick={() => { playClick(); onToggleMusic(); }}
                >
                  {musicMuted ? "OFF" : "ON"}
                </button>
              </div>
              <button
                className="pg-btn"
                style={{ alignSelf: "center", marginTop: 4 }}
                onPointerEnter={playBip}
                onClick={() => { playClick(); setShowSettings(false); }}
              >
                FERMER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEV TOOLS — lien discret en coin, réservé admin, hors de la pile de CTA
          pour ne pas casser l'immersion ni concurrencer « JOUER ». */}
      {isAdmin && showMenu && (
        <button
          className="pg-dev-link"
          onClick={() => { playClick(); setShowDev(true); }}
          title="Outils développeur"
        >
          ⚙ dev
        </button>
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
          marginBottom: "clamp(110px, 15vh, 150px)",
          opacity: showMenu ? 1 : 0,
          transform: showMenu ? "translateY(0)" : "translateY(40px)",
          transition:
            "opacity 0.45s ease-out, transform 0.45s cubic-bezier(0.34,1.56,0.64,1)",
          pointerEvents: showMenu ? "auto" : "none"
        }}
      >
        <button
          ref={(el) => { btnRefs.current[0] = el; }}
          className="pg-menu-btn pg-menu-btn-primary"
          onPointerEnter={playBip}
          onClick={() => { playClick(); onPlay(); }}
        >
          JOUER
        </button>

        <button
          ref={(el) => { btnRefs.current[1] = el; }}
          className="pg-menu-btn"
          onPointerEnter={playBip}
          onClick={() => { playClick(); onLeaderboard(); }}
        >
          CLASSEMENT
        </button>

        <button
          ref={(el) => { btnRefs.current[2] = el; }}
          className="pg-menu-btn"
          onPointerEnter={playBip}
          onClick={() => { playClick(); setShowSettings(true); }}
        >
          RÉGLAGES
        </button>
      </div>

      {/* Bannière version — épinglée en bas de la fenêtre (footer). */}
      {showMenu && (
        <div className="pg-menu-footer">
          <div className="pg-welcome-banner">
            Thanks for testing
            <br />
            <span className="pg-alpha">V0.1.0(alpha)</span>
          </div>
        </div>
      )}
    </div>
  );
}
