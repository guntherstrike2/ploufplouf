"use client";

import "../peagle.css";
import type { UpgradeId } from "../engine/roguelite";
import { UPGRADES } from "../engine/roguelite";
import { captionBtn, PG } from "../styles";

interface UpgradePickerProps {
  offers: UpgradeId[];
  level: number;
  score: number;
  onPick: (id: UpgradeId) => void;
  onSkip: () => void;
}

export function UpgradePicker({ offers, level, score, onPick, onSkip }: UpgradePickerProps) {
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
        zIndex: 10,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 300,
          background: `radial-gradient(ellipse, ${PG.cyan}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div
        className="pg-dialog"
        style={{
          width: 480,
          maxWidth: "calc(100vw - 32px)",
          animation: "pg-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div className="pg-titlebar">
          <span style={{ fontSize: 8, color: "#aaaaee", flex: 1, fontFamily: "var(--pg-font)", letterSpacing: "0.05em" }}>
            🏆 NIVEAU {level} TERMINÉ — CHOISIS UN BONUS
          </span>
          {(["─", "□", "×"] as const).map((ch) => (
            <div key={ch} style={captionBtn}>{ch}</div>
          ))}
        </div>

        <div style={{ padding: "16px 14px 14px" }}>
          <div
            className="pg-sunken"
            style={{ padding: "5px 10px", fontSize: 8, color: PG.textMuted, fontFamily: "var(--pg-font)", marginBottom: 14 }}
          >
            SCORE : <strong style={{ color: PG.cyan }}>{score.toLocaleString()}</strong>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {offers.map((id, i) => {
              const u = UPGRADES[id];
              if (!u) return null;
              return (
                <button
                  key={id}
                  onClick={() => onPick(id)}
                  style={{
                    flex: 1,
                    padding: "12px 10px",
                    fontFamily: "var(--pg-font)",
                    fontSize: 7,
                    cursor: "pointer",
                    background: PG.surface2,
                    color: PG.text,
                    borderWidth: 2,
                    borderStyle: "solid",
                    borderColor: PG.hi,
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    animation: `pg-card-in 0.3s ease-out ${i * 0.08}s both`,
                    transition: "box-shadow 0.15s, filter 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = `0 0 20px ${PG.cyan}33`;
                    e.currentTarget.style.filter = "brightness(1.15)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = "";
                    e.currentTarget.style.filter = "";
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: "bold",
                      color: PG.cyan,
                      lineHeight: 1.3,
                      textShadow: `0 0 8px ${PG.cyan}66`,
                    }}
                  >
                    {u.name.toUpperCase()}
                  </div>
                  <div
                    style={{
                      fontSize: 7,
                      color: "#aaaacc",
                      lineHeight: 1.6,
                      padding: "5px 8px",
                      background: "rgba(0,0,0,0.5)",
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderTopColor: PG.sh,
                      borderLeftColor: PG.sh,
                      borderBottomColor: PG.hi,
                      borderRightColor: PG.hi,
                    }}
                  >
                    {u.desc}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pg-sep" style={{ marginBottom: 10 }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 7, color: PG.textMuted, fontFamily: "var(--pg-font)" }}>
              CHOISIS UNE AMÉLIORATION
            </div>
            <button
              onClick={onSkip}
              style={{
                padding: "5px 12px",
                fontFamily: "var(--pg-font)",
                fontSize: 7,
                cursor: "pointer",
                background: PG.surface2,
                color: PG.textMuted,
                borderWidth: 2,
                borderStyle: "solid",
                borderTopColor: PG.hi,
                borderLeftColor: PG.hi,
                borderBottomColor: PG.sh,
                borderRightColor: PG.sh,
                letterSpacing: "0.04em",
                transition: "color 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = PG.orange}
              onMouseLeave={e => e.currentTarget.style.color = PG.textMuted}
            >
              PASSER →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
