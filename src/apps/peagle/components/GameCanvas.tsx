"use client";

import { useRef, useEffect, useState, useMemo, useCallback, memo } from "react";
import type { RefObject, PointerEvent } from "react";
import type { UiState, LeaderboardEntry } from "../engine/types";
import { W, H } from "../engine/constants";
import { PG } from "../styles";
import { formatSeed } from "../engine/roguelite";
import { PixelSprite } from "./PixelSprite";
import { eagleFace } from "../renderer/face";
import type { FaceMood } from "../renderer/face";
import "../peagle.css";

// ─── Mascotte dégoûtée pour le game over ────────────────────────────────────
function GameOverMascot({ size = 100 }: { size?: number }) {
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

    // Humeur tirée au hasard à chaque game over : 0 énervé, 1 dégoûté, 2 triste.
    const variant = Math.floor(Math.random() * 3);

    function frame(now: number) {
      if (!startT) startT = now;
      const t = (now - startT) / 1000;

      ctx!.clearRect(0, 0, 28, 32);
      ctx!.imageSmoothingEnabled = false;

      // Cri d'entrée : bec grand ouvert ~2.2s, synchro avec le cri grave joué
      // sur le game over (attaque vive, flutter, fermeture douce).
      const crying = t < 2.2;

      // Traits propres à chaque humeur (sourcils, yeux, regard, larmes).
      let brow: FaceMood["brow"];
      let eyeRed = false, wide = false, tears = false, look: number;
      if (variant === 0) {
        // ÉNERVÉ : yeux rouges écarquillés, glare frontal qui tremble de rage
        brow = "angry"; eyeRed = true; wide = true;
        look = Math.sin(t * 9) * 0.6;
      } else if (variant === 1) {
        // DÉGOÛTÉ : sourcils féroces, regard fuyant de dédain
        brow = "angry";
        look = 0.65 + 0.55 * Math.sin(t * 0.38);
      } else {
        // TRISTE : sourcils inquiets, larmes, regard bas qui dérive
        brow = "up"; tears = true;
        look = Math.sin(t * 0.5) * 0.5;
      }

      // Clignement lent et rare — suspendu pendant le cri (glare/sanglot soutenu)
      const blinkT = t % 6.4;
      const blink: FaceMood["blink"] = (!crying && blinkT < 0.13) ? "both" : "none";

      // Le cri d'entrée porte selon l'humeur : ample et sec pour l'énervé,
      // plus retenu pour le triste.
      const cryAmp = variant === 0 ? 1.0 : variant === 2 ? 0.72 : 0.9;

      let open: number;
      if (crying) {
        const atk = Math.min(1, t / 0.06);
        const rel = Math.min(1, (2.2 - t) / 0.3);
        const flutter = 0.85 + 0.15 * Math.sin(t * (variant === 0 ? 34 : 26));
        open = Math.max(0, Math.min(1, atk * rel * flutter)) * cryAmp;
      } else if (variant === 0) {
        // énervé : petits squawks secs répétés (« il rage encore »)
        const c = t % 1.6;
        open = c < 0.18 ? 0.5 * Math.sin((c / 0.18) * Math.PI) : 0;
      } else if (variant === 1) {
        // dégoûté : soupir occasionnel toutes les ~7s
        const c = t % 7.0;
        open = c > 4.2 && c < 5.1 ? 0.32 * Math.sin(((c - 4.2) / 0.9) * Math.PI) : 0;
      } else {
        // triste : bec entrouvert qui tremblote (sanglot)
        open = Math.max(0, 0.1 + 0.1 * Math.sin(t * 5.5));
      }

      const mood: FaceMood = {
        blink,
        open,
        brow,
        eyeRed,
        wide,
        look,
        pop: 0,
        starEyes: false,
        tears,
        drowsyEyes: false,
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
        blink: (t % 4.2) < 0.12 ? "both" : "none",
        open: 0,
        brow: "flat",
        eyeRed: false,
        wide: false,
        look: Math.sin(t * 0.55) * 1.2,
        pop: 0,
        starEyes: false,
        tears: false,
        drowsyEyes: false,
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

// ─── Mini-classement diégétique pour le game over ───────────────────────────
// Une ligne du ciel des chasseurs : rang, nom, score (joueur courant surligné).
function RankRow({ entry, rank, me }: { entry: LeaderboardEntry; rank: number; me: boolean }) {
  const name = entry.displayUsername || entry.username || entry.name;
  const badgeCls =
    rank === 1 ? "pg-lb-badge pg-lb-badge-gold"
    : rank === 2 ? "pg-lb-badge pg-lb-badge-silver"
    : rank === 3 ? "pg-lb-badge pg-lb-badge-bronze"
    : "pg-lb-badge pg-lb-badge-plain";
  return (
    <div className={`pg-go-rank-row${me ? " pg-go-rank-me" : ""}`}>
      <span className={badgeCls} style={{ width: 18, height: 18, fontSize: 7 }}>{rank}</span>
      <span className="pg-go-rank-name">
        {name}{me && <span className="pg-go-rank-you"> · vous</span>}
      </span>
      <span className="pg-go-rank-score">{entry.score.toLocaleString()}</span>
    </div>
  );
}

// Montre la place du joueur dans le ciel des chasseurs, calé sur l'esthétique
// flottante de l'overlay (pas de gros panneau). On affiche le podium, puis la
// ligne du joueur s'il est plus bas, le tout sans casser le rythme score → quip.
function GameOverRanking({
  entries,
  loading,
  currentUserId,
  playerScore,
  isLoggedIn,
}: {
  entries: LeaderboardEntry[];
  loading: boolean;
  currentUserId?: string;
  playerScore: number;
  isLoggedIn: boolean;
}) {
  if (loading && entries.length === 0) {
    return (
      <div className="pg-go-rank">
        <div className="pg-go-rank-hint">Lecture du registre des chasseurs…</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="pg-go-rank">
        <div className="pg-go-rank-hint">Premier sang. Le ciel n&rsquo;a pas encore de maître.</div>
      </div>
    );
  }

  const myIdx = currentUserId ? entries.findIndex((e) => e.userId === currentUserId) : -1;

  // Podium (top 3) toujours visible ; on ajoute la ligne du joueur s'il est plus bas.
  const podium = entries.slice(0, 3);
  const showMyRow = myIdx >= 3;
  const showOutside = isLoggedIn && myIdx === -1;

  return (
    <div className="pg-go-rank">
      <div className="pg-go-rank-label">CIEL DES CHASSEURS</div>
      {podium.map((e, i) => (
        <RankRow key={e.userId} entry={e} rank={i + 1} me={i === myIdx} />
      ))}

      {showMyRow && (
        <>
          <div className="pg-go-rank-ell">⋮</div>
          <RankRow entry={entries[myIdx]!} rank={myIdx + 1} me />
        </>
      )}

      {showOutside && (
        <>
          <div className="pg-go-rank-ell">⋮</div>
          <div className="pg-go-rank-row pg-go-rank-me">
            <span className="pg-lb-badge pg-lb-badge-plain" style={{ width: 18, height: 18, fontSize: 7 }}>—</span>
            <span className="pg-go-rank-name">
              vous<span className="pg-go-rank-you"> · hors top 10</span>
            </span>
            <span className="pg-go-rank-score">{playerScore.toLocaleString()}</span>
          </div>
        </>
      )}

      {!isLoggedIn && (
        <div className="pg-go-rank-hint">Connectez-vous pour marquer votre nid au classement.</div>
      )}
    </div>
  );
}

interface GameCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ui: UiState;
  currentSeed: number;
  leaderboard: LeaderboardEntry[];
  lbLoading: boolean;
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
  onReplaySeed: () => void;
  onLeaderboard: () => void;
  onMenu: () => void;
  onSkipLevel?: () => void;
  onOpenDevPanel?: () => void;
}

function GameCanvasComponent({
  canvasRef,
  ui,
  currentSeed,
  leaderboard,
  lbLoading,
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
  onReplaySeed,
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

  const [seedCopied, setSeedCopied] = useState(false);
  const seedCode = formatSeed(currentSeed);

  const copySeed = useCallback(() => {
    navigator.clipboard.writeText(seedCode).catch(() => {});
    setSeedCopied(true);
    setTimeout(() => setSeedCopied(false), 1800);
  }, [seedCode]);

  const isLost = ui.phase === "lost";
  const isWon = ui.phase === "won";
  const isGameOver = isLost || isWon;
  const isRecord = ui.isNewRecord;
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
          <div className="pg-diag-overlay absolute inset-0">

            {/* Titre */}
            <div className="pg-diag-title pg-diag-title-pause">⏸ PAUSE</div>

            {/* Mascotte */}
            <div className="pg-eagle-bob" style={{ marginBottom: 10 }}>
              <PauseMascot size={60} />
            </div>

            {/* Boutons */}
            <div className="pg-diag-btns">
              <button onClick={onResume} className="pg-diag-btn pg-diag-btn-primary">
                ▶ REPRENDRE
              </button>
              <button onClick={onReplay} className="pg-diag-btn">
                ↻ RECOMMENCER
              </button>
              <div className="pg-diag-sep" />
              <button
                onClick={onToggleMusic}
                className="pg-diag-btn"
              >
                ♪ MUSIQUE
                <span
                  className="pg-diag-toggle-pill"
                  style={{
                    borderColor: musicMuted ? "#4a1010" : PG.greenDeep,
                    color: musicMuted ? PG.red : PG.leaf,
                    background: musicMuted ? "#140808" : "#081808",
                  }}
                >
                  {musicMuted ? "OFF" : "ON"}
                </span>
              </button>
              <button
                onClick={copySeed}
                className="pg-diag-btn pg-diag-btn-muted"
                title="Copier le code seed"
              >
                {seedCopied ? "✓ COPIÉ !" : `SEED : ${seedCode}`}
              </button>
              <button onClick={onMenu} className="pg-diag-btn pg-diag-btn-muted">
                ≡ MENU PRINCIPAL
              </button>
            </div>

            {/* Section dev */}
            {isAdmin && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ fontSize: 6, color: PG.purple, letterSpacing: "0.12em", fontFamily: "var(--pg-font)", marginBottom: 2 }}>
                  — DEV —
                </div>
                {showDevTools && (
                  <button
                    onClick={() => { onResume(); onSkipLevel?.(); }}
                    className="pg-diag-btn"
                    style={{ color: PG.purpleHi, textShadow: `0 0 8px ${PG.purple}, 0 2px 3px rgba(0,0,0,0.95)` }}
                  >
                    ⏭ NIVEAU SUIVANT
                  </button>
                )}
                <button
                  onClick={() => { onResume(); onOpenDevPanel?.(); }}
                  className="pg-diag-btn"
                  style={{ color: PG.purpleHi, textShadow: `0 0 8px ${PG.purple}, 0 2px 3px rgba(0,0,0,0.95)` }}
                >
                  ⚙ DEV TOOLS
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── GAME OVER (défaite) ──────────────────────────────────────────── */}
        {isLost && !upgradeOfferPending && (
          <div className="pg-diag-overlay absolute inset-0 pg-diag-overlay-lost">

            {/* Tête d'aigle dégoûtée */}
            <div className="pg-gameover-face" style={{ marginBottom: 10 }}>
              <GameOverMascot size={100} />
            </div>

            {/* Titre */}
            <div className="pg-diag-title pg-diag-title-lost">✕ GAME OVER</div>

            {/* Score */}
            <div className="pg-diag-score">
              <div className="pg-diag-score-label">SCORE FINAL</div>
              <div className="pg-diag-score-val">{ui.score.toLocaleString()}</div>
            </div>

            {isRecord && (
              <div className="pg-diag-record">★ NOUVEAU RECORD ! ★</div>
            )}

            {/* Quip aigle */}
            <div className="pg-quip-lux" style={{ marginBottom: 8, maxWidth: "min(260px, 82%)" }}>
              &ldquo;{quip}&rdquo;
            </div>

            {/* Mini-classement — la place du joueur, montrée sur place */}
            <GameOverRanking
              entries={leaderboard}
              loading={lbLoading}
              currentUserId={user?.id}
              playerScore={ui.score}
              isLoggedIn={!!user}
            />

            <div className="pg-diag-sep" />

            {/* Actions */}
            <div className="pg-diag-btn-row">
              <button onClick={onReplay} className="pg-diag-btn pg-diag-btn-primary">
                ▶ REJOUER
              </button>
              <button onClick={onLeaderboard} className="pg-diag-btn pg-diag-btn-gold">
                ★ CLASSEMENT
              </button>
            </div>

            <button onClick={onMenu} className="pg-diag-btn pg-diag-btn-muted">
              ≡ MENU PRINCIPAL
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// Mémoïsé : le parent (PeagleApp) re-render à chaque sync UI, mais GameCanvas
// ne doit re-render que si ses props changent réellement.
export const GameCanvas = memo(GameCanvasComponent);
