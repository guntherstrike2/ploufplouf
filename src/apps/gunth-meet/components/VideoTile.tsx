"use client";

import { useRef, useEffect } from "react";
import type { Reaction } from "../types";
import { useSpeaking } from "../hooks/use-speaking";

export function VideoTile({
  stream,
  label,
  muted = false,
  isScreenSharing = false,
  noVideo = false,
  isPinned = false,
  onPin,
  reactions = [],
  isMuted = false,
  isCamOff = false,
  isHost = false,
  canMute = false,
  onHostMute,
  volume,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  isScreenSharing?: boolean;
  noVideo?: boolean;
  isPinned?: boolean;
  onPin?: () => void;
  reactions?: Reaction[];
  isMuted?: boolean;
  isCamOff?: boolean;
  isHost?: boolean;
  canMute?: boolean;
  onHostMute?: () => void;
  volume?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useSpeaking(muted ? null : stream);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play().catch(() => {
      const resume = () => { el.play().catch(() => {}); };
      document.addEventListener("click", resume, { once: true });
    });
  }, [stream]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || muted) return;
    el.volume = volume ?? 1;
  }, [volume, muted]);

  const hasVideo =
    stream &&
    stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled) &&
    !noVideo;

  // Speaking border: green pulsed glow when active, accent when pinned, default otherwise
  const borderStyle = isSpeaking
    ? "2px solid var(--t-speaking)"
    : isPinned
      ? "2px solid var(--t-accent)"
      : "2px solid";
  const boxShadow = isSpeaking ? "0 0 0 2px var(--t-speaking), 0 0 8px 2px color-mix(in srgb, var(--t-speaking) 40%, transparent)" : undefined;

  return (
    <div
      style={{
        position: "relative",
        background: "var(--t-bg)",
        border: borderStyle,
        borderColor: isSpeaking || isPinned
          ? undefined
          : "var(--t-border-dark) var(--t-border-light) var(--t-border-light) var(--t-border-dark)",
        boxShadow,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 120,
        aspectRatio: "16/9",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: hasVideo ? "block" : "none" }}
      />

      {!hasVideo && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: isSpeaking ? "var(--t-speaking)" : "var(--t-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              color: "#fff",
              fontFamily: "var(--t-font-display)",
              transition: "background 0.15s",
            }}
          >
            {label.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
            {isScreenSharing ? "🖥 Partage en cours" : "Caméra off"}
          </span>
        </div>
      )}

      {/* Label bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(0,0,0,0.55)",
          padding: "2px 6px",
          fontSize: "var(--t-text-xs)",
          color: "#fff",
          fontFamily: "var(--t-font-display)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {isScreenSharing && "🖥 "}
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
          {isHost && " 👑"}
        </span>
        {isMuted && "🔇"}
        {!isMuted && isSpeaking && <span style={{ color: "#4caf50", fontSize: 10 }}>●</span>}
        {isCamOff && "📷"}
      </div>

      {/* Overlay actions (top-right) */}
      <div
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          display: "flex",
          gap: 4,
        }}
      >
        {onPin && (
          <button
            onClick={onPin}
            title={isPinned ? "Désépingler" : "Épingler"}
            style={{
              background: "rgba(0,0,0,0.5)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: "2px 4px",
              fontSize: 12,
              borderRadius: 2,
            }}
          >
            {isPinned ? "📌" : "📍"}
          </button>
        )}
        {canMute && onHostMute && (
          <button
            onClick={onHostMute}
            title="Couper le micro (hôte)"
            style={{
              background: "rgba(0,0,0,0.5)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: "2px 4px",
              fontSize: 12,
              borderRadius: 2,
            }}
          >
            🔇
          </button>
        )}
      </div>

      {/* Floating reactions */}
      {reactions.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 4,
            pointerEvents: "none",
          }}
        >
          {reactions.map((r) => (
            <span
              key={r.id}
              style={{
                fontSize: 24,
                animation: "floatUp 3s ease-out forwards",
              }}
            >
              {r.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
