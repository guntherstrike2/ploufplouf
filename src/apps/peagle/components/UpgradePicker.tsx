"use client";

import { useEffect } from "react";
import "../peagle.css";
import type { UpgradeId } from "../engine/roguelite";
import { UPGRADES } from "../engine/roguelite";
import { PG } from "../styles";
import { PegBtn } from "./PegBtn";
import { usePeagleSounds } from "../hooks/usePeagleSounds";

// Couleur de bande par upgrade id — donne une identité visuelle (rareté) à chaque bonus.
const CARD_COLORS: Record<UpgradeId, { band: string; name: string; label: string }> = {
  extra_ball:  { band: PG.leaf,   name: PG.leaf,   label: "COMMUN"  },
  heavy_ball:  { band: "#4488ff", name: "#7ab0ff", label: "RARE"    },
  bigger_ball: { band: "#4488ff", name: "#7ab0ff", label: "RARE"    },
  sharp_aim:   { band: PG.purple, name: "#d088ff", label: "ÉPIQUE"  },
};

interface UpgradePickerProps {
  offers: UpgradeId[];
  level: number;
  score: number;
  onPick: (id: UpgradeId) => void;
  onSkip: () => void;
}

export function UpgradePicker({ offers, level, score, onPick, onSkip }: UpgradePickerProps) {
  const { playUpgradeReveal, playUpgradeHover, playUpgradePick, playUpgradeSkip } = usePeagleSounds();

  useEffect(() => { playUpgradeReveal(); }, [playUpgradeReveal]);

  return (
    // Même coquille diégétique que le menu Réglages : overlay sombre simple,
    // carte « tablette de bois forêt » sans titlebar OS ni thème or — juste le
    // contenu dans le bevel pixel commun, entrée bouncy cohérente avec le menu.
    <div className="pg-settings-overlay" style={{ zIndex: 10 }}>
      <div className="pg-settings-card pg-upg-card" onClick={(e) => e.stopPropagation()}>
        <div className="pg-settings-body">

          {/* En-tête diégétique : pastille glyphe + intitulé du palier */}
          <div className="pg-upg-head">
            <span className="pg-caption-btn">🏆</span>
            <span className="pg-upg-head-title">NIVEAU {level} TERMINÉ</span>
          </div>

          {/* Score — champ creux pixel, comme les autres écrans */}
          <div className="pg-settings-row pg-upg-score">
            <span>SCORE</span>
            <span className="pg-upg-score-val">{score.toLocaleString()}</span>
          </div>

          <div className="pg-settings-divider" aria-hidden />

          {/* Invite + cartes de bonus */}
          <span className="pg-upg-prompt">CHOISIS UN BONUS</span>

          <div className="pg-upg-cards">
            {offers.map((id, i) => {
              const u = UPGRADES[id];
              if (!u) return null;
              const col = CARD_COLORS[id] ?? { band: PG.leaf, name: PG.leaf, label: "BONUS" };
              return (
                <button
                  key={id}
                  onPointerEnter={playUpgradeHover}
                  onClick={() => { playUpgradePick(); onPick(id); }}
                  className="pg-upg-cardbtn"
                  style={{ animationDelay: `${i * 0.09}s` }}
                >
                  {/* Bande couleur de rareté */}
                  <div className="pg-upg-cardbtn-band" style={{ background: col.band }} />

                  <div className="pg-upg-cardbtn-inner">
                    <div className="pg-upg-cardbtn-rarity" style={{ color: col.band }}>
                      {col.label}
                    </div>
                    <div className="pg-upg-cardbtn-name" style={{ color: col.name }}>
                      {u.name.toUpperCase()}
                    </div>
                    <div className="pg-upg-cardbtn-desc">
                      {u.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <PegBtn
            variant="ghost"
            size="sm"
            warn
            style={{ alignSelf: "center", marginTop: 4 }}
            onPointerEnter={playUpgradeHover}
            onClick={() => { playUpgradeSkip(); onSkip(); }}
          >
            PASSER
          </PegBtn>
        </div>
      </div>
    </div>
  );
}
