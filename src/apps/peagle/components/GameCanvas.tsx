"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import type { RefObject, PointerEvent } from "react";
import type { UiState } from "../engine/types";
import { W, H } from "../engine/constants";
import { captionBtn, btnRaised, PG } from "../styles";
import "../peagle.css";

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
      // In landscape the canvas-area has a CSS aspect-ratio so height is always
      // proportional to width — use Math.min to fit within both axes.
      // In portrait we want the canvas to always fill the full width (no black
      // side bands), so we only clamp by height if the canvas would overflow.
      const scaleByW = width / W;
      const scaleByH = height / H;
      // If fitting by width makes the canvas taller than available height, clamp.
      // Otherwise always use width so there are no left/right black bands.
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
      {/* Wrapper exactement à la taille du canvas → overlays alignés sur le jeu */}
      <div style={{ position: "relative", width: cssSize.w, height: cssSize.h }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          width: cssSize.w,
          height: cssSize.h,
          // curseur géré dynamiquement dans la boucle rAF (cf. useGameLoop) :
          // grab/grabbing au survol & drag de l'aigle, crosshair en visée
          display: "block",
          imageRendering: "pixelated",
          touchAction: "none",
          background: "#060e04",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* Le bouton pause est taillé dans l'enseigne HUD (dessiné dans le canvas,
          hit-testé dans useGameLoop) — pas de bouton HTML flottant ici. */}

      {/* ── Menu de pause façon mobile ── */}
      {paused && !isGameOver && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(4,8,3,0.82)", zIndex: 6, fontFamily: "var(--pg-font)" }}
        >
          <div
            className="pg-dialog"
            style={{ minWidth: 260, maxWidth: 320, animation: "pg-slide-up 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}
          >
            <div className="pg-titlebar">
              <span style={{ fontSize: 8, color: "#aaaaee", flex: 1, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5 }}>
                ❚❚ PAUSE
              </span>
              {(["─", "□", "×"] as const).map(ch => (
                <div key={ch} style={captionBtn}>{ch}</div>
              ))}
            </div>

            <div style={{ padding: "22px 22px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ textAlign: "center", fontSize: 30, lineHeight: 1, marginBottom: 4 }}>🦅</div>

              <button
                onClick={onResume}
                style={{
                  ...btnRaised,
                  fontSize: 9,
                  padding: "11px 16px",
                  background: `linear-gradient(to bottom, ${PG.orange}, #cc4400)`,
                  color: "#fff",
                  borderTopColor: PG.orangeGlow,
                  borderLeftColor: PG.orangeGlow,
                  borderBottomColor: "#882200",
                  borderRightColor: "#882200",
                  textShadow: "0 1px 0 rgba(0,0,0,0.5)",
                }}
              >
                ▶ REPRENDRE
              </button>

              <button onClick={onReplay} style={{ ...btnRaised, fontSize: 8, padding: "10px 16px", color: PG.text }}>
                ↻ RECOMMENCER
              </button>

              <button
                onClick={onToggleMusic}
                style={{ ...btnRaised, fontSize: 8, padding: "10px 16px", color: musicMuted ? PG.textMuted : PG.cyan, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span>{musicMuted ? "♪̸ MUSIQUE" : "♪ MUSIQUE"}</span>
                <span style={{ color: musicMuted ? PG.red : PG.green }}>{musicMuted ? "OFF" : "ON"}</span>
              </button>

              <button onClick={onMenu} style={{ ...btnRaised, fontSize: 8, padding: "10px 16px", color: PG.textMuted }}>
                ≡ MENU PRINCIPAL
              </button>

              {isAdmin && (
                <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${PG.sh}`, paddingTop: 12 }}>
                  <div style={{ fontSize: 6, color: PG.purple, letterSpacing: "0.1em", textAlign: "center" }}>— DEV —</div>
                  {showDevTools && (
                    <button
                      onClick={() => { onResume(); onSkipLevel?.(); }}
                      style={{ ...btnRaised, fontSize: 8, padding: "9px 16px", color: "#cc88ff", background: "rgba(20,10,30,0.6)", borderTopColor: "#7a4aaa", borderLeftColor: "#7a4aaa" }}
                    >
                      ⏭ NIVEAU SUIVANT
                    </button>
                  )}
                  <button
                    onClick={() => { onResume(); onOpenDevPanel?.(); }}
                    style={{ ...btnRaised, fontSize: 8, padding: "9px 16px", color: "#cc88ff", background: "rgba(20,10,30,0.6)", borderTopColor: "#7a4aaa", borderLeftColor: "#7a4aaa" }}
                  >
                    ⚙ DEV TOOLS
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isGameOver && !upgradeOfferPending && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.80)" }}
        >
          {/* Overlay de particules — faux confetti avec dots CSS */}
          {isWon && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `
                  radial-gradient(circle, ${PG.gold} 1px, transparent 1px),
                  radial-gradient(circle, ${PG.orange} 1px, transparent 1px),
                  radial-gradient(circle, ${PG.cyan} 1px, transparent 1px)
                `,
                backgroundSize: "60px 60px, 90px 90px, 75px 75px",
                backgroundPosition: "10px 10px, 30px 40px, 50px 15px",
                opacity: 0.15,
                animation: "pg-star-slide 4s linear infinite",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Dialog */}
          <div
            className="pg-dialog"
            style={{
              minWidth: 280,
              maxWidth: 340,
              fontFamily: "var(--pg-font)",
              animation: "pg-slide-up 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {/* Titlebar */}
            <div className="pg-titlebar">
              <span style={{ fontSize: 8, color: "#aaaaee", flex: 1, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5 }}>
                🦅 PEAGLE 98
              </span>
              {(["─", "□", "×"] as const).map((ch) => (
                <div key={ch} style={captionBtn}>{ch}</div>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding: "22px 24px 16px" }}>
              {/* Big icon + titre */}
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 48,
                    lineHeight: 1,
                    marginBottom: 12,
                    animation: isWon
                      ? "pg-pulse-orange 1.5s ease-in-out infinite"
                      : "pg-shake 0.5s ease-in-out 0.3s 2",
                  }}
                >
                  {isWon ? "🏆" : "💀"}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: "bold",
                    color: isWon ? PG.orange : PG.red,
                    letterSpacing: "0.08em",
                    textShadow: isWon
                      ? `0 0 16px ${PG.orange}`
                      : `0 0 16px ${PG.red}`,
                    marginBottom: 4,
                  }}
                >
                  {isWon ? "VICTOIRE !" : "GAME OVER"}
                </div>
              </div>

              {/* Score */}
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 7, color: PG.textMuted, marginBottom: 6, letterSpacing: "0.1em" }}>
                  SCORE FINAL
                </div>
                <div
                  className="pg-sunken"
                  style={{ display: "inline-block", padding: "6px 20px" }}
                >
                  <span style={{ fontSize: 20, fontWeight: "bold", color: PG.text }}>
                    {ui.score.toLocaleString()}
                  </span>
                </div>

                {isRecord && (
                  <div
                    style={{
                      fontSize: 8,
                      marginTop: 8,
                      letterSpacing: "0.08em",
                      animation: "pg-record-flash 1s ease-in-out infinite",
                    }}
                  >
                    ⭐ NOUVEAU RECORD !
                  </div>
                )}
              </div>

              {/* Quip aigle */}
              <div
                style={{
                  fontSize: 7,
                  color: isWon ? PG.gold : PG.textMuted,
                  textAlign: "center",
                  marginBottom: 10,
                  fontStyle: "italic",
                  fontFamily: "var(--font-vt323), monospace",
                  lineHeight: 1.4,
                }}
              >
                &ldquo;{quip}&rdquo;
              </div>

              {/* User info */}
              <div style={{ fontSize: 7, color: PG.textMuted, textAlign: "center", marginBottom: 16, letterSpacing: "0.04em" }}>
                {displayUser
                  ? `▶ Score enregistré pour ${displayUser}`
                  : "Connectez-vous pour sauver votre score"}
              </div>

              {/* Separator */}
              <div className="pg-sep" style={{ marginBottom: 14 }} />

              {/* Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {isWon && (
                  <div
                    style={{
                      ...btnRaised,
                      cursor: "default",
                      opacity: 0.5,
                      fontSize: 7,
                      display: "flex",
                      alignItems: "center",
                      color: PG.textMuted,
                    }}
                  >
                    Choix d&apos;amélioration…
                  </div>
                )}
                <button
                  onClick={onReplay}
                  style={{
                    ...btnRaised,
                    fontSize: 8,
                    background: `linear-gradient(to bottom, ${PG.orange}, #cc4400)`,
                    color: "#fff",
                    borderTopColor: PG.orangeGlow,
                    borderLeftColor: PG.orangeGlow,
                    borderBottomColor: "#882200",
                    borderRightColor: "#882200",
                    textShadow: "0 1px 0 rgba(0,0,0,0.5)",
                  }}
                >
                  ▶ REJOUER
                </button>
                {isLost && (
                  <button onClick={onLeaderboard} style={{ ...btnRaised, fontSize: 8, color: PG.gold }}>
                    ★ CLASSEMENT
                  </button>
                )}
                <button onClick={onMenu} style={{ ...btnRaised, fontSize: 8, color: PG.textMuted }}>
                  ≡ MENU
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

