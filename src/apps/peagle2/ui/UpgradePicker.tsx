"use client";

// ─── Peagle — between-levels upgrade choice (rogue-lite extension point #2) ────
// Presented after a level win. Picking an upgrade is the ONLY way the rogue-lite
// changes the next level — it appends to RunState.upgrades, then the next game
// is created from the re-resolved config.

import { UPGRADES, type UpgradeId } from "../rogue/upgrades";
import { panel, raisedBtn } from "../styles";

const RARITY_COLOR: Record<string, string> = {
  common: "var(--t-text-muted)",
  rare: "#3a7bd5",
  epic: "#a44bd5",
};

export function UpgradePicker({
  offer,
  onPick,
}: {
  offer: UpgradeId[];
  onPick: (id: UpgradeId) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "rgba(0,0,0,0.55)",
        fontFamily: "var(--t-font-display)",
        color: "var(--t-text)",
      }}
    >
      <div style={{ fontSize: "var(--t-text-xl)", fontWeight: "bold", color: "#fff" }}>
        Niveau terminé ! Choisis une amélioration
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {offer.map((id, i) => {
          const u = UPGRADES[id];
          return (
            <button
              key={`${id}-${i}`}
              onClick={() => onPick(id)}
              style={{
                ...panel,
                width: 150,
                padding: 12,
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: "var(--t-text-md)", fontWeight: "bold" }}>{u.name}</div>
              <div
                style={{
                  fontSize: "var(--t-text-xs)",
                  textTransform: "uppercase",
                  color: RARITY_COLOR[u.rarity],
                }}
              >
                {u.rarity}
              </div>
              <div style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
                {u.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GameOverOverlay({
  score,
  best,
  onRetry,
  onMenu,
}: {
  score: number;
  best: number;
  onRetry: () => void;
  onMenu: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "rgba(0,0,0,0.6)",
        fontFamily: "var(--t-font-display)",
        color: "#fff",
      }}
    >
      <div style={{ fontSize: "var(--t-text-2xl)", fontWeight: "bold" }}>L&apos;œuf est tombé…</div>
      <div style={{ fontSize: "var(--t-text-md)" }}>Score : {score}</div>
      <div style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>Record : {best}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button style={raisedBtn} onClick={onRetry}>
          ↻ Rejouer
        </button>
        <button style={raisedBtn} onClick={onMenu}>
          ☰ Menu
        </button>
      </div>
    </div>
  );
}
