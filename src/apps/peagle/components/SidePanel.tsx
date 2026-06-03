"use client";

import { memo } from "react";
import "../peagle.css";

// ─── Petit oiseau pixel-art SVG ───────────────────────────────────────────────

function PixelBird({ size = 20, color = "#88cc44", flipped = false }: { size?: number; color?: string; flipped?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ imageRendering: "pixelated", transform: flipped ? "scaleX(-1)" : undefined }}>
      <rect x="5" y="6" width="6" height="4" fill={color} />
      <rect x="9" y="4" width="4" height="4" fill={color} />
      <rect x="13" y="6" width="2" height="1" fill="#ffdd44" />
      <rect x="11" y="5" width="1" height="1" fill="#000" />
      <rect x="3" y="5" width="4" height="2" fill={color} style={{ transformOrigin: "7px 6px", animation: "pg-eagle-flap 0.6s ease-in-out infinite" }} />
      <rect x="3" y="8" width="3" height="2" fill={color} />
      <rect x="2" y="9" width="2" height="1" fill={color} />
      <rect x="6" y="10" width="1" height="2" fill="#aa8822" />
      <rect x="8" y="10" width="1" height="2" fill="#aa8822" />
    </svg>
  );
}

// ─── Arbre pixel-art CSS ──────────────────────────────────────────────────────

function PixelTree({
  x, baseH, trunkW, crownW, crownH, leafColor, trunkColor, sway = "left", delay = 0,
}: {
  x: number; baseH: number; trunkW: number; crownW: number; crownH: number;
  leafColor: string; trunkColor: string; sway?: "left" | "right"; delay?: number;
}) {
  return (
    <div style={{
      position: "absolute",
      bottom: 0,
      left: x,
      width: crownW,
      transformOrigin: "50% 100%",
      animation: `${sway === "left" ? "pg-tree-sway-left" : "pg-tree-sway-right"} ${6 + delay}s ease-in-out infinite`,
      animationDelay: `${delay * 0.4}s`,
    }}>
      {/* Couronnes */}
      <div style={{ position: "relative", height: crownH }}>
        <div style={{ position: "absolute", bottom: crownH * 0.55, left: "50%", transform: "translateX(-50%)", width: crownW * 0.45, height: crownH * 0.5, background: leafColor, clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
        <div style={{ position: "absolute", bottom: crownH * 0.28, left: "50%", transform: "translateX(-50%)", width: crownW * 0.72, height: crownH * 0.5, background: leafColor, clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: crownW, height: crownH * 0.5, background: leafColor, clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
        <div style={{ position: "absolute", bottom: crownH * 0.32, left: "50%", transform: "translateX(-40%)", width: 3, height: 3, background: "rgba(180,255,100,0.3)" }} />
      </div>
      {/* Tronc */}
      <div style={{ margin: "0 auto", width: trunkW, height: baseH, background: trunkColor, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: "100%", background: "rgba(255,200,100,0.1)" }} />
      </div>
    </div>
  );
}

// ─── Configurations des arbres — calibrées pour panneau 160px ─────────────────

const TREES_LEFT = [
  { x: -5, baseH: 18, trunkW: 5, crownW: 28, crownH: 40, leafColor: "#1a6018", trunkColor: "#2a1808", sway: "left" as const, delay: 0 },
  { x: 22, baseH: 13, trunkW: 4, crownW: 22, crownH: 32, leafColor: "#228020", trunkColor: "#2a1808", sway: "right" as const, delay: 1.2 },
  { x: 50, baseH: 16, trunkW: 5, crownW: 26, crownH: 38, leafColor: "#167018", trunkColor: "#2a1808", sway: "left" as const, delay: 2.1 },
  { x: 115, baseH: 10, trunkW: 4, crownW: 20, crownH: 28, leafColor: "#1e7018", trunkColor: "#1a1006", sway: "right" as const, delay: 0.6 },
  { x: 80, baseH: 8, trunkW: 3, crownW: 18, crownH: 24, leafColor: "#246020", trunkColor: "#1a1006", sway: "left" as const, delay: 1.8 },
];

const TREES_RIGHT = [
  { x: 5, baseH: 11, trunkW: 4, crownW: 20, crownH: 30, leafColor: "#1e7218", trunkColor: "#1a1006", sway: "left" as const, delay: 0.9 },
  { x: 30, baseH: 18, trunkW: 6, crownW: 30, crownH: 44, leafColor: "#166016", trunkColor: "#2a1808", sway: "right" as const, delay: 0 },
  { x: 65, baseH: 14, trunkW: 5, crownW: 24, crownH: 35, leafColor: "#207020", trunkColor: "#2a1808", sway: "left" as const, delay: 1.5 },
  { x: 100, baseH: 9, trunkW: 3, crownW: 18, crownH: 26, leafColor: "#1c6818", trunkColor: "#1a1006", sway: "right" as const, delay: 2.4 },
  { x: 130, baseH: 14, trunkW: 5, crownW: 26, crownH: 36, leafColor: "#186018", trunkColor: "#2a1808", sway: "left" as const, delay: 0.4 },
];

const FIREFLIES_LEFT = [
  { x: "20%", y: "28%", delay: 0, dx: 14, dy: -10 },
  { x: "60%", y: "42%", delay: 1.4, dx: -10, dy: -14 },
  { x: "35%", y: "58%", delay: 2.6, dx: 8, dy: -8 },
  { x: "75%", y: "20%", delay: 0.8, dx: -12, dy: -6 },
  { x: "50%", y: "68%", delay: 1.9, dx: 10, dy: -12 },
  { x: "15%", y: "50%", delay: 3.1, dx: 16, dy: -8 },
];

const FIREFLIES_RIGHT = [
  { x: "25%", y: "33%", delay: 0.5, dx: -12, dy: -10 },
  { x: "65%", y: "48%", delay: 1.7, dx: 10, dy: -12 },
  { x: "40%", y: "62%", delay: 2.3, dx: -8, dy: -8 },
  { x: "80%", y: "25%", delay: 1.0, dx: 12, dy: -14 },
  { x: "10%", y: "72%", delay: 3.2, dx: 14, dy: -6 },
  { x: "55%", y: "15%", delay: 0.2, dx: -10, dy: -10 },
];

// ─── Panel principal ──────────────────────────────────────────────────────────

interface SidePanelProps {
  side: "left" | "right";
  clutchMode?: boolean;
}

function SidePanelComponent({ side, clutchMode = false }: SidePanelProps) {
  const trees = side === "left" ? TREES_LEFT : TREES_RIGHT;
  const fireflies = side === "left" ? FIREFLIES_LEFT : FIREFLIES_RIGHT;

  const skyTop = clutchMode ? "#08061e" : "#122010";
  const skyBot = clutchMode ? "#120840" : "#1c3412";
  const leafTint = clutchMode ? "#060818" : undefined;
  const fireflyColor = clutchMode ? "#cc66ff" : "#aaff44";
  const fireflyGlow = clutchMode ? "rgba(180,80,255,0.5)" : "rgba(100,255,30,0.5)";

  return (
    <div
      className="pg-side-panel peagle-root"
      style={{
        borderRight: side === "left" ? "1px solid #0c1a08" : undefined,
        borderLeft: side === "right" ? "1px solid #0c1a08" : undefined,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Fond ciel — gradient visible */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(to bottom, ${skyTop} 0%, ${skyBot} 25%, #112208 55%, #0a1a06 80%, #060e04 100%)`,
      }} />

      {/* Rayons de lumière filtrés canopée */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "repeating-linear-gradient(175deg, transparent 0%, transparent 8%, rgba(60,120,20,0.03) 8.5%, transparent 9%)",
        pointerEvents: "none",
      }} />

      {/* Scanlines légères */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "repeating-linear-gradient(to bottom, transparent 0px, transparent 1px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 2px)",
        pointerEvents: "none",
        zIndex: 2,
      }} />

      {/* ── Lucioles ── */}
      {fireflies.map((ff, i) => (
        <div
          key={i}
          className="pg-side-firefly-el"
          style={{
            position: "absolute",
            left: ff.x,
            top: ff.y,
            background: fireflyColor,
            boxShadow: `0 0 4px 2px ${fireflyGlow}`,
            "--sfd": `${2.5 + ff.delay * 0.7}s`,
            "--sfdel": `${ff.delay * 0.6}s`,
            "--sfx": `${ff.dx}px`,
            "--sfy": `${ff.dy}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* ── Corps principal (z-index au-dessus du fond) ── */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        zIndex: 1,
        alignItems: "center",
      }}>
        {/* Soleil ou lune en haut */}
        <div style={{ paddingTop: 18, paddingBottom: 8, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          {clutchMode ? (
            /* Lune */
            <div style={{
              width: 18, height: 18, position: "relative",
              background: "rgba(210,190,255,0.88)",
              boxShadow: "0 0 8px 3px rgba(180,150,255,0.45)",
              animation: "pg-moon-pulse 2s ease-in-out infinite",
            }}>
              <div style={{ position: "absolute", top: 4, left: 2, width: 4, height: 3, background: "rgba(150,120,200,0.5)" }} />
              <div style={{ position: "absolute", top: 9, left: 9, width: 3, height: 2, background: "rgba(150,120,200,0.4)" }} />
            </div>
          ) : (
            /* Soleil */
            <div style={{
              width: 16, height: 16, position: "relative",
              background: "rgba(255,225,90,0.88)",
              boxShadow: "0 0 8px 3px rgba(255,200,50,0.45)",
              animation: "pg-badge98-pulse 3s ease-in-out infinite",
            }}>
              <div style={{ position: "absolute", top: -5, left: 6, width: 2, height: 5, background: "rgba(255,215,60,0.65)" }} />
              <div style={{ position: "absolute", bottom: -5, left: 6, width: 2, height: 5, background: "rgba(255,215,60,0.65)" }} />
              <div style={{ position: "absolute", left: -5, top: 6, width: 5, height: 2, background: "rgba(255,215,60,0.65)" }} />
              <div style={{ position: "absolute", right: -5, top: 6, width: 5, height: 2, background: "rgba(255,215,60,0.65)" }} />
            </div>
          )}
        </div>

        {/* Zone centrale — décor (les stats vivent désormais dans le canvas) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", padding: "0 4px", overflow: "hidden" }}>
          <div style={{ padding: "8px 0", opacity: 0.7 }}>
            <PixelBird size={20} color="#38a832" flipped={side === "right"} />
          </div>
        </div>

        {/* Oiseau qui traverse (décoration, haut du panneau) */}
        <div style={{ position: "absolute", top: "18%", left: 0, right: 0, height: 16, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{
            position: "absolute",
            animation: `pg-bird-cross ${13 + (side === "right" ? 4 : 0)}s linear infinite`,
            animationDelay: side === "right" ? "-6s" : "-2s",
          }}>
            <PixelBird size={10} color="#1e6018" flipped={side === "right"} />
          </div>
        </div>

        {/* Spacer pour laisser de la place aux arbres en bas */}
        <div style={{ height: 110, flexShrink: 0 }} />
      </div>

      {/* ── Arbres en bas — position absolute depuis le bas du panneau ── */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, pointerEvents: "none" }}>
        {/* Sol */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 18,
          background: clutchMode ? "#080820" : "#2e7820",
        }} />
        {/* Herbe pixel */}
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", bottom: 16, left: i * 11 + (side === "right" ? 2 : 0), width: 2, height: 2 + (i % 3),
            background: clutchMode ? "#1a1a4a" : "#44cc30",
          }} />
        ))}
        {/* Brume sol */}
        <div style={{
          position: "absolute", bottom: 12, left: -5, right: -5, height: 18,
          background: clutchMode
            ? "radial-gradient(ellipse 90% 100% at 50% 100%, rgba(60,40,140,0.3) 0%, transparent 70%)"
            : "radial-gradient(ellipse 90% 100% at 50% 100%, rgba(30,80,15,0.35) 0%, transparent 70%)",
          filter: "blur(5px)",
          animation: "pg-fog-roll 8s ease-in-out infinite",
        }} />
        {/* Arbres */}
        {trees.map((t, i) => (
          <PixelTree key={i} {...t} leafColor={leafTint ?? t.leafColor} />
        ))}
      </div>
    </div>
  );
}

// Décor statique : ne dépend que de `side`/`clutchMode`. Mémoïsé pour ne pas
// re-render à chaque sync UI du parent (les deux panneaux sont lourds en DOM).
export const SidePanel = memo(SidePanelComponent);
