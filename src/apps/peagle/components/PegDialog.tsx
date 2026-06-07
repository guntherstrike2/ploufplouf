"use client";

import type { CSSProperties, ReactNode } from "react";
import { PG } from "../styles";

/**
 * Dialog pixel partagé — **même DA que le menu Réglages/Options** : carte forêt
 * diégétique (`pg-settings-card`), sans barre de titre « fenêtre OS ». Le titre
 * et le badge vivent en tête du corps ; le contenu est scrollable et borné en
 * hauteur (rien ne peut être coupé, même avec beaucoup de versions).
 *
 * Utilisé par les overlays riches (notes de MAJ, instructions).
 */
interface PegDialogProps {
  /** Glyphe affiché à gauche du titre. */
  icon?: ReactNode;
  title: string;
  /** Badge à droite du titre (ex: version). */
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
      {/* Carte forêt diégétique — identique au menu Réglages (pas de titlebar). */}
      <div
        className="pg-settings-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          // Borne la carte dans l'overlay (16px de padding) → jamais plus haute
          // que la scène, donc rien n'est coupé.
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* En-tête léger : titre + badge, dans la matière de la carte (pas une
            barre de titre OS). */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 16px 10px",
          }}
        >
          {icon != null && (
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
          )}
          <span style={{
            fontFamily: "var(--pg-font)",
            fontSize: 9,
            letterSpacing: "0.1em",
            color: PG.text,
            flex: 1,
          }}>
            {title}
          </span>
          {badge != null && (
            <span style={{
              fontFamily: "var(--pg-font)",
              fontSize: 8,
              letterSpacing: "0.06em",
              color: badgeColor,
              flexShrink: 0,
            }}>
              {badge}
            </span>
          )}
        </div>

        {/* Séparateur pixel (même que les Réglages). */}
        <div className="pg-settings-divider" aria-hidden style={{ margin: "0 16px", flexShrink: 0 }} />

        {/* Corps scrollable */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: bodyGap,
          }}
        >
          {children}
        </div>

        {/* Footer fixe */}
        {footer != null && (
          <>
            <div className="pg-settings-divider" aria-hidden style={{ margin: "0 16px", flexShrink: 0 }} />
            <div
              style={{
                flexShrink: 0,
                padding: "10px 16px 14px",
                display: "flex",
                justifyContent: footerJustify,
                alignItems: "center",
                gap: 8,
              }}
            >
              {footer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
