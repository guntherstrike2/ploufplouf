"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSoundContext } from "@/lib/contexts/sound-context";
import { loadBuffer } from "@/lib/audio/engine";
import { PG } from "../styles";
import { eagleFace } from "../renderer/face";
import { randomTip } from "../engine/tips";
import "../peagle.css";

const TRACKS = ["/sounds/peagle-theme.mp3", "/sounds/peagle-track1.mp3"];

// Tête d'aigle façon Doom — logo animé de l'écran de chargement
const FACE_SCALE = 6;
const FACE_CX = 14;   // centre horizontal dans l'espace pré-scale (≈ moitié des 28px)
const FACE_CY = 18;   // centre vertical (un peu plus bas pour inclure les épaules)
const FACE_CW = 28;   // largeur canvas pré-scale
const FACE_CH = 36;   // hauteur canvas pré-scale (épaules incluses)

function EagleLogoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startT = performance.now();
    let raf = 0;

    function draw() {
      const elapsed = (performance.now() - startT) / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = FACE_CW * FACE_SCALE;
      const h = FACE_CH * FACE_SCALE;

      if (canvas!.width !== Math.round(w * dpr)) {
        canvas!.width = Math.round(w * dpr);
        canvas!.height = Math.round(h * dpr);
      }
      ctx!.setTransform(dpr * FACE_SCALE, 0, 0, dpr * FACE_SCALE, 0, 0);
      ctx!.clearRect(0, 0, FACE_CW, FACE_CH);
      ctx!.imageSmoothingEnabled = false;

      eagleFace(ctx!, FACE_CX, FACE_CY, {
        blink: (elapsed % 3.8) < 0.12 ? "both" : "none",
        open: 0,
        brow: "flat",
        eyeRed: false,
        wide: false,
        look: Math.sin(elapsed * 0.7) * 1.2,
        pop: 0,
        starEyes: false,
        tears: false,
        drowsyEyes: false,
      });

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: FACE_CW * FACE_SCALE,
        height: FACE_CH * FACE_SCALE,
        imageRendering: "pixelated",
        filter: `drop-shadow(0 0 12px ${PG.gold}88) drop-shadow(0 0 28px ${PG.gold}33)`,
      }}
    />
  );
}

interface LoadingScreenProps {
  onReady: () => void;
}

export function LoadingScreen({ onReady }: LoadingScreenProps) {
  const { init } = useSoundContext();
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Prefetch sur montage — fetch + decodeAudioData ne nécessitent pas de gesture.
  // Les buffers atterrissent dans le cache avant même que l'utilisateur clique.
  useEffect(() => {
    let count = 0;
    for (const track of TRACKS) {
      loadBuffer(track)
        .catch(() => {})
        .finally(() => {
          count++;
          setProgress(count / TRACKS.length);
          if (count === TRACKS.length) setLoaded(true);
        });
    }
  }, []);

  // Le clic ne sert qu'à satisfaire la politique autoplay du navigateur (gesture).
  const handleStart = useCallback(() => {
    if (!loaded) return;
    init();
    onReady();
  }, [loaded, init, onReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") handleStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleStart]);

  const pct = Math.round(progress * 100);
  const tip = useMemo(() => randomTip(), []);

  return (
    <div
      className="peagle-root"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to bottom, #122010 0%, #0a1806 55%, #060e04 100%)",
        cursor: loaded ? "pointer" : "default",
        userSelect: "none",
        gap: 24,
        position: "relative",
      }}
      onClick={handleStart}
    >
      {/* Logo — tête d'aigle façon Doom */}
      <EagleLogoCanvas />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {/* Barre de progression — se remplit automatiquement pendant le chargement */}
        <div
          style={{
            width: 160,
            height: 10,
            background: PG.bg,
            border: `1px solid ${PG.border}`,
            boxShadow: `inset 1px 1px 0 ${PG.bevelLo}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: `linear-gradient(to bottom, ${PG.greenHi} 0 45%, ${PG.green} 45% 72%, ${PG.greenDeep} 72% 100%)`,
              transition: "width 0.25s ease-out",
            }}
          />
        </div>

        {/* Label : compteur pendant le chargement, invitation après */}
        <div
          style={{
            fontFamily: "var(--pg-font)",
            fontSize: 7,
            letterSpacing: "0.12em",
            color: loaded ? PG.gold : PG.leaf,
            animation: loaded ? "pg-blink 1.1s step-end infinite" : undefined,
          }}
        >
          {loaded ? "▶ PRESS ANY KEY" : `LOADING... ${pct}%`}
        </div>
      </div>

      {/* Astuce aléatoire — visible dès le début du chargement */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "0 16px",
          pointerEvents: "none",
          animation: "pg-slide-up 0.4s ease-out 0.3s both",
        }}
      >
        <span
          style={{
            fontFamily: "var(--pg-font)",
            fontSize: 6,
            letterSpacing: "0.14em",
            color: PG.gold,
            textShadow: `0 0 8px ${PG.gold}66`,
            marginBottom: 2,
          }}
        >
          ★ ASTUCE
        </span>
        <span
          style={{
            fontFamily: "var(--pg-font-ui)",
            fontSize: 14,
            color: PG.text,
            textAlign: "center",
            lineHeight: 1.4,
            maxWidth: 260,
            textShadow: "0 2px 4px rgba(0,0,0,0.95)",
          }}
        >
          {tip}
        </span>
      </div>
    </div>
  );
}
