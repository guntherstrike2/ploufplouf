"use client";

// ─── Peagle — canvas surface (sized to internal coords, CSS-scaled) ───────────

import { forwardRef, type PointerEvent as ReactPointerEvent } from "react";
import { FIELD } from "../content/config";

interface Props {
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerDown: () => void;
}

export const GameCanvas = forwardRef<HTMLCanvasElement, Props>(function GameCanvas(
  { onPointerMove, onPointerDown },
  ref,
) {
  return (
    <canvas
      ref={ref}
      width={FIELD.w}
      height={FIELD.h}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
        cursor: "crosshair",
        imageRendering: "pixelated",
        touchAction: "none",
      }}
    />
  );
});
