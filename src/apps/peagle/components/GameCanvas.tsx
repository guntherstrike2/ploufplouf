"use client";

import { useRef, useEffect, useState, useMemo, memo } from "react";
import type { RefObject, PointerEvent } from "react";
import type { UiState, LeaderboardEntry } from "../engine/types";
import { W, H } from "../engine/constants";
import { PG } from "../styles";
import { eagleFace } from "../renderer/face";
import type { FaceMood } from "../renderer/face";
import { randomTip } from "../engine/tips";
import { PegBtn } from "./PegBtn";
import { Options } from "./Options";
import "../peagle.css";
import "../palette-style";

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
        recoil: 0,
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
  // Regard suivi : `look` lissé vers la cible dictée par la position du curseur.
  const lookRef = useRef(0);
  const targetLookRef = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 28;
    canvas.height = 32;

    // Cible le regard sur l'horizontale du curseur, relative au centre de la tête.
    function onPointerMove(e: globalThis.PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const dx = e.clientX - cx;
      // Mappe l'écart vers -1..1, saturé à ~120px de chaque côté.
      targetLookRef.current = Math.max(-1, Math.min(1, dx / 120));
    }
    window.addEventListener("pointermove", onPointerMove);

    let raf = 0;
    let startT = 0;

    function frame(now: number) {
      if (!startT) startT = now;
      const t = (now - startT) / 1000;

      // Lissage vers la cible (suivi souple, pas de saccade).
      lookRef.current += (targetLookRef.current - lookRef.current) * 0.18;

      ctx!.clearRect(0, 0, 28, 32);
      ctx!.imageSmoothingEnabled = false;

      const mood: FaceMood = {
        blink: (t % 4.2) < 0.12 ? "both" : "none",
        open: 0,
        brow: "flat",
        eyeRed: false,
        wide: false,
        look: lookRef.current,
        pop: 0,
        starEyes: false,
        tears: false,
        drowsyEyes: false,
        recoil: 0,
      };

      eagleFace(ctx!, 14, 16, mood);
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
    };
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
  "The eagle is satisfied. That's rare. Enjoy it.",
  "All targets down! The eagle invites you to his nest. Decline.",
  "Victory! The phoenix shed a tear. Nobody remembers it but it's noted.",
  "Perfect. The eagle mentions your score to his ornithologist friends.",
  "Level cleared. The eagle awards you a fictional feather of honor.",
  "GG. The eagle filmed that on his iPhone. He doesn't have an iPhone.",
];

const LOSE_QUIPS = [
  "You aim like a penguin. And penguins don't have hands.",
  "Even my eggs have more talent than you.",
  "I've seen turtles do better. Dead turtles.",
  "Keep this up and I'll be forced to migrate.",
  "My feathers fall out one by one every time you play.",
  "I've survived tornadoes. Not this score.",
  "Did you know eagles have vision 8× sharper than humans? You missed stuff 50 pixels wide.",
  "I'm a symbol of freedom and grandeur. You're a disgrace.",
  "Even a chick that hatched yesterday would do better.",
  "The Roman Empire had an eagle as its emblem. They still fell. Now I understand why.",
  "How did you even play that? With your eyes shut?",
  "I will not cry. Eagles don't cry. *cries*",
  "They say the eagle always flies alone. After watching you play, I get it.",
  "I have razor-sharp talons. I'll say no more.",
  "Someone should ban you from touching this game.",
  "I'm the king of the skies. You're not even king of your keyboard.",
  "Squirrels play better than you. Yes. Squirrels.",
  "I dive at 150 km/h. You just dive in score.",
  "My eagle grandmother plays better. And she's 40 years old.",
  "I've seen rabbits make better strategic decisions.",
  "At this rate, the targets are going to charge you money.",
  "I'm on the coats of arms of 15 nations. Not for this.",
  "Want me to show you how it's done? I don't have hands either.",
  "Even Icarus lasted longer. And he had wax wings.",
  "An eagle never loses face. You lose it every single game.",
  "Your score will go down in history. Not for the right reasons.",
  "They say you become a player by playing. Apparently not you.",
  "The orange targets saw you coming from a mile away. A long mile.",
  "It's official: the eagle is ashamed. The eagle is never ashamed.",
  "I thought it was a bug. No, it's just you.",
  "Even the pigeons are giving you side-eye. The pigeons.",
  "You're on the level of someone who's never played. Except you have played.",
  "The eagle squints. Not in admiration. In bewilderment.",
  "If mediocrity were a sport, you'd be an Olympic champion.",
];

const RECORD_QUIPS = [
  "New record... your old score was so low it was easy.",
  "Congratulations. The bar was so low an earthworm could've cleared it.",
  "Record broken! Feel bad for the old record.",
  "You outdid yourself. Doesn't mean much, but still.",
  "New record! The eagle applauds... with his wings. It's loud.",
  "For once, you're not a total disgrace. Almost.",
  "Personal best! How do you celebrate? With seeds?",
  "Well played. I said 'well'. Not 'very well'. There's a difference.",
  "The eagle acknowledges your efforts. Grudgingly.",
  "You beat your record. The eagle will note that in his feathers.",
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
        {name}{me && <span className="pg-go-rank-you"> · you</span>}
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
        <div className="pg-go-rank-hint">Reading the hunters&apos; registry...</div>
      </div>
    );
  }

  // Classement vide : on n'affiche rien — la bulle de BD de l'aigle suffit.
  if (entries.length === 0) return null;

  const myIdx = currentUserId ? entries.findIndex((e) => e.userId === currentUserId) : -1;

  // Podium (top 3) toujours visible ; on ajoute la ligne du joueur s'il est plus bas.
  const podium = entries.slice(0, 3);
  const showMyRow = myIdx >= 3;
  const showOutside = isLoggedIn && myIdx === -1;

  return (
    <div className="pg-go-rank">
      <div className="pg-go-rank-label">HUNTERS&apos; SKY</div>
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
              you<span className="pg-go-rank-you"> · outside top 10</span>
            </span>
            <span className="pg-go-rank-score">{playerScore.toLocaleString()}</span>
          </div>
        </>
      )}

      {!isLoggedIn && (
        <div className="pg-go-rank-hint">Log in to stake your nest on the leaderboard.</div>
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
            background: PG.bgDeep,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />

        {/* ── MENU PAUSE ───────────────────────────────────────────────────── */}
        {paused && !isGameOver && (
          <div className="pg-diag-overlay absolute inset-0">
           <div className="pg-diag-card">

            {/* Mascotte */}
            <div style={{ marginBottom: 8 }}>
              <PauseMascot size={60} />
            </div>

            {/* Boutons secondaires au gabarit standard ; REPRENDRE en peg orange
                « play », surdimensionné comme le bouton JOUER du menu principal. */}
            <div className="pg-diag-btns">
              <PegBtn onClick={onResume} variant="play" fullWidth>
                RESUME
              </PegBtn>
              <PegBtn onClick={onReplay} variant="primary" fullWidth>
                RESTART
              </PegBtn>
              <div className="pg-diag-sep" />
              <PegBtn onClick={() => setShowOptions(true)} variant="primary" fullWidth>
                OPTIONS
              </PegBtn>
              <PegBtn onClick={onMenu} variant="primary" fullWidth>
                MAIN MENU
              </PegBtn>
            </div>

            {/* Section dev */}
            {isAdmin && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ fontSize: 6, color: PG.purple, letterSpacing: "0.12em", fontFamily: "var(--pg-font)", marginBottom: 2 }}>
                  — DEV —
                </div>
                {showDevTools && (
                  <PegBtn
                    onClick={() => { onResume(); onSkipLevel?.(); }}
                    variant="neutral"
                    style={{ color: PG.purpleHi, textShadow: `0 0 8px ${PG.purple}, 0 2px 3px rgba(0,0,0,0.95)` }}
                  >
                    NEXT LEVEL
                  </PegBtn>
                )}
                <PegBtn
                  onClick={() => { onResume(); onOpenDevPanel?.(); }}
                  variant="neutral"
                  style={{ color: PG.purpleHi, textShadow: `0 0 8px ${PG.purple}, 0 2px 3px rgba(0,0,0,0.95)` }}
                >
                  DEV TOOLS
                </PegBtn>
              </div>
            )}

            {/* Astuce — tout en bas, après les boutons */}
            <div className="pg-diag-tip" style={{ marginTop: 28, marginBottom: 0 }}>
              <span className="pg-diag-tip-label">TIP</span>
              <span className="pg-diag-tip-text">{pauseTip}</span>
            </div>
           </div>

            {/* Menu Options partagé avec le menu principal (Musique, Scanlines,
                Pixel). En partie, le seed est affiché en lecture seule — on ne
                change pas de seed au milieu d'un run. */}
            {showOptions && (
              <Options
                musicMuted={musicMuted}
                onToggleMusic={onToggleMusic}
                currentSeed={currentSeed}
                onClose={() => setShowOptions(false)}
              />
            )}
          </div>
        )}

        {/* ── GAME OVER (défaite) ──────────────────────────────────────────── */}
        {isLost && !upgradeOfferPending && (
          <div className="pg-diag-overlay absolute inset-0 pg-diag-overlay-lost">
           <div className="pg-diag-card">

            {/* Bulle de BD de l'aigle — au-dessus de la tête (queue vers le bas) */}
            <div className="pg-eagle-bubble pg-eagle-bubble-below" style={{ marginBottom: 10, maxWidth: "min(260px, 82%)" }}>
              {quip}
            </div>

            {/* Tête d'aigle dégoûtée */}
            <div className="pg-gameover-face" style={{ marginBottom: 4 }}>
              <GameOverMascot size={100} />
            </div>

            {/* Titre */}
            <div className="pg-diag-title pg-diag-title-lost">GAME OVER</div>

            {/* Score */}
            <div className="pg-diag-score">
              <div className="pg-diag-score-label">FINAL SCORE</div>
              <div className="pg-diag-score-val">{ui.score.toLocaleString()}</div>
            </div>

            {isRecord && (
              <div className="pg-diag-record">NEW RECORD!</div>
            )}

            {/* Mini-classement — la place du joueur, montrée sur place */}
            <GameOverRanking
              entries={leaderboard}
              loading={lbLoading}
              currentUserId={user?.id}
              playerScore={ui.score}
              isLoggedIn={!!user}
            />

            <div className="pg-diag-sep" />

            {/* Actions — même layout que la pause : boutons empilés, même largeur,
                action principale (REJOUER) en peg orange « play » comme JOUER du menu. */}
            <div className="pg-diag-btns">
              <PegBtn onClick={onReplay} variant="play" fullWidth>
                PLAY AGAIN
              </PegBtn>
              <PegBtn onClick={onLeaderboard} variant="primary" fullWidth>
                LEADERBOARD
              </PegBtn>
              <PegBtn onClick={onMenu} variant="primary" fullWidth>
                MAIN MENU
              </PegBtn>
            </div>

            {/* Astuce — tout en bas, après les boutons */}
            <div className="pg-diag-tip pg-diag-tip-go" style={{ marginTop: 28, marginBottom: 0 }}>
              <span className="pg-diag-tip-label">TIP</span>
              <span className="pg-diag-tip-text">{gameOverTip}</span>
            </div>
           </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Mémoïsé : le parent (PeagleApp) re-render à chaque sync UI, mais GameCanvas
// ne doit re-render que si ses props changent réellement.
export const GameCanvas = memo(GameCanvasComponent);
