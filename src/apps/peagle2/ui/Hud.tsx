"use client";

// ─── Peagle — in-game HUD (reads a snapshot, no game logic) ──────────────────

import type { HudSnapshot } from "./useGameLoop";
import { sunken } from "../styles";

export function Hud({ snap }: { snap: HudSnapshot }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "6px 8px",
        fontFamily: "var(--t-font-display)",
        fontSize: "var(--t-text-sm)",
        color: "var(--t-text)",
      }}
    >
      <Stat label="Niveau" value={snap.level} />
      <Stat label="Score" value={snap.score} grow />
      <Stat label="Œufs" value={snap.ballsLeft} />
      <Stat label="Orange" value={snap.orangeLeft} />
      {snap.combo >= 2 && <Stat label="Combo" value={`x${snap.combo}`} accent />}
    </div>
  );
}

function Stat({
  label,
  value,
  grow,
  accent,
}: {
  label: string;
  value: number | string;
  grow?: boolean;
  accent?: boolean;
}) {
  return (
    <div style={{ ...sunken, padding: "2px 8px", flex: grow ? 1 : undefined }}>
      <span style={{ color: "var(--t-text-muted)" }}>{label} </span>
      <span style={{ color: accent ? "var(--t-accent)" : "var(--t-text)", fontWeight: "bold" }}>
        {value}
      </span>
    </div>
  );
}
