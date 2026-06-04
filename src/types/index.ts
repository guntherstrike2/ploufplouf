import type { ReactNode, ComponentType } from "react";

export interface App {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  iconNode?: ReactNode;
  iconComponent?: ComponentType<{ size: number }>;
  href: string;
  badge?: string;
}

export interface AppManifest {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  iconNode?: ReactNode;
  /** Preferred over iconNode — receives a `size` prop so each context can scale it */
  iconComponent?: ComponentType<{ size: number }>;
  /** Default window size in pixels */
  defaultSize?: { w: number; h: number };
  /** Open the window maximized (full width, full height minus taskbar) */
  startMaximized?: boolean;
  /** Fake loading duration in ms (default: 1500) */
  loadDuration?: number;
  /** Show in Start menu and desktop */
  showInLauncher?: boolean;
  /** If true, the app requires the user to be logged in to access it */
  requiresAuth?: boolean;
  /** Optional Next.js page route (for nav-bar / direct URL access) */
  href?: string;
  /** Optional badge text ("NEW", "3", etc.) — static fallback; prefer `version` for dynamic badges */
  badge?: string;
  /** Semantic version string — enables dynamic "NEW" badge until user opens this version */
  version?: string;
  /** Show a "HOT 🔥" badge on the top-left of the icon */
  hot?: boolean;
  /** The React component rendered inside the window */
  component: ComponentType<AppProps>;
  /**
   * Si true, le son de cette app n'est PAS stoppé à la fermeture de la fenêtre.
   * Réservé aux apps qui vivent dans le system tray (ex: Radio).
   */
  persistAudio?: boolean;
  /**
   * Channels audio Web Audio API à stopper automatiquement à la fermeture.
   * L'app n'a pas besoin d'appeler registerAppSounds — le window manager s'en charge.
   */
  audioChannels?: string[];
}

export interface AppProps {
  windowId: string;
}

export type OsRelease = {
  version: string;
  releasedAt: string; // ISO date
  changelog: string;
};
