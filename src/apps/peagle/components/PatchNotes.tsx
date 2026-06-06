"use client";

import { PEAGLE_VERSIONS, PEAGLE_CURRENT_VERSION } from "../peagle-versions";
import { usePeagleSounds } from "../hooks/usePeagleSounds";
import { PG } from "../styles";

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
    <div
      className="pg-settings-overlay"
      onClick={handleClose}
      style={{ zIndex: 5 }}
    >
      <div
        className="pg-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(340px, 90%)", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        {/* Titlebar */}
        <div className="pg-titlebar">
          <span className="pg-caption-btn">📋</span>
          <span style={{ fontSize: 8, letterSpacing: "0.1em", flex: 1 }}>NOTES DE MISE À JOUR</span>
          <span style={{ fontSize: 7, letterSpacing: "0.06em", color: PG.gold }}>
            v{PEAGLE_CURRENT_VERSION}
          </span>
        </div>

        {/* Release list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {PEAGLE_VERSIONS.map((release, i) => (
            <div
              key={release.version}
              style={{
                border: `2px solid ${PG.border}`,
                background: i === 0 ? "var(--pg-surface)" : "var(--pg-bg)",
              }}
            >
              {/* Version header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {i === 0 && (
                    <span style={{
                      fontSize: 6,
                      background: PG.gold,
                      color: "#160a00",
                      padding: "1px 5px",
                      fontFamily: "var(--pg-font)",
                      letterSpacing: "0.08em",
                      fontWeight: "bold",
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
                  fontSize: 7,
                  color: "var(--pg-text-muted)",
                  fontFamily: "var(--pg-font)",
                  letterSpacing: "0.04em",
                }}>
                  {formatDate(release.releasedAt)}
                </span>
              </div>

              {/* Notes list */}
              <ul style={{
                margin: 0,
                padding: "8px 10px 8px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}>
                {release.notes.map((note, j) => (
                  <li key={j} style={{
                    fontFamily: "var(--pg-font)",
                    fontSize: 7,
                    color: i === 0 ? "var(--pg-text)" : "var(--pg-text-muted)",
                    lineHeight: 1.7,
                    letterSpacing: "0.03em",
                    listStyle: "disc",
                  }}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "6px 12px",
          borderTop: `2px solid ${PG.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--pg-surface)",
        }}>
          <span style={{ fontFamily: "var(--pg-font)", fontSize: 6, color: "var(--pg-text-muted)", letterSpacing: "0.06em" }}>
            {PEAGLE_VERSIONS.length} version{PEAGLE_VERSIONS.length !== 1 ? "s" : ""}
          </span>
          <button
            className="pg-btn"
            style={{ padding: "6px 12px", fontSize: 7 }}
            onClick={handleClose}
          >
            FERMER
          </button>
        </div>
      </div>
    </div>
  );
}
