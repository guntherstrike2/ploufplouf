"use client";

import { useState, useCallback } from "react";
import "../peagle.css";
import "../palette-style";
import { PG } from "../styles";
import { PegBtn } from "./PegBtn";
import { usePeagleSounds } from "../hooks/usePeagleSounds";
import { parseSeed, formatSeed } from "../engine/roguelite";
import { getVisualSettings, setScanlines, setPixel, setScreenShake } from "../engine/visual-settings";

/**
 * Menu Options partagé — même carte diégétique (`pg-settings-card`) pour le menu
 * principal ET la pause. Regroupe Musique, réglages visuels (Scanlines, Pixel).
 *
 * Le seed se comporte différemment selon le contexte :
 * - menu principal (`currentSeed` absent) → champ de saisie pour lancer une
 *   partie avec un code précis.
 * - en partie (`currentSeed` fourni) → simple affichage de la seed en cours,
 *   en lecture seule (on ne change pas de seed au milieu d'un run).
 */
interface OptionsProps {
  musicMuted: boolean;
  onToggleMusic: () => void;
  /** Lance une partie avec le seed saisi (menu principal uniquement). */
  onPlaySeed?: (seed: number) => void;
  /** Seed de la partie en cours — si fourni, affiché en lecture seule. */
  currentSeed?: number;
  onClose: () => void;
}

function ToggleRow({
  label, on, onToggle, onHover,
}: { label: string; on: boolean; onToggle: () => void; onHover?: () => void }) {
  return (
    <div className="pg-settings-row">
      <span>{label}</span>
      <PegBtn
        variant={on ? "primary" : "neutral"}
        size="sm"
        onPointerEnter={onHover}
        onClick={onToggle}
      >
        {on ? "ON" : "OFF"}
      </PegBtn>
    </div>
  );
}

export function Options({
  musicMuted,
  onToggleMusic,
  onPlaySeed,
  currentSeed,
  onClose,
}: OptionsProps) {
  const { playMenuClick, playMenuHover } = usePeagleSounds();
  const [scan, setScan] = useState(() => getVisualSettings().scanlines);
  const [pix, setPix] = useState(() => getVisualSettings().pixel);
  const [shake, setShake] = useState(() => getVisualSettings().screenShake);
  const [seedInput, setSeedInput] = useState("");
  const [seedError, setSeedError] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);

  // En partie : on n'affiche que la seed en cours (lecture seule).
  const inGame = currentSeed !== undefined;

  const handlePlaySeed = useCallback(() => {
    const clean = seedInput.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (!clean) { setSeedError(true); return; }
    setSeedError(false);
    playMenuClick();
    onPlaySeed?.(parseSeed(clean));
  }, [seedInput, onPlaySeed, playMenuClick]);

  const copySeed = useCallback(() => {
    if (currentSeed === undefined) return;
    navigator.clipboard.writeText(formatSeed(currentSeed)).catch(() => {});
    playMenuClick();
    setSeedCopied(true);
    setTimeout(() => setSeedCopied(false), 1800);
  }, [currentSeed, playMenuClick]);

  return (
    <div
      className="pg-settings-overlay"
      onClick={() => { playMenuClick(); onClose(); }}
    >
      <div className="pg-settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="pg-settings-body">
          <ToggleRow
            label="MUSIQUE"
            on={!musicMuted}
            onHover={playMenuHover}
            onToggle={() => { playMenuClick(); onToggleMusic(); }}
          />

          <ToggleRow
            label="SCANLINES"
            on={scan}
            onHover={playMenuHover}
            onToggle={() => { playMenuClick(); const v = !scan; setScanlines(v); setScan(v); }}
          />

          <ToggleRow
            label="PIXEL"
            on={pix}
            onHover={playMenuHover}
            onToggle={() => { playMenuClick(); const v = !pix; setPixel(v); setPix(v); }}
          />

          <ToggleRow
            label="TREMBLEMENT"
            on={shake}
            onHover={playMenuHover}
            onToggle={() => { playMenuClick(); const v = !shake; setScreenShake(v); setShake(v); }}
          />

          <div className="pg-settings-divider" aria-hidden />

          {/* ── Seed ─────────────────────────────────────────────
              En partie : seed en cours, en lecture seule.
              Au menu : champ de saisie pour lancer un code précis. */}
          {inGame ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 7, letterSpacing: "0.06em", color: PG.textMuted }}>SEED EN COURS</span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{
                  flex: 1,
                  fontFamily: "var(--pg-font)",
                  fontSize: 11,
                  color: PG.leaf,
                  letterSpacing: "0.16em",
                }}>
                  {formatSeed(currentSeed)}
                </span>
                <PegBtn
                  variant="primary"
                  size="sm"
                  onPointerEnter={playMenuHover}
                  onClick={copySeed}
                >
                  {seedCopied ? "COPIÉ !" : "COPIER"}
                </PegBtn>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 7, letterSpacing: "0.06em", color: PG.textMuted }}>SEED (6 CAR.)</span>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="ex: 4XZ2K1"
                  value={seedInput}
                  onChange={e => { setSeedInput(e.target.value.toUpperCase()); setSeedError(false); }}
                  onKeyDown={e => { if (e.key === "Enter") handlePlaySeed(); }}
                  style={{
                    flex: 1,
                    fontFamily: "var(--pg-font)",
                    fontSize: 9,
                    padding: "6px 8px",
                    background: seedError ? "#2a0808" : PG.bg,
                    color: seedError ? PG.red : PG.leaf,
                    border: `2px solid ${seedError ? "#aa3333" : PG.border}`,
                    borderRadius: 6,
                    outline: "none",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                />
                <PegBtn
                  variant="primary"
                  size="sm"
                  onPointerEnter={playMenuHover}
                  onClick={handlePlaySeed}
                >
                  JOUER
                </PegBtn>
              </div>
              {seedError && (
                <span style={{ fontSize: 6, color: PG.red, letterSpacing: "0.04em" }}>
                  Entre un code valide (A-Z, 0-9)
                </span>
              )}
            </div>
          )}

          <PegBtn
            variant="primary"
            style={{ alignSelf: "center", marginTop: 8 }}
            onPointerEnter={playMenuHover}
            onClick={() => { playMenuClick(); onClose(); }}
          >
            FERMER
          </PegBtn>
        </div>
      </div>
    </div>
  );
}
