// ─── Peagle — visual themes (data only) ──────────────────────────────────────
// The renderer reads colours from here. 1 theme in v1; the registry lets us add
// more (recovered from the old game-theme.ts) without touching draw code.

export interface Theme {
  id: string;
  name: string;
  /** Vertical sky gradient stops (top → bottom). */
  skyTop: string;
  skyBottom: string;
  /** Ground / horizon accent. */
  ground: string;
  /** Egg colours. */
  egg: string;
  eggHi: string;
  /** Aim line + UI accent. */
  accent: string;
  /** Bucket. */
  bucket: string;
  bucketHi: string;
}

export const THEMES: Record<string, Theme> = {
  foret: {
    id: "foret",
    name: "Forêt",
    skyTop: "#1a2f4a",
    skyBottom: "#27496b",
    ground: "#1c3a2a",
    egg: "#fff4e0",
    eggHi: "#ffffff",
    accent: "#9fe0ff",
    bucket: "#6b4a2a",
    bucketHi: "#a9783f",
  },
};

export const DEFAULT_THEME: Theme = THEMES.foret!;
