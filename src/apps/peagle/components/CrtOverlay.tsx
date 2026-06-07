"use client";

import { useSyncExternalStore } from "react";
import {
  getServerVisualSettings,
  getVisualSettings,
  subscribeVisualSettings,
} from "../engine/visual-settings";

/**
 * Overlay CRT global — unique source des effets « Scanlines » et « Pixel ».
 *
 * Posé en `position:absolute; inset:0` par-dessus TOUTE la zone de jeu (canvas +
 * menus React : pause, game-over, options, upgrade…). Les anciens rendus canvas
 * (scanlines bakées, downscale pixel) et les trames CSS par composant ont été
 * retirés — tout passe désormais par cette couche unique.
 *
 * `pointer-events:none` → l'overlay ne capture jamais les clics. Mis sous le
 * voile de transition d'écran (z-index 200) mais au-dessus des overlays de jeu.
 */
export function CrtOverlay() {
  const settings = useSyncExternalStore(
    subscribeVisualSettings,
    () => getVisualSettings(),
    () => getServerVisualSettings(),
  );

  if (!settings.scanlines && !settings.pixel) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 150,
        pointerEvents: "none",
      }}
    >
      {/* Scanlines : fines lignes sombres horizontales (2px de période). */}
      {settings.scanlines && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(to bottom, transparent 0 1px, rgba(0,0,0,0.18) 1px 2px)",
          }}
        />
      )}

      {/* Pixel : grille fine (mask quadrillé) qui simule de gros pixels carrés. */}
      {settings.pixel && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), " +
              "linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />
      )}
    </div>
  );
}
