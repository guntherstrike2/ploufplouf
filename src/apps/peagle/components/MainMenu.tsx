"use client";

import { useState, useRef, useCallback } from "react";
import "../peagle.css";
import { usePeagleSounds } from "../hooks/usePeagleSounds";
import { DevPanel } from "./DevPanel";
import type { DevConfig } from "./DevPanel";
import { TitleCanvas } from "./TitleCanvas";
import type { BeatBands } from "../hooks/useMusic";
import { PG } from "../styles";
import { PatchNotes } from "./PatchNotes";
import { Instructions } from "./Instructions";
import { Options } from "./Options";
import { PEAGLE_CURRENT_VERSION } from "../peagle-versions";

interface MainMenuProps {
  isAdmin: boolean;
  onPlay: () => void;
  onPlayWithSeed: (seed: number) => void;
  onLeaderboard: () => void;
  onDevLaunch: (cfg: DevConfig) => void;
  musicMuted: boolean;
  onToggleMusic: () => void;
  skipIntro?: boolean;
  getBeat?: () => BeatBands;
}

export function MainMenu({
  isAdmin,
  onPlay,
  onPlayWithSeed,
  onLeaderboard,
  onDevLaunch,
  musicMuted,
  onToggleMusic,
  skipIntro = false,
  getBeat,
}: MainMenuProps) {
  const [showDev, setShowDev] = useState(false);
  // Si skipIntro, le menu est directement visible (l'overlay de transition couvre le reveal)
  const [showMenu, setShowMenu] = useState(skipIntro);
  const [showSettings, setShowSettings] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const { playMenuClick, playMenuHover, playMenuReveal, playTitleImpact, playEagleCryShort, playEagleCryLong } = usePeagleSounds();

  // Texte des boutons qui réagit aux impacts d'œufs sur le titre.
  // Onde de choc lointaine → amplitude volontairement minuscule (~force × 3px),
  // avec un léger décalage par bouton pour que la secousse « descende » le menu.
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const handleImpact = useCallback((force: number) => {
    playTitleImpact(force);
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
  }, [playTitleImpact]);

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
      <TitleCanvas
        skipIntro={skipIntro}
        onMenuReveal={() => { setShowMenu(true); playMenuReveal(); }}
        onImpact={handleImpact}
        onEagleCry={(v, rate) => (v === "long" ? playEagleCryLong() : playEagleCryShort(0.35, rate))}
        getBeat={getBeat}
      />

      {showDev && (
        <DevPanel
          onClose={() => setShowDev(false)}
          onLaunch={(cfg) => {
            setShowDev(false);
            onDevLaunch(cfg);
          }}
        />
      )}

      {showPatchNotes && (
        <PatchNotes onClose={() => setShowPatchNotes(false)} />
      )}

      {showInstructions && (
        <Instructions onClose={() => setShowInstructions(false)} />
      )}

      {/* Menu Options — carte diégétique partagée avec la pause (Musique,
          Scanlines, Pixel, seed). Fermeture via FERMER ou clic sur l'overlay. */}
      {showSettings && (
        <Options
          musicMuted={musicMuted}
          onToggleMusic={onToggleMusic}
          onPlaySeed={onPlayWithSeed}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* DEV TOOLS — lien discret en coin, réservé admin, hors de la pile de CTA
          pour ne pas casser l'immersion ni concurrencer « JOUER ». */}
      {isAdmin && showMenu && (
        <button
          className="pg-dev-link"
          onClick={() => { playMenuClick(); setShowDev(true); }}
          title="Outils développeur"
        >
          dev
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
            color: PG.gold,
            fontFamily: "var(--pg-font)",
            letterSpacing: "0.1em",
            textShadow: `0 0 8px ${PG.gold}88, 0 2px 4px rgba(0,0,0,0.9)`,
            animation: "pg-blink 1.1s step-end infinite",
            pointerEvents: "none"
          }}
        >
          TOUCHEZ POUR PASSER
        </div>
      )}

      {/* Menu diégétique — peg-boutons bouncy, intégrés à la scène, tactiles.
          Chaque bouton « pop » en décalé (animationDelay) au reveal du menu. */}
      <div
        className="pg-pm-panel"
        style={{
          zIndex: 2,
          marginBottom: "clamp(96px, 13vh, 140px)",
          opacity: showMenu ? 1 : 0,
          transition: "opacity 0.3s ease-out",
          pointerEvents: showMenu ? "auto" : "none"
        }}
      >
        <button
          ref={(el) => { btnRefs.current[0] = el; }}
          className="pg-pm-btn pg-pm-btn-play"
          style={{ animationDelay: "0.04s" }}
          onPointerEnter={playMenuHover}
          onClick={() => { playMenuClick(); onPlay(); }}
        >
          JOUER
        </button>

        {/* Boutons secondaires — regroupés et serrés, détachés du CTA « JOUER »
            par un espace plus large pour hiérarchiser la lecture. */}
        <div className="pg-pm-subgroup">
          <button
            ref={(el) => { btnRefs.current[1] = el; }}
            className="pg-pm-btn"
            style={{ animationDelay: "0.12s" }}
            onPointerEnter={playMenuHover}
            onClick={() => { playMenuClick(); onLeaderboard(); }}
          >
            CLASSEMENT
          </button>

          <button
            ref={(el) => { btnRefs.current[2] = el; }}
            className="pg-pm-btn"
            style={{ animationDelay: "0.18s" }}
            onPointerEnter={playMenuHover}
            onClick={() => { playMenuClick(); setShowInstructions(true); }}
          >
            INSTRUCTIONS
          </button>

          <button
            ref={(el) => { btnRefs.current[3] = el; }}
            className="pg-pm-btn"
            style={{ animationDelay: "0.24s" }}
            onPointerEnter={playMenuHover}
            onClick={() => { playMenuClick(); setShowSettings(true); }}
          >
            OPTIONS
          </button>
        </div>
      </div>

      {/* Bannière version — petit peg doré épinglé en bas, cliquable pour les MAJ. */}
      {showMenu && (
        <div className="pg-menu-footer" style={{ pointerEvents: "auto" }}>
          <button
            className="pg-pm-version"
            onPointerEnter={playMenuHover}
            onClick={() => { playMenuClick(); setShowPatchNotes(true); }}
            title="Voir les notes de mise à jour"
          >
            NOTES DE MAJ
            <br />
            <span className="pg-pm-version-num">V{PEAGLE_CURRENT_VERSION}</span>
          </button>
        </div>
      )}
    </div>
  );
}
