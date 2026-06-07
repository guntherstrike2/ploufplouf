"use client";

import type { CSSProperties, ReactNode } from "react";
import { PG } from "../styles";

/**
 * Dialog pixel partagé — fenêtre « Bosquet » avec titlebar, corps scrollable et
 * footer fixe. Utilisé par les overlays riches (notes de MAJ, instructions).
 *
 * Le corps est **toujours scrollable** et la fenêtre est bornée en hauteur
 * (`maxHeight`) : le contenu ne peut plus déborder ni se faire couper, même avec
 * beaucoup de versions au changelog.
 */
interface PegDialogProps {
  /** Glyphe affiché dans la pastille de titre. */
  icon?: ReactNode;
  title: string;
  /** Badge à droite de la titlebar (ex: version). */
  badge?: ReactNode;
  badgeColor?: string;
  children: ReactNode;
  footer?: ReactNode;
  footerJustify?: CSSProperties["justifyContent"];
  width?: string;
  /** Gap entre les blocs du corps. */
  bodyGap?: number;
  onClose: () => void;
}

export function PegDialog({
  icon,
  title,
  badge,
  badgeColor = PG.gold,
  children,
  footer,
  footerJustify = "flex-end",
  width = "min(360px, 92%)",
  bodyGap = 8,
  onClose,
}: PegDialogProps) {
  return (
    <div
      className="pg-settings-overlay"
      onClick={onClose}
      style={{ zIndex: 5, padding: 16 }}
    >
      <div
        className="pg-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          // Borne la fenêtre dans l'overlay (qui a 16px de padding) → jamais
          // plus haute que la scène, donc rien n'est coupé.
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Titlebar */}
        <div className="pg-titlebar" style={{ flexShrink: 0 }}>
          {icon != null && <span className="pg-caption-btn">{icon}</span>}
          <span style={{ fontSize: 8, letterSpacing: "0.1em", flex: 1, color: PG.text }}>
            {title}
          </span>
          {badge != null && (
            <span style={{ fontSize: 7, letterSpacing: "0.06em", color: badgeColor }}>
              {badge}
            </span>
          )}
        </div>

        {/* Corps scrollable */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: bodyGap,
          }}
        >
          {children}
        </div>

        {/* Footer fixe */}
        {footer != null && (
          <div
            style={{
              flexShrink: 0,
              padding: "8px 12px",
              borderTop: `2px solid ${PG.border}`,
              display: "flex",
              justifyContent: footerJustify,
              alignItems: "center",
              gap: 8,
              background: "var(--pg-surface)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
