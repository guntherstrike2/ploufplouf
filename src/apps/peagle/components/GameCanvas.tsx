"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import type { RefObject, PointerEvent } from "react";
import type { UiState } from "../engine/types";
import { W, H } from "../engine/constants";
import { PG } from "../styles";
import { PixelSprite } from "./PixelSprite";
import { eagleFace } from "../renderer/face";
import type { FaceMood } from "../renderer/face";
import "../peagle.css";

// ─── Mascotte animée pour le menu pause ──────────────────────────────────────
function PauseMascot({ size = 80 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 28;
    canvas.height = 32;

    let raf = 0;
    let startT = 0;

    function frame(now: number) {
      if (!startT) startT = now;
      const t = (now - startT) / 1000;

      ctx!.clearRect(0, 0, 28, 32);
      ctx!.imageSmoothingEnabled = false;

      const mood: FaceMood = {
        blink: (t % 4.2) < 0.12,
        open: 0,
        brow: "flat",
        eyeRed: false,
        wide: false,
        look: Math.sin(t * 0.55) * 1.2,
        pop: 0,
      };

      eagleFace(ctx!, 14, 16, mood);
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        width: size,
        height: Math.round(size * 32 / 28),
        imageRendering: "pixelated",
        display: "block",
      }}
    />
  );
}

const WIN_QUIPS = [
  "L'aigle est satisfait. C'est rare. Profitez-en.",
  "Toutes les cibles détruites ! L'aigle vous invite à son nid. Refusez.",
  "Victoire ! Le phénix a pleuré. Personne ne s'en souvient mais c'est noté.",
  "Parfait. L'aigle mentionne votre score à ses amis ornithologues.",
  "Niveau bouclé. L'aigle vous remet une plume d'honneur fictive.",
  "GG. L'aigle a filmé ça sur son iPhone. Il n'a pas d'iPhone.",
];

const LOSE_QUIPS = [
  "Plus d'œufs. L'aigle hausse les épaules. Il n'a pas d'épaules.",
  "Game Over. Les cibles orange survivent. Elles vont fêter ça.",
  "L'aigle demande si vous avez lu les astuces du menu. Vous n'avez pas lu les astuces.",
  "Défaite. Le Pélican est déçu. Le Faucon dit qu'il l'avait prévu.",
  "Raté. La physique est responsable. Comme toujours. La physique ne s'excuse pas.",
  "Pas de chance. Ou de talent. L'aigle ne tranche pas.",
];

interface GameCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ui: UiState;
  bestScore: number;
  user: { name?: string | null; email?: string | null; id?: string } | null;
  isAdmin?: boolean;
  showDevTools?: boolean;
  upgradeOfferPending: boolean;
  paused: boolean;
  musicMuted: boolean;
  onResume: () => void;
  onToggleMusic: () => void;
  onPointerDown: (e: PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLCanvasElement>) => void;
  onReplay: () => void;
  onLeaderboard: () => void;
  onMenu: () => void;
  onSkipLevel?: () => void;
  onOpenDevPanel?: () => void;
}

export function GameCanvas({
  canvasRef,
  ui,
  bestScore,
  user,
  isAdmin,
  showDevTools,
  upgradeOfferPending,
  paused,
  musicMuted,
  onResume,
  onToggleMusic,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onReplay,
  onLeaderboard,
  onMenu,
  onSkipLevel,
  onOpenDevPanel,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cssSize, setCssSize] = useState({ w: W, h: H });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const area = el.closest('.pg-canvas-area') ?? el;
      const { width } = area.getBoundingClientRect();
      const { height } = el.getBoundingClientRect();
      const scaleByW = width / W;
      const scaleByH = height / H;
      const scale = H * scaleByW <= height ? scaleByW : scaleByH;
      setCssSize({ w: Math.round(W * scale), h: Math.round(H * scale) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const area = el.closest('.pg-canvas-area');
    if (area) ro.observe(area);
    return () => ro.disconnect();
  }, []);

  const isLost = ui.phase === "lost";
  const isWon = ui.phase === "won";
  const isGameOver = isLost || isWon;
  const isRecord = ui.score > 0 && ui.score >= bestScore;
  const displayUser = user?.name ?? user?.email ?? null;
  /* eslint-disable react-hooks/purity */
  const quip = useMemo(() => isWon
    ? WIN_QUIPS[Math.floor(Math.random() * WIN_QUIPS.length)]!
    : LOSE_QUIPS[Math.floor(Math.random() * LOSE_QUIPS.length)]!,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [isGameOver, isWon]);
  /* eslint-enable react-hooks/purity */

  return (
    <div
      ref={containerRef}
      className="peagle-root relative flex-1 flex items-center justify-center overflow-hidden"
      style={{ background: "transparent" }}
    >
      <div style={{ position: "relative", width: cssSize.w, height: cssSize.h }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            width: cssSize.w,
            height: cssSize.h,
            display: "block",
            imageRendering: "pixelated",
            touchAction: "none",
            background: "#060e04",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />

        {/* ── MENU PAUSE ───────────────────────────────────────────────────── */}
        {paused && !isGameOver && (
          <div className="pg-overlay-lux absolute inset-0">
            <div className="pg-lux-panel" style={{ width: 288, maxWidth: "calc(100% - 32px)" }}>

              {/* Header */}
              <div className="pg-lux-header">
                <div className="pg-lux-gem" />
                <span className="pg-lux-title">PAUSE</span>
                <div className="pg-lux-gem" />
              </div>

              {/* Body */}
              <div style={{ padding: "20px 16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>

                {/* Mascotte qui flotte */}
                <div style={{ display: "flex", justifyContent: "center", paddingBottom: 6 }} className="pg-eagle-bob">
                  <PauseMascot size={80} />
                </div>

                {/* CTA or */}
                <button onClick={onResume} className="pg-btn-gold">
                  ▶ REPRENDRE
                </button>

                {/* Secondaire vert */}
                <button onClick={onReplay} className="pg-btn-lux" style={{ fontSize: 8 }}>
                  ↻ RECOMMENCER
                </button>

                {/* Séparateur orné */}
                <div className="pg-sep-lux">
                  <div className="pg-lux-gem" style={{ width: 6, height: 6 }} />
                </div>

                {/* Toggle musique */}
                <button onClick={onToggleMusic} className="pg-toggle-row">
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PixelSprite name="note" scale={2} />
                    MUSIQUE
                  </span>
                  <span
                    className="pg-toggle-pill"
                    style={{
                      background: musicMuted ? "#140808" : "#081808",
                      color: musicMuted ? PG.red : PG.leaf,
                      borderColor: musicMuted ? "#4a1010" : PG.greenDeep,
                    }}
                  >
                    {musicMuted ? "OFF" : "ON"}
                  </span>
                </button>

                {/* Menu principal */}
                <button
                  onClick={onMenu}
                  className="pg-btn pg-btn-ghost"
                  style={{ fontSize: 7, letterSpacing: "0.06em" }}
                >
                  ≡ MENU PRINCIPAL
                </button>

                {/* Dev section */}
                {isAdmin && (
                  <div
                    style={{
                      borderTop: `1px solid ${PG.border}`,
                      paddingTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 6,
                        color: PG.purple,
                        letterSpacing: "0.12em",
                        textAlign: "center",
                        fontFamily: "var(--pg-font)",
                      }}
                    >
                      — DEV —
                    </div>
                    {showDevTools && (
                      <button
                        onClick={() => { onResume(); onSkipLevel?.(); }}
                        className="pg-btn"
                        style={{
                          fontSize: 7,
                          color: "#e0b4ff",
                          background: "linear-gradient(to bottom, #3a1d4f 0%, #2a1437 100%)",
                          borderColor: "#7a3fb0",
                        }}
                      >
                        ⏭ NIVEAU SUIVANT
                      </button>
                    )}
                    <button
                      onClick={() => { onResume(); onOpenDevPanel?.(); }}
                      className="pg-btn"
                      style={{
                        fontSize: 7,
                        color: "#e0b4ff",
                        background: "linear-gradient(to bottom, #3a1d4f 0%, #2a1437 100%)",
                        borderColor: "#7a3fb0",
                      }}
                    >
                      ⚙ DEV TOOLS
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── GAME OVER / VICTOIRE ─────────────────────────────────────────── */}
        {isGameOver && !upgradeOfferPending && (
          <div
            className={`pg-overlay-lux absolute inset-0${isLost ? " pg-overlay-lux-red" : ""}`}
          >
            {/* Particules victoire */}
            {isWon && <div className="pg-victory-particles" />}

            <div className="pg-lux-panel" style={{ width: 320, maxWidth: "calc(100% - 32px)" }}>

              {/* Header */}
              <div className="pg-lux-header">
                <PixelSprite name="eagle" scale={2} />
                <span className="pg-lux-title">PEAGLE</span>
                <div className="pg-lux-gem" />
              </div>

              {/* Body */}
              <div style={{ padding: "20px 20px 18px", fontFamily: "var(--pg-font)" }}>

                {/* Icône + titre */}
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: 12,
                      animation: isWon
                        ? "pg-trophy-hover 2.2s ease-in-out infinite"
                        : "pg-shake 0.5s ease-in-out 0.3s 2",
                    }}
                  >
                    <PixelSprite name={isWon ? "trophy" : "skull"} scale={7} />
                  </div>

                  {isWon ? (
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: "bold",
                        color: PG.gold,
                        letterSpacing: "0.1em",
                        animation: "pg-glow-victory 1.5s ease-in-out infinite",
                      }}
                    >
                      ★ VICTOIRE ! ★
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: "bold",
                        color: PG.red,
                        letterSpacing: "0.1em",
                        animation: "pg-glow-defeat 1.3s ease-in-out infinite",
                      }}
                    >
                      ✕ GAME OVER
                    </div>
                  )}
                </div>

                {/* Score héro */}
                <div className="pg-hero-score" style={{ marginBottom: 10 }}>
                  <div className="pg-hero-score-label">SCORE FINAL</div>
                  <div className="pg-hero-score-val">{ui.score.toLocaleString()}</div>
                </div>

                {/* Record */}
                {isRecord && (
                  <div
                    style={{
                      fontSize: 7,
                      textAlign: "center",
                      marginBottom: 10,
                      letterSpacing: "0.08em",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      animation: "pg-record-lux 1s ease-in-out infinite",
                    }}
                  >
                    <PixelSprite name="star" scale={2} />
                    NOUVEAU RECORD !
                    <PixelSprite name="star" scale={2} />
                  </div>
                )}

                {/* Quip aigle */}
                <div className="pg-quip-lux" style={{ marginBottom: 12 }}>
                  &ldquo;{quip}&rdquo;
                </div>

                {/* Utilisateur */}
                <div
                  style={{
                    fontSize: 7,
                    color: PG.textMuted,
                    textAlign: "center",
                    marginBottom: 16,
                    letterSpacing: "0.04em",
                  }}
                >
                  {displayUser
                    ? `▶ Score enregistré pour ${displayUser}`
                    : "Connectez-vous pour sauver votre score"}
                </div>

                {/* Séparateur orné */}
                <div className="pg-sep-lux" style={{ marginBottom: 16 }}>
                  <div className="pg-lux-gem" style={{ width: 6, height: 6 }} />
                </div>

                {/* Boutons */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {isWon && upgradeOfferPending && (
                    <div style={{ fontSize: 7, color: PG.textMuted, alignSelf: "center" }}>
                      Choix d&apos;amélioration…
                    </div>
                  )}

                  <button onClick={onReplay} className="pg-btn-red-lux" style={{ flex: 1, minWidth: 110 }}>
                    ▶ REJOUER
                  </button>

                  {isLost && (
                    <button
                      onClick={onLeaderboard}
                      className="pg-btn-gold"
                      style={{ flex: 1, minWidth: 110, fontSize: 8 }}
                    >
                      ★ CLASSEMENT
                    </button>
                  )}

                  <button
                    onClick={onMenu}
                    className="pg-btn pg-btn-ghost"
                    style={{ fontSize: 7, letterSpacing: "0.06em", width: "100%" }}
                  >
                    ≡ MENU PRINCIPAL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
