"use client";

import type { CSSProperties, ReactNode, PointerEventHandler } from "react";

/**
 * Peg-bouton partagé — une seule source pour toute l'UI Peagle (menus, pause,
 * game over, dialogs). Rend la DA « peg » du menu principal via les classes
 * `.pg-pm-btn*` de `peagle.css` (bloc plein, bevel pixel net, ombre dure, pop).
 *
 * variants :
 *  - `play`    : gros peg orange (CTA dominant) — JOUER / REPRENDRE / REJOUER
 *  - `primary` : peg vert plein standard
 *  - `neutral` : alias de `primary` (même peg vert) — secondaires du menu
 *  - `ghost`   : peg atténué, sans ombre ni pastille (actions discrètes : PASSER, RETOUR)
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
  const classes = ["pg-pm-btn"];

  if (variant === "play") classes.push("pg-pm-btn-play");
  if (variant === "ghost") classes.push("pg-pm-btn-ghost");
  if (warn) classes.push("pg-pm-btn-warn");

  // Taille : `play` porte déjà sa propre géométrie (gros peg) ; pour les autres,
  // `sm` → compact, `md` reste le peg standard.
  if (variant !== "play" && size === "sm") classes.push("pg-pm-btn-sm");

  // Le peg est pleine largeur par défaut (empilé dans une colonne). Hors menu on
  // veut souvent un bouton ajusté au texte.
  if (!fullWidth) classes.push("pg-pm-btn-auto");

  return (
    <button
      type="button"
      className={classes.join(" ")}
      disabled={disabled}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      style={{
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
