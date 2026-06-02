"use client";

import "../peagle.css";
import type { UpgradeId } from "../engine/roguelite";
import { UPGRADES } from "../engine/roguelite";
import { PG } from "../styles";
import { PixelSprite } from "./PixelSprite";

// Couleur de bande par upgrade id — donne une identité visuelle à chaque bonus
const CARD_COLORS: Record<UpgradeId, { band: string; name: string; label: string }> = {
  extra_ball:  { band: PG.green,  name: PG.leaf,   label: "COMMUN"  },
  heavy_ball:  { band: "#4488ff", name: "#7ab0ff",  label: "RARE"    },
  bigger_ball: { band: "#4488ff", name: "#7ab0ff",  label: "RARE"    },
  sharp_aim:   { band: PG.purple, name: "#d088ff",  label: "ÉPIQUE"  },
};

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
      className="peagle-root pg-overlay-lux"
      style={{ position: "absolute", inset: 0, zIndex: 10 }}
    >
      <div className="pg-lux-panel" style={{ width: 500, maxWidth: "calc(100vw - 32px)" }}>

        {/* Header */}
        <div className="pg-lux-header">
          <PixelSprite name="trophy" scale={2} />
          <span className="pg-lux-title" style={{ fontSize: 8 }}>
            NIVEAU {level} TERMINÉ — CHOISIS UN BONUS
          </span>
          <div className="pg-lux-gem" />
        </div>

        {/* Body */}
        <div style={{ padding: "16px 14px 14px" }}>

          {/* Score */}
          <div
            className="pg-hero-score"
            style={{ marginBottom: 16, padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <span className="pg-hero-score-label" style={{ marginBottom: 0 }}>SCORE</span>
            <span className="pg-hero-score-val">{score.toLocaleString()}</span>
          </div>

          {/* Cards */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {offers.map((id, i) => {
              const u = UPGRADES[id];
              if (!u) return null;
              const col = CARD_COLORS[id] ?? { band: PG.leaf, name: PG.leaf, label: "BONUS" };
              return (
                <button
                  key={id}
                  onClick={() => onPick(id)}
                  className="pg-card-lux"
                  style={{ animationDelay: `${i * 0.09}s` }}
                >
                  {/* Bande couleur */}
                  <div className="pg-card-lux-band" style={{ background: col.band }} />

                  <div className="pg-card-lux-inner">
                    {/* Rareté */}
                    <div
                      style={{
                        fontFamily: "var(--pg-font)",
                        fontSize: 6,
                        color: col.band,
                        letterSpacing: "0.14em",
                        marginBottom: 4,
                        opacity: 0.85,
                      }}
                    >
                      {col.label}
                    </div>

                    {/* Nom */}
                    <div className="pg-card-lux-name" style={{ color: col.name }}>
                      {u.name.toUpperCase()}
                    </div>

                    {/* Description */}
                    <div className="pg-card-lux-desc">
                      {u.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Séparateur orné */}
          <div className="pg-sep-lux" style={{ marginBottom: 14 }}>
            <div className="pg-lux-gem" style={{ width: 6, height: 6 }} />
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                fontSize: 7,
                color: PG.textMuted,
                fontFamily: "var(--pg-font)",
                letterSpacing: "0.06em",
              }}
            >
              CHOISIS UNE AMÉLIORATION
            </div>

            <button
              onClick={onSkip}
              className="pg-btn pg-btn-ghost pg-btn-ghost-warn"
              style={{ fontSize: 7, padding: "8px 14px", letterSpacing: "0.06em" }}
            >
              PASSER →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
