"use client";

import type { CSSProperties, ReactNode, PointerEventHandler } from "react";
import { PG, btnBase, btnPrimary } from "../styles";

/**
 * Bouton pixel partagé — une seule source pour toute l'UI Peagle (menus, pause,
 * game over, dialogs). Reprend les tokens de `styles.ts` (`btnBase`, `btnPrimary`)
 * pour rester strictement à la charte « Bosquet ».
 *
 * variants :
 *  - `play`    : CTA dominant (vert, gros) — JOUER / REPRENDRE / REJOUER
 *  - `primary` : bouton plein standard (vert)
 *  - `neutral` : bouton secondaire (surface bois)
 *  - `ghost`   : lien discret sans cadre (PASSER, RETOUR)
 */
type PegBtnVariant = "play" | "primary" | "neutral" | "ghost";

interface PegBtnProps {
  children: ReactNode;
  onClick?: () => void;
  onPointerEnter?: PointerEventHandler<HTMLButtonElement>;
  variant?: PegBtnVariant;
  size?: "sm" | "md";
  fullWidth?: boolean;
  /** Teinte d'avertissement (orange) pour les actions « à risque » (PASSER). */
  warn?: boolean;
  style?: CSSProperties;
  disabled?: boolean;
}

export function PegBtn({
  children,
  onClick,
  onPointerEnter,
  variant = "neutral",
  size = "md",
  fullWidth = false,
  warn = false,
  style,
  disabled = false,
}: PegBtnProps) {
  const sm = size === "sm";

  // Base commune à tous les variants encadrés.
  const framed: CSSProperties = {
    ...btnBase,
    fontSize: sm ? 7 : 8,
    padding: sm ? "7px 11px" : "11px 16px",
    width: fullWidth ? "100%" : undefined,
  };

  let variantStyle: CSSProperties;
  switch (variant) {
    case "play":
      variantStyle = {
        ...framed,
        ...btnPrimary,
        fontSize: sm ? 9 : 11,
        padding: sm ? "9px 14px" : "13px 20px",
        width: fullWidth ? "100%" : undefined,
        letterSpacing: "0.08em",
      };
      break;
    case "primary":
      variantStyle = { ...framed, ...btnPrimary, fontSize: framed.fontSize };
      break;
    case "ghost":
      variantStyle = {
        fontFamily: "var(--font-press-start), monospace",
        fontSize: sm ? 7 : 8,
        cursor: "pointer",
        padding: sm ? "6px 10px" : "9px 14px",
        background: "none",
        border: 0,
        color: warn ? PG.orange : PG.textMuted,
        letterSpacing: "0.08em",
        lineHeight: 1.4,
        textShadow: "0 1px 2px rgba(0,0,0,0.9)",
        transition: "color 0.1s, filter 0.1s",
        width: fullWidth ? "100%" : undefined,
      };
      break;
    case "neutral":
    default:
      variantStyle = framed;
      break;
  }

  if (warn && variant !== "ghost") {
    variantStyle = {
      ...variantStyle,
      background: `linear-gradient(to bottom, ${PG.orangeGlow} 0 45%, ${PG.orange} 45% 72%, ${PG.orangeDeep} 72% 100%)`,
      color: "#1a0a03",
    };
  }

  return (
    <button
      type="button"
      className="pg-btn"
      disabled={disabled}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      style={{
        ...variantStyle,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
