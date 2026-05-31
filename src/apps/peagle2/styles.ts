// ─── Peagle — shared inline styles (Win98 flavour, theme-variable driven) ─────
// Uses GunthOS CSS variables; never hardcodes colours or font sizes.

import type { CSSProperties } from "react";

export const panel: CSSProperties = {
  background: "var(--t-app-bg)",
  border: "2px solid",
  borderColor: "var(--t-border-light) var(--t-border-dark) var(--t-border-dark) var(--t-border-light)",
};

export const raisedBtn: CSSProperties = {
  background: "var(--t-bg)",
  border: "2px solid",
  borderColor: "var(--t-border-light) var(--t-border-dark) var(--t-border-dark) var(--t-border-light)",
  color: "var(--t-text)",
  fontFamily: "var(--t-font-display)",
  fontSize: "var(--t-text-base)",
  padding: "6px 14px",
  cursor: "pointer",
};

export const sunken: CSSProperties = {
  background: "var(--t-app-bg)",
  border: "2px solid",
  borderColor: "var(--t-border-dark) var(--t-border-light) var(--t-border-light) var(--t-border-dark)",
};
