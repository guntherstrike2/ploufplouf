"use client";

// ─── Peagle — main menu ──────────────────────────────────────────────────────

import { panel, raisedBtn } from "../styles";

export function MainMenu({ best, onPlay }: { best: number; onPlay: () => void }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        fontFamily: "var(--t-font-display)",
        color: "var(--t-text)",
        background: "linear-gradient(180deg, var(--t-titlebar-from), var(--t-titlebar-to))",
      }}
    >
      <div style={{ fontSize: "var(--t-text-3xl)", fontWeight: "bold", letterSpacing: 2 }}>
        🥚 Peagle
      </div>
      <div style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
        Lancez l&apos;œuf. Cassez les pegs orange. Devenez l&apos;aigle.
      </div>
      <button style={{ ...raisedBtn, fontSize: "var(--t-text-md)" }} onClick={onPlay}>
        ▶ Jouer
      </button>
      <div style={{ ...panel, padding: "4px 12px", fontSize: "var(--t-text-sm)" }}>
        Meilleur score : <b>{best}</b>
      </div>
    </div>
  );
}
