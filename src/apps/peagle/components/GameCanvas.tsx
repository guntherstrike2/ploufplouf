"use client";

import { useRef, useEffect, useState, useMemo, memo } from "react";
import type { RefObject, PointerEvent } from "react";
import type { UiState, LeaderboardEntry } from "../engine/types";
import { W, H } from "../engine/constants";
import { PG } from "../styles";
import { randomTip } from "../engine/tips";
import { WIN_QUIPS, LOSE_QUIPS, RECORD_QUIPS } from "../engine/quips";
import { Options } from "./Options";
import { ScreenOverlayCanvas } from "./ScreenOverlayCanvas";
import type { ScreenBlock, RankingModel, RankRowModel } from "../renderer/ui/screen";
import { usePeagleSounds } from "../hooks/usePeagleSounds";
import "../peagle.css";
import "../palette-style";

// ─── Construction du modèle de classement (porté de l'ex-GameOverRanking) ───────
// Podium top 3 ; + la ligne du joueur s'il est plus bas ; + une ligne « outside top
// 10 » s'il est loggé mais absent ; + un hint si déloggé. Dessiné en canvas par
// renderer/ui/screen.ts (drawRanking).
function buildRankingModel(
  entries: LeaderboardEntry[], loading: boolean,
  currentUserId: string | undefined, playerScore: number, isLoggedIn: boolean,
): RankingModel {
  if (loading && entries.length === 0) return { kind: "loading" };
  if (entries.length === 0) return { kind: "empty" };

  const myIdx = currentUserId ? entries.findIndex((e) => e.userId === currentUserId) : -1;
  const rows: RankRowModel[] = [];
  const toRow = (e: LeaderboardEntry, rank: number, me: boolean): RankRowModel => ({
    rank, score: e.score, me,
    name: e.displayUsername || e.username || e.name,
    suffix: me ? " · you" : undefined,
  });

  entries.slice(0, 3).forEach((e, i) => rows.push(toRow(e, i + 1, i === myIdx)));

  let gapBeforeLast = false;
  if (myIdx >= 3) {
    rows.push(toRow(entries[myIdx]!, myIdx + 1, true));
    gapBeforeLast = true;
  } else if (isLoggedIn && myIdx === -1) {
    rows.push({ rank: "—", score: playerScore, me: true, name: "you", suffix: " · outside top 10" });
    gapBeforeLast = true;
  }

  const hint = !isLoggedIn ? "Log in to stake your nest on the leaderboard." : undefined;
  return { kind: "rows", rows, gapBeforeLast, hint };
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

  const [showOptions, setShowOptions] = useState(false);

  // Referme le panneau Options dès que la pause se lève (sinon il réapparaîtrait
  // à la prochaine pause).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!paused) setShowOptions(false);
  }, [paused]);

  const isLost = ui.phase === "lost";
  const isWon = ui.phase === "won";
  const isGameOver = isLost || isWon;
  const isRecord = ui.isNewRecord;
  /* eslint-disable react-hooks/purity */
  const quip = useMemo(() => {
    if (isRecord) return RECORD_QUIPS[Math.floor(Math.random() * RECORD_QUIPS.length)]!;
    if (isWon) return WIN_QUIPS[Math.floor(Math.random() * WIN_QUIPS.length)]!;
    return LOSE_QUIPS[Math.floor(Math.random() * LOSE_QUIPS.length)]!;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver, isWon, isRecord]);
  // Astuce fraîche à chaque ouverture de la pause / à chaque game over.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pauseTip = useMemo(() => randomTip(), [paused]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gameOverTip = useMemo(() => randomTip(), [isGameOver]);
  // Humeur de la mascotte game-over (0 énervé / 1 dégoûté / 2 triste) — tirée UNE
  // fois par game over, stable sur toutes les frames (pas dans la boucle rAF).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const goVariant = useMemo(() => Math.floor(Math.random() * 3) as 0 | 1 | 2, [isGameOver]);
  /* eslint-enable react-hooks/purity */

  // Sons d'interaction des boutons canvas (hover / clic) — mêmes que le menu.
  const { playMenuHover, playMenuClick } = usePeagleSounds();

  // ── Listes de blocs des deux écrans (mémoïsées sur leurs dépendances) ──────────
  const pauseBlocks = useMemo<ScreenBlock[]>(() => {
    const main = [
      { label: "RESUME", variant: "play" as const, onClick: onResume },
      { label: "RESTART", variant: "primary" as const, onClick: onReplay },
    ];
    const sub = [
      { label: "OPTIONS", variant: "primary" as const, onClick: () => setShowOptions(true) },
      { label: "MAIN MENU", variant: "primary" as const, onClick: onMenu },
    ];
    const blocks: ScreenBlock[] = [
      { kind: "mascot", spec: { kind: "pause" } },
      { kind: "buttons", items: main },
      { kind: "sep" },
      { kind: "buttons", items: sub },
    ];
    if (isAdmin) {
      const dev = [];
      if (showDevTools) dev.push({ label: "NEXT LEVEL", variant: "ghost" as const, tint: PG.purpleHi, onClick: () => { onResume(); onSkipLevel?.(); } });
      dev.push({ label: "DEV TOOLS", variant: "ghost" as const, tint: PG.purpleHi, onClick: () => { onResume(); onOpenDevPanel?.(); } });
      blocks.push({ kind: "buttons", items: dev, caption: "— DEV —" });
    }
    blocks.push({ kind: "tip", label: "TIP", text: pauseTip });
    return blocks;
  }, [onResume, onReplay, onMenu, onSkipLevel, onOpenDevPanel, isAdmin, showDevTools, pauseTip]);

  const lostBlocks = useMemo<ScreenBlock[]>(() => {
    const ranking = buildRankingModel(leaderboard, lbLoading, user?.id, ui.score, !!user);
    const blocks: ScreenBlock[] = [
      { kind: "bubble", text: quip },
      { kind: "mascot", spec: { kind: "gameover", variant: goVariant } },
      { kind: "title", text: "GAME OVER", glow: "lost" },
      { kind: "score", label: "FINAL SCORE", value: ui.score.toLocaleString() },
    ];
    if (isRecord) blocks.push({ kind: "record", text: "NEW RECORD!" });
    if (ranking.kind !== "empty") blocks.push({ kind: "ranking", model: ranking });
    blocks.push({ kind: "sep" });
    blocks.push({ kind: "buttons", items: [
      { label: "PLAY AGAIN", variant: "play", onClick: onReplay },
      { label: "LEADERBOARD", variant: "primary", onClick: onLeaderboard },
      { label: "MAIN MENU", variant: "primary", onClick: onMenu },
    ] });
    blocks.push({ kind: "tip", label: "TIP", text: gameOverTip, go: true });
    return blocks;
  }, [quip, goVariant, ui.score, isRecord, leaderboard, lbLoading, user, onReplay, onLeaderboard, onMenu, gameOverTip]);

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
            background: PG.bgDeep,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />

        {/* ── MENU PAUSE (canvas) ──────────────────────────────────────────── */}
        {/* Non-interactif quand Options est ouvert → les clics vont au dialogue DOM. */}
        <ScreenOverlayCanvas
          visible={paused && !isGameOver}
          variant="pause"
          blocks={pauseBlocks}
          cursorTracksMascot
          interactive={!showOptions}
          onHover={playMenuHover}
          onClick={playMenuClick}
        />

        {/* ── GAME OVER / défaite (canvas) ─────────────────────────────────── */}
        <ScreenOverlayCanvas
          visible={isLost && !upgradeOfferPending}
          variant="lost"
          blocks={lostBlocks}
          onHover={playMenuHover}
          onClick={playMenuClick}
        />

        {/* Menu Options — reste DOM (formulaire), posé AU-DESSUS de l'overlay canvas
            (zIndex 7 > 6). En partie le seed est en lecture seule (pas de changement
            en plein run). L'overlay pause devient non-interactif pendant ce temps. */}
        {paused && !isGameOver && showOptions && (
          <div style={{ position: "absolute", inset: 0, zIndex: 7 }}>
            <Options
              musicMuted={musicMuted}
              onToggleMusic={onToggleMusic}
              currentSeed={currentSeed}
              onClose={() => setShowOptions(false)}
            />
          </div>
        )}

      </div>
    </div>
  );
}

// Mémoïsé : le parent (PeagleApp) re-render à chaque sync UI, mais GameCanvas
// ne doit re-render que si ses props changent réellement.
export const GameCanvas = memo(GameCanvasComponent);
