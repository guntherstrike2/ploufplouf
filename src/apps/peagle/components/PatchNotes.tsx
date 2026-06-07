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
      bodyGap={12}
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
        <div key={release.version} style={{ flexShrink: 0 }}>
          {/* Filet de séparation entre versions (sauf la première). */}
          {i > 0 && <div className="pg-settings-divider" aria-hidden style={{ marginBottom: 12 }} />}
          {/* (le gap flex de la carte gère l'espace au-dessus du filet) */}

          {/* En-tête de version — à plat, sur la matière de la carte. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 6,
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
            padding: "0 0 0 18px",
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
