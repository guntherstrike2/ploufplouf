"use client";

import { usePeagleSounds } from "../hooks/usePeagleSounds";
import { PG } from "../styles";
import "../peagle.css";

interface InstructionsProps {
  onClose: () => void;
}

const SECTIONS = [
  {
    label: "OBJECTIF",
    color: PG.gold,
    lines: [
      "Détruis toutes les cibles orange avec tes œufs.",
      "Le niveau est bouclé quand il n'en reste aucune.",
    ],
  },
  {
    label: "CONTRÔLES",
    color: PG.leaf,
    lines: [
      "Glisse ou clique pour orienter l'aigle.",
      "Relâche pour tirer l'œuf.",
      "P ou ESC pour mettre en pause.",
    ],
  },
  {
    label: "PEGS",
    color: PG.orange,
    lines: [
      "🟠 Orange — cible : doit être détruite pour gagner.",
      "⚪ Normal — bonus de points, disparaît au contact.",
      "🔵 Bumper — obstacle permanent qui propulse l'œuf fort.",
    ],
  },
  {
    label: "PANIER",
    color: PG.leaf,
    lines: [
      "Le panier se déplace en bas de l'écran.",
      "Si l'œuf y tombe, tu ne perds pas ce tir.",
    ],
  },
  {
    label: "COMBO",
    color: PG.purple,
    lines: [
      "Enchaîne les hits sans pause pour faire monter le ×N.",
      "Plus le multiplicateur est haut, plus les points s'envolent.",
    ],
  },
  {
    label: "CLUTCH",
    color: PG.red,
    lines: [
      "Quand il te reste ≤ 3 œufs, l'aigle panique.",
      "C'est le mode CLUTCH — garde la tête froide.",
    ],
  },
  {
    label: "BONUS TOTAL",
    color: PG.gold,
    lines: [
      "Vider TOUTES les cibles = 10 000 × numéro du niveau.",
      "Ce bonus est énorme — vise le tableau vide.",
    ],
  },
  {
    label: "UPGRADES",
    color: PG.green,
    lines: [
      "Entre chaque niveau, choisis 1 bonus parmi 3 :",
      "• Œuf en plus · Œuf lourd · Gros Œuf · Œil de Lynx",
    ],
  },
];

export function Instructions({ onClose }: InstructionsProps) {
  const { playMenuClick } = usePeagleSounds();

  const handleClose = () => {
    playMenuClick();
    onClose();
  };

  return (
    <div
      className="pg-settings-overlay"
      onClick={handleClose}
      style={{ zIndex: 5 }}
    >
      <div
        className="pg-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(340px, 92%)",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Titlebar */}
        <div className="pg-titlebar">
          <span className="pg-caption-btn">?</span>
          <span style={{ fontSize: 8, letterSpacing: "0.1em", flex: 1 }}>
            COMMENT JOUER
          </span>
          <span style={{ fontSize: 7, letterSpacing: "0.06em", color: PG.leaf }}>
            PEAGLE 98
          </span>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {SECTIONS.map((sec) => (
            <div
              key={sec.label}
              style={{
                border: `2px solid ${PG.border}`,
                background: PG.bg,
                overflow: "hidden",
              }}
            >
              {/* Section header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  borderBottom: `1px solid ${PG.border}`,
                  background: "linear-gradient(to bottom, #1c3812 0%, #0c1c08 100%)",
                  boxShadow: `inset 0 1px 0 0 ${PG.bevelHi}, inset 0 -2px 0 0 ${sec.color}33`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: sec.color,
                    display: "inline-block",
                    flexShrink: 0,
                    imageRendering: "pixelated",
                    boxShadow: `0 0 6px ${sec.color}88`,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--pg-font)",
                    fontSize: 7,
                    color: sec.color,
                    letterSpacing: "0.12em",
                    textShadow: `0 0 8px ${sec.color}55`,
                  }}
                >
                  {sec.label}
                </span>
              </div>

              {/* Lines */}
              <ul
                style={{
                  margin: 0,
                  padding: "7px 10px 7px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {sec.lines.map((line, j) => (
                  <li
                    key={j}
                    style={{
                      fontFamily: "var(--pg-font-ui)",
                      fontSize: 14,
                      color: PG.text,
                      lineHeight: 1.5,
                      letterSpacing: "0.02em",
                      listStyle: "none",
                    }}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "6px 12px",
            borderTop: `2px solid ${PG.border}`,
            display: "flex",
            justifyContent: "center",
            background: PG.surface,
          }}
        >
          <button
            className="pg-btn pg-btn-primary"
            style={{ padding: "6px 16px", fontSize: 7 }}
            onClick={handleClose}
          >
            COMPRIS !
          </button>
        </div>
      </div>
    </div>
  );
}
