"use client";

import { useState, useRef, useCallback } from "react";
import "../peagle.css";
import "../palette-style";
import { usePeagleSounds } from "../hooks/usePeagleSounds";
import { DevPanel } from "./DevPanel";
import type { DevConfig } from "./DevPanel";
import { TitleCanvas } from "./TitleCanvas";
import { MenuButtonsCanvas, type MenuButtonsHandle, type MenuButtonDef } from "./MenuButtonsCanvas";
import type { BeatBands } from "../hooks/useMusic";
import { PG, GRADIENT } from "../styles";
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

  // Boutons du menu rendus en canvas (cf. MenuButtonsCanvas). L'onde de choc des
  // impacts d'œufs sur le titre leur est transmise via la ref impérative `knock`.
  const menuBtnsRef = useRef<MenuButtonsHandle>(null);
  const handleImpact = useCallback((force: number) => {
    playTitleImpact(force);
    menuBtnsRef.current?.knock(force);
  }, [playTitleImpact]);

  // Définition des 4 boutons principaux — l'ordre = ordre d'empilement (PLAY en tête).
  const menuButtons: MenuButtonDef[] = [
    { label: "PLAY",        variant: "play",    onClick: onPlay },
    { label: "LEADERBOARD", variant: "primary", onClick: onLeaderboard },
    { label: "HOW TO PLAY", variant: "primary", onClick: () => setShowInstructions(true) },
    { label: "OPTIONS",     variant: "primary", onClick: () => setShowSettings(true) },
  ];

  return (
    <div
      className="peagle-root"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: GRADIENT.backdrop3,
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
          title="Developer Tools"
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
          TOUCH TO SKIP
        </div>
      )}

      {/* Menu diégétique — peg-boutons RENDUS EN CANVAS (cf. MenuButtonsCanvas),
          posés au-dessus du décor. Pop décalé au reveal, hover/press au hit-test,
          secousse aux impacts d'œufs. Le STYLE peg vient de renderer/ui/peg-button.ts
          (source unique partagée avec les inserts du HUD). */}
      <MenuButtonsCanvas
        ref={menuBtnsRef}
        buttons={menuButtons}
        visible={showMenu}
        onHover={playMenuHover}
        onClick={playMenuClick}
      />

      {/* Bannière version — petit peg doré épinglé en bas, cliquable pour les MAJ. */}
      {showMenu && (
        <div className="pg-menu-footer" style={{ pointerEvents: "auto" }}>
          <button
            className="pg-pm-version"
            onPointerEnter={playMenuHover}
            onClick={() => { playMenuClick(); setShowPatchNotes(true); }}
            title="View changelog"
          >
            CHANGELOG
            <br />
            <span className="pg-pm-version-num">V{PEAGLE_CURRENT_VERSION}</span>
          </button>
        </div>
      )}
    </div>
  );
}
