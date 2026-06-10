"use client";

import { usePeagleSounds } from "../hooks/usePeagleSounds";
import { PG } from "../styles";
import { PegBtn } from "./PegBtn";
import { PegDialog } from "./PegDialog";
import "../peagle.css";
import "../palette-style";

interface InstructionsProps {
  onClose: () => void;
}

const SECTIONS = [
  {
    label: "OBJECTIVE",
    color: PG.gold,
    lines: [
      "Clear every orange peg to advance to the next level.",
    ],
  },
  {
    label: "CONTROLS",
    color: PG.leaf,
    lines: [
      "Aim with the mouse (or finger), release to shoot.",
      "P or ESC to pause.",
    ],
  },
  {
    label: "PEGS",
    color: PG.orange,
    lines: [
      "🟠 Orange — clear these to win.",
      "🔵 Blue — point bonus, vanishes on contact.",
      "🟡 Gold — fixed bumper, launches the egg.",
      "The basket at the bottom catches your egg if you land it there.",
    ],
  },
  {
    label: "UPGRADES",
    color: PG.green,
    lines: [
      "Between each level, pick one bonus out of 3.",
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
      title="HOW TO PLAY"
      badge="PEAGLE 98"
      badgeColor={PG.leaf}
      width="min(340px, 92%)"
      bodyGap={6}
      onClose={handleClose}
      footer={
        <PegBtn variant="primary" size="sm" onClick={handleClose}>
          GOT IT!
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
