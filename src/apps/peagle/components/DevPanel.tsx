"use client";

import { useState } from "react";
import "../peagle.css";
import { useOpenApp } from "@/lib/hooks/use-open-app";
import { captionBtn, PG } from "../styles";
import type { UpgradeId } from "../engine/roguelite";
import { UPGRADES } from "../engine/roguelite";

// ─── Config dev ────────────────────────────────────────────────────────────────
// Réservé aux admins. Permet de tester rapidement le jeu sans subir la difficulté.

export interface DevConfig {
  godMode: boolean;            // œufs infinis
  startLevel: number;          // démarrer à ce niveau
  orangePct: number | null;    // override du % de cibles oranges (null = défaut)
  showHitboxes: boolean;       // afficher les hitboxes
  upgrades: UpgradeId[];       // upgrades possédées au lancement
}

export const DEFAULT_DEV_CONFIG: DevConfig = {
  godMode: false,
  startLevel: 1,
  orangePct: null,
  showHitboxes: false,
  upgrades: [],
};

export type DevTriggerScreen = "day" | "night" | "win" | "lose" | "new-record";

interface DevPanelProps {
  initial?: DevConfig;
  onClose: () => void;
  onLaunch: (cfg: DevConfig) => void;
  onTriggerScreen?: (screen: DevTriggerScreen) => void;
}

const ALL_UPGRADES = Object.keys(UPGRADES) as UpgradeId[];

export function DevPanel({ initial, onClose, onLaunch, onTriggerScreen }: DevPanelProps) {
  const [cfg, setCfg] = useState<DevConfig>(initial ?? DEFAULT_DEV_CONFIG);
  const { openApp } = useOpenApp();

  const set = <K extends keyof DevConfig>(k: K, v: DevConfig[K]) => setCfg(c => ({ ...c, [k]: v }));

  const toggleUpgrade = (id: UpgradeId) =>
    setCfg(c => ({
      ...c,
      upgrades: c.upgrades.includes(id) ? c.upgrades.filter(u => u !== id) : [...c.upgrades, id],
    }));

  const label: React.CSSProperties = { fontSize: 8, color: PG.textMuted, fontFamily: "var(--pg-font)", letterSpacing: "0.04em" };
  const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 };

  return (
    <div
      className="peagle-root"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.82)",
        zIndex: 50,
      }}
    >
      <div className="pg-dialog" style={{ width: 360, maxWidth: "calc(100vw - 32px)" }}>
        <div className="pg-titlebar">
          <span style={{ fontSize: 8, color: "#cc88ff", flex: 1, fontFamily: "var(--pg-font)", letterSpacing: "0.05em" }}>
            ⚙ DEV TOOLS
          </span>
          <div style={captionBtn} onClick={onClose}>×</div>
        </div>

        <div style={{ padding: "16px 16px 14px" }}>
          {/* God mode */}
          <div style={row}>
            <span style={label}>ŒUFS INFINIS</span>
            <button onClick={() => set("godMode", !cfg.godMode)} style={toggleBtn(cfg.godMode)}>
              {cfg.godMode ? "ON" : "OFF"}
            </button>
          </div>

          {/* Show hitboxes */}
          <div style={row}>
            <span style={label}>HITBOXES</span>
            <button onClick={() => set("showHitboxes", !cfg.showHitboxes)} style={toggleBtn(cfg.showHitboxes)}>
              {cfg.showHitboxes ? "ON" : "OFF"}
            </button>
          </div>

          {/* Start level */}
          <div style={row}>
            <span style={label}>NIVEAU DE DÉPART</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => set("startLevel", Math.max(1, cfg.startLevel - 1))} style={stepBtn}>−</button>
              <span style={{ fontSize: 10, color: PG.cyan, fontFamily: "var(--pg-font)", minWidth: 24, textAlign: "center" }}>{cfg.startLevel}</span>
              <button onClick={() => set("startLevel", cfg.startLevel + 1)} style={stepBtn}>+</button>
            </div>
          </div>

          {/* Orange % */}
          <div style={row}>
            <span style={label}>% ORANGES</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => set("orangePct", cfg.orangePct === null ? 50 : Math.max(5, cfg.orangePct - 5))} style={stepBtn}>−</button>
              <span style={{ fontSize: 9, color: PG.cyan, fontFamily: "var(--pg-font)", minWidth: 38, textAlign: "center" }}>
                {cfg.orangePct === null ? "AUTO" : `${cfg.orangePct}%`}
              </span>
              <button onClick={() => set("orangePct", cfg.orangePct === null ? 50 : Math.min(100, cfg.orangePct + 5))} style={stepBtn}>+</button>
              {cfg.orangePct !== null && (
                <button onClick={() => set("orangePct", null)} style={{ ...stepBtn, width: "auto", padding: "0 6px", fontSize: 6 }}>AUTO</button>
              )}
            </div>
          </div>

          {/* Upgrades de départ */}
          <div style={{ ...label, marginBottom: 6 }}>UPGRADES DE DÉPART</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
            {ALL_UPGRADES.map(id => {
              const on = cfg.upgrades.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleUpgrade(id)}
                  title={UPGRADES[id].desc}
                  style={{
                    fontSize: 7,
                    padding: "4px 7px",
                    fontFamily: "var(--pg-font)",
                    cursor: "pointer",
                    background: on ? PG.cyan + "22" : PG.surface2,
                    color: on ? PG.cyan : PG.textMuted,
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: on ? PG.cyan : PG.hi,
                  }}
                >
                  {UPGRADES[id].name}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => openApp("peagle-gallery")}
            style={{
              width: "100%",
              padding: "8px 0",
              marginBottom: 12,
              fontFamily: "var(--pg-font)",
              fontSize: 8,
              cursor: "pointer",
              background: PG.surface2,
              color: "#aaee66",
              borderWidth: 2,
              borderStyle: "solid",
              borderTopColor: PG.hi,
              borderLeftColor: PG.hi,
              borderBottomColor: PG.sh,
              borderRightColor: PG.sh,
              letterSpacing: "0.04em",
            }}
          >
            🎨 GALERIE D&apos;ASSETS
          </button>

          {onTriggerScreen && (
            <>
              <div className="pg-sep" style={{ marginBottom: 10 }} />
              <div style={{ ...label, marginBottom: 8 }}>DÉCLENCHER ÉCRAN</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                {(
                  [
                    { id: "day",   icon: "☀", text: "JOUR",     color: "#ffdd66" },
                    { id: "night", icon: "🌙", text: "NUIT",     color: "#88aaff" },
                    { id: "win",   icon: "★",  text: "VICTOIRE", color: "#44cc88" },
                    { id: "lose",  icon: "✕",  text: "DÉFAITE",  color: "#cc4444" },
                  ] as const
                ).map(({ id, icon, text, color }) => (
                  <button
                    key={id}
                    onClick={() => { onTriggerScreen(id); onClose(); }}
                    style={{
                      padding: "7px 0",
                      fontFamily: "var(--pg-font)",
                      fontSize: 8,
                      cursor: "pointer",
                      background: PG.surface2,
                      color,
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderTopColor: PG.hi,
                      borderLeftColor: PG.hi,
                      borderBottomColor: PG.sh,
                      borderRightColor: PG.sh,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {icon} {text}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { onTriggerScreen("new-record"); onClose(); }}
                style={{
                  width: "100%",
                  padding: "7px 0",
                  marginBottom: 8,
                  fontFamily: "var(--pg-font)",
                  fontSize: 8,
                  cursor: "pointer",
                  background: PG.surface2,
                  color: "#ff88ff",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderTopColor: PG.hi,
                  borderLeftColor: PG.hi,
                  borderBottomColor: PG.sh,
                  borderRightColor: PG.sh,
                  letterSpacing: "0.04em",
                }}
              >
                ★ NEW RECORD
              </button>
            </>
          )}

          <div className="pg-sep" style={{ marginBottom: 12 }} />

          <button
            onClick={() => onLaunch(cfg)}
            style={{
              width: "100%",
              padding: "10px 0",
              fontFamily: "var(--pg-font)",
              fontSize: 9,
              cursor: "pointer",
              background: `linear-gradient(to bottom, #8844cc, #552288)`,
              color: "#fff",
              borderWidth: 2,
              borderStyle: "solid",
              borderTopColor: "#aa66ee",
              borderLeftColor: "#aa66ee",
              borderBottomColor: "#330055",
              borderRightColor: "#330055",
              letterSpacing: "0.06em",
              textShadow: "0 1px 0 rgba(0,0,0,0.5)",
            }}
          >
            ▶ LANCER LA PARTIE DEV
          </button>
        </div>
      </div>
    </div>
  );
}

function toggleBtn(on: boolean): React.CSSProperties {
  return {
    fontSize: 8,
    padding: "4px 12px",
    fontFamily: "var(--pg-font)",
    cursor: "pointer",
    background: on ? "#226622" : PG.surface2,
    color: on ? "#88ff88" : PG.textMuted,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: on ? "#44aa44" : PG.hi,
  };
}

const stepBtn: React.CSSProperties = {
  width: 20,
  height: 18,
  fontSize: 10,
  fontFamily: "var(--pg-font)",
  cursor: "pointer",
  background: PG.surface2,
  color: PG.text,
  borderWidth: 1,
  borderStyle: "solid",
  borderTopColor: PG.hi,
  borderLeftColor: PG.hi,
  borderBottomColor: PG.sh,
  borderRightColor: PG.sh,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
