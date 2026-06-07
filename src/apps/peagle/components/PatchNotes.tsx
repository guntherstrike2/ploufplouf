"use client";

import { PEAGLE_VERSIONS, PEAGLE_CURRENT_VERSION } from "../peagle-versions";
import { usePeagleSounds } from "../hooks/usePeagleSounds";
import { PG } from "../styles";
import { PegBtn } from "./PegBtn";
import { PegDialog } from "./PegDialog";
import "../peagle.css";

interface PatchNotesProps {
  onClose: () => void;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function PatchNotes({ onClose }: PatchNotesProps) {
  const { playMenuClick } = usePeagleSounds();

  const handleClose = () => {
    playMenuClick();
    onClose();
  };

  return (
    <PegDialog
      icon="📋"
      title="NOTES DE MISE À JOUR"
      badge={`v${PEAGLE_CURRENT_VERSION}`}
      badgeColor={PG.gold}
      width="min(380px, 94%)"
      footerJustify="space-between"
      onClose={handleClose}
      footer={
        <>
          <span style={{ fontFamily: "var(--pg-font)", fontSize: 7, color: "var(--pg-text-muted)", letterSpacing: "0.06em" }}>
            {PEAGLE_VERSIONS.length} version{PEAGLE_VERSIONS.length !== 1 ? "s" : ""}
          </span>
          <PegBtn variant="primary" size="sm" onClick={handleClose}>
            FERMER
          </PegBtn>
        </>
      }
    >
      {PEAGLE_VERSIONS.map((release, i) => (
        <div
          key={release.version}
          style={{
            border: `2px solid ${PG.border}`,
            borderRadius: 6,
            overflow: "hidden",
            background: i === 0 ? "var(--pg-surface)" : "var(--pg-bg)",
          }}
        >
          {/* En-tête de version */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "6px 10px",
              borderBottom: `1px solid ${PG.border}`,
              background: i === 0
                ? "linear-gradient(to bottom, #1c3812 0%, #122a0c 55%, #0c1c08 100%)"
                : "var(--pg-surface-2)",
              boxShadow: i === 0
                ? "inset 0 1px 0 0 var(--pg-bevel-hi), inset 0 -3px 0 0 var(--pg-green-deep)"
                : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {i === 0 && (
                <span style={{
                  fontSize: 6,
                  background: PG.gold,
                  color: "#160a00",
                  padding: "2px 5px",
                  fontFamily: "var(--pg-font)",
                  letterSpacing: "0.08em",
                  fontWeight: "bold",
                  flexShrink: 0,
                }}>
                  LATEST
                </span>
              )}
              <span style={{
                fontFamily: "var(--pg-font)",
                fontSize: 9,
                color: i === 0 ? PG.gold : PG.leaf,
                letterSpacing: "0.08em",
                textShadow: i === 0 ? `0 0 8px ${PG.gold}88` : undefined,
              }}>
                v{release.version}
              </span>
            </div>
            <span style={{
              fontSize: 12,
              color: "var(--pg-text-muted)",
              fontFamily: "var(--pg-font-ui)",
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}>
              {formatDate(release.releasedAt)}
            </span>
          </div>

          {/* Notes — police UI (VT323) pour la lisibilité */}
          <ul style={{
            margin: 0,
            padding: "8px 12px 9px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}>
            {release.notes.map((note, j) => (
              <li key={j} style={{
                fontFamily: "var(--pg-font-ui)",
                fontSize: 14,
                color: i === 0 ? "var(--pg-text)" : "var(--pg-text-muted)",
                lineHeight: 1.4,
                letterSpacing: "0.01em",
                listStyle: "disc",
              }}>
                {note}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </PegDialog>
  );
}
