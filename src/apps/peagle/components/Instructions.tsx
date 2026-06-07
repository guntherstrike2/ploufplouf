"use client";

import { usePeagleSounds } from "../hooks/usePeagleSounds";
import { PG } from "../styles";
import { PegBtn } from "./PegBtn";
import { PegDialog } from "./PegDialog";
import "../peagle.css";

interface InstructionsProps {
  onClose: () => void;
}

const SECTIONS = [
  {
    label: "OBJECTIF",
    color: PG.gold,
    lines: [
      "Détruis tous les pegs orange pour passer au niveau suivant.",
    ],
  },
  {
    label: "CONTRÔLES",
    color: PG.leaf,
    lines: [
      "Vise avec la souris (ou le doigt), relâche pour tirer.",
      "P ou ESC pour mettre en pause.",
    ],
  },
  {
    label: "PEGS",
    color: PG.orange,
    lines: [
      "🟠 Orange — à détruire pour gagner.",
      "🔵 Bleu — bonus de points, disparaît au contact.",
      "🟡 Doré — bumper fixe, propulse l'œuf.",
      "Le panier en bas récupère ton œuf si tu l'y envoies.",
    ],
  },
  {
    label: "UPGRADES",
    color: PG.green,
    lines: [
      "Entre chaque niveau, choisis un bonus parmi 3.",
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
    <PegDialog
      icon="?"
      title="COMMENT JOUER"
      badge="PEAGLE 98"
      badgeColor={PG.leaf}
      width="min(340px, 92%)"
      bodyGap={6}
      onClose={handleClose}
      footer={
        <PegBtn variant="primary" size="sm" onClick={handleClose}>
          COMPRIS !
        </PegBtn>
      }
    >
      {SECTIONS.map((sec) => (
            <div
              key={sec.label}
              style={{
                flexShrink: 0,
                border: `2px solid ${PG.border}`,
                borderRadius: 6,
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
                    width: 8,
                    height: 8,
                    background: sec.color,
                    display: "inline-block",
                    flexShrink: 0,
                    borderRadius: 3,
                    imageRendering: "pixelated",
                    // Pastille « peg » nette : bevel dur, pas de glow flou.
                    boxShadow: `inset 1px 1px 0 0 rgba(255,255,255,0.5), inset -1px -1px 0 0 rgba(0,0,0,0.35)`,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--pg-font)",
                    fontSize: 7,
                    color: sec.color,
                    letterSpacing: "0.12em",
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
    </PegDialog>
  );
}
