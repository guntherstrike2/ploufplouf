// Réglages visuels du jeu, pilotés depuis le menu Options (pause/menu).
//
// Vit hors de React : la couche React (PegBtn du menu Options) mute l'état via
// `setScanlines` / `setPixel` et persiste en localStorage. L'overlay CRT global
// (`CrtOverlay`) s'abonne via `subscribeVisualSettings` pour se redessiner.
//
// Les DEUX effets sont rendus par un unique overlay DOM par-dessus toute la zone
// de jeu (canvas + menus React) — plus aucun rendu canvas ni trame CSS par
// composant. Off par défaut.

export interface VisualSettings {
  /** Trame de scanlines CRT par-dessus toute la zone de jeu. */
  scanlines: boolean;
  /** Grille de gros pixels CSS par-dessus toute la zone de jeu. */
  pixel: boolean;
  /** Tremblement d'écran (screen shake) à l'impact. On par défaut. */
  screenShake: boolean;
}

const LS_KEY = "peagle98_visual";

const DEFAULTS: VisualSettings = { scanlines: false, pixel: false, screenShake: true };

let _settings: VisualSettings = { ...DEFAULTS };
let _loaded = false;

const _listeners = new Set<() => void>();

function load(): void {
  if (_loaded || typeof window === "undefined") return;
  _loaded = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VisualSettings>;
      _settings = {
        scanlines: parsed.scanlines ?? DEFAULTS.scanlines,
        pixel: parsed.pixel ?? DEFAULTS.pixel,
        screenShake: parsed.screenShake ?? DEFAULTS.screenShake,
      };
    }
  } catch { /* quota / private mode / JSON invalide → on garde les défauts */ }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(_settings)); } catch { /* silent */ }
}

function emit(): void {
  for (const fn of _listeners) fn();
}

/** Lecture synchrone de l'état courant. */
export function getVisualSettings(): Readonly<VisualSettings> {
  load();
  return _settings;
}

/**
 * Snapshot SSR / première hydratation : toujours les défauts (off), jamais
 * localStorage. Le serveur rend `_settings` aux défauts ; lire localStorage
 * côté client ici provoquerait un mismatch d'hydratation. Les vrais réglages
 * sont appliqués juste après le montage via `getVisualSettings`.
 */
export function getServerVisualSettings(): Readonly<VisualSettings> {
  return DEFAULTS;
}

/** S'abonne aux changements. Renvoie une fonction de désabonnement. */
export function subscribeVisualSettings(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function setScanlines(on: boolean): void {
  load();
  _settings = { ..._settings, scanlines: on };
  persist();
  emit();
}

export function setPixel(on: boolean): void {
  load();
  _settings = { ..._settings, pixel: on };
  persist();
  emit();
}

export function setScreenShake(on: boolean): void {
  load();
  _settings = { ..._settings, screenShake: on };
  persist();
  emit();
}
