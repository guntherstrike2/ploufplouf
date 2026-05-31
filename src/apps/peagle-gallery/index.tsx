"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { AppProps } from "@/types";
import { PG } from "@/apps/peagle/styles";
import {
  PEG_PALETTES, BACKGROUNDS, BIRD_SPRITES, BALL_STYLES, BUCKET_STYLES,
  getActiveAssetId, setActiveAsset, ASSETS_CHANGED_EVENT,
} from "@/apps/peagle/engine/assets";
import type { AssetCategory, BgVariant, BirdSprite, BallStyle, BucketStyle } from "@/apps/peagle/engine/assets";
import type { PegTheme } from "@/apps/peagle/engine/game-theme";

// ─── Helpers de dessin (aperçu uniquement) ──────────────────────────────────────

function bevelSquare(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string, hi: string, dark: string) {
  const s = Math.round(r * 2), x = Math.round(cx - r), y = Math.round(cy - r);
  ctx.fillStyle = fill; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = hi; ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y, 1, s);
  ctx.fillStyle = dark; ctx.fillRect(x, y + s - 1, s, 1); ctx.fillRect(x + s - 1, y, 1, s);
}

function drawPegPreview(ctx: CanvasRenderingContext2D, p: PegTheme, w: number, h: number) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  const cy = h / 2, r = 8;
  bevelSquare(ctx, w * 0.25, cy, r, p.normal, p.normalHi, p.normalDark);
  bevelSquare(ctx, w * 0.5, cy, r, p.orange, p.orangeHi, p.orangeDark);
  bevelSquare(ctx, w * 0.75, cy, r, p.orangeFever, p.orangeGlow, p.orangeDark);
}

function drawBirdPreview(ctx: CanvasRenderingContext2D, sprite: BirdSprite, w: number, h: number) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  const rows = sprite.grid.length, cols = sprite.grid[0]?.length ?? 9;
  const cell = Math.floor(Math.min(w / cols, h / rows));
  const ox = Math.round((w - cols * cell) / 2), oy = Math.round((h - rows * cell) / 2);
  for (let r = 0; r < rows; r++) {
    const line = sprite.grid[r]!;
    for (let c = 0; c < cols; c++) {
      const ch = line[c]!;
      if (ch === ".") continue;
      const color = sprite.palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
    }
  }
}

function drawBucketPreview(ctx: CanvasRenderingContext2D, style: BucketStyle, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  // Œuf (derrière le bord du nid)
  const ex = w / 2, ey = h / 2 + 4, rx = 11, ry = 13;
  ctx.fillStyle = style.egg;
  ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = style.eggHi;
  ctx.fillRect(ex - rx + 3, ey - ry + 2, 4, 2);
  // Nid (cuvette) — couches de brindilles
  ctx.fillStyle = style.nestDark;
  ctx.fillRect(w / 2 - 26, h - 18, 52, 12);
  ctx.fillStyle = style.nestMid;
  ctx.fillRect(w / 2 - 28, h - 13, 56, 6);
  ctx.fillStyle = style.nestLight;
  ctx.fillRect(w / 2 - 26, h - 9, 52, 3);
  ctx.fillStyle = style.nestRim;
  ctx.fillRect(w / 2 - 24, h - 18, 22, 1);
}

function drawBallPreview(ctx: CanvasRenderingContext2D, style: BallStyle, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = 12;
  // halo
  ctx.fillStyle = style.glow; ctx.globalAlpha = 0.22;
  ctx.fillRect(cx - r - 3, cy - r - 3, r * 2 + 6, r * 2 + 6);
  ctx.globalAlpha = 1;
  // corps
  ctx.fillStyle = style.body;
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r + 2, 0, 0, Math.PI * 2); ctx.fill();
  // reflet
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(cx - r + 3, cy - r, 3, 2);
}

// ─── Carte canvas générique ──────────────────────────────────────────────────────

function CanvasCard({
  name, selected, draw, onSelect,
}: {
  name: string;
  selected: boolean;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = 96, H = 56;
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) draw(ctx, W, H);
  });
  return (
    <button onClick={onSelect} style={cardStyle(selected)}>
      <canvas ref={ref} width={W} height={H} style={{ width: W, height: H, imageRendering: "pixelated", display: "block", borderRadius: 2 }} />
      <span style={cardLabel(selected)}>{name}</span>
    </button>
  );
}

function ColorCard({
  name, selected, gradient, onSelect,
}: {
  name: string;
  selected: boolean;
  gradient: string;
  onSelect: () => void;
}) {
  return (
    <button onClick={onSelect} style={cardStyle(selected)}>
      <div style={{ width: 96, height: 56, background: gradient, borderRadius: 2 }} />
      <span style={cardLabel(selected)}>{name}</span>
    </button>
  );
}

function rgb(c: readonly [number, number, number]) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function bgGradient(v: BgVariant) {
  return `linear-gradient(to bottom, ${rgb(v.bg.skyTop)} 0%, ${rgb(v.bg.skyBot)} 60%, ${v.bg.groundColor} 100%)`;
}

// ─── App ─────────────────────────────────────────────────────────────────────────

export function PeagleGalleryApp({ windowId: _windowId }: AppProps) {
  // bump force le re-render après une sélection (le cache module est déjà à jour)
  const [, setBump] = useState(0);
  const refresh = useCallback(() => setBump(b => b + 1), []);

  // Sync si l'asset change depuis une autre fenêtre (ex. DevPanel)
  useEffect(() => {
    window.addEventListener(ASSETS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ASSETS_CHANGED_EVENT, refresh);
  }, [refresh]);

  const pick = useCallback((cat: AssetCategory, id: string) => {
    setActiveAsset(cat, id);
    refresh();
  }, [refresh]);

  return (
    <div
      className="peagle-root"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#060e04",
        fontFamily: "var(--pg-font)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 14px",
          borderBottom: `1px solid ${PG.hi}`,
          background: "#0c1a08",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 9, color: "#aaee66", letterSpacing: "0.06em" }}>🎨 GALERIE PEAGLE</span>
        <span style={{ fontSize: 7, color: PG.textMuted, flex: 1 }}>— choisis tes assets, ça s&apos;applique en live</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
        <Section title="PEGS">
          {PEG_PALETTES.map(v => (
            <CanvasCard
              key={v.id}
              name={v.name}
              selected={getActiveAssetId("pegPalette") === v.id}
              draw={(ctx, w, h) => drawPegPreview(ctx, v.value, w, h)}
              onSelect={() => pick("pegPalette", v.id)}
            />
          ))}
        </Section>

        <Section title="ARRIÈRE-PLAN">
          {BACKGROUNDS.map(v => (
            <ColorCard
              key={v.id}
              name={v.name}
              selected={getActiveAssetId("background") === v.id}
              gradient={bgGradient(v.value)}
              onSelect={() => pick("background", v.id)}
            />
          ))}
        </Section>

        <Section title="OISEAU">
          {BIRD_SPRITES.map(v => (
            <CanvasCard
              key={v.id}
              name={v.name}
              selected={getActiveAssetId("bird") === v.id}
              draw={(ctx, w, h) => drawBirdPreview(ctx, v.value, w, h)}
              onSelect={() => pick("bird", v.id)}
            />
          ))}
        </Section>

        <Section title="ŒUF">
          {BALL_STYLES.map(v => (
            <CanvasCard
              key={v.id}
              name={v.name}
              selected={getActiveAssetId("ball") === v.id}
              draw={(ctx, w, h) => drawBallPreview(ctx, v.value, w, h)}
              onSelect={() => pick("ball", v.id)}
            />
          ))}
        </Section>

        <Section title="PANIER">
          {BUCKET_STYLES.map(v => (
            <CanvasCard
              key={v.id}
              name={v.name}
              selected={getActiveAssetId("bucket") === v.id}
              draw={(ctx, w, h) => drawBucketPreview(ctx, v.value, w, h)}
              onSelect={() => pick("bucket", v.id)}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: "#88cc44", letterSpacing: "0.1em", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>
    </div>
  );
}

function cardStyle(selected: boolean): React.CSSProperties {
  return {
    padding: 4,
    cursor: "pointer",
    background: selected ? PG.cyan + "18" : "#122010",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: selected ? PG.cyan : "#2a4a22",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  };
}

function cardLabel(selected: boolean): React.CSSProperties {
  return {
    fontSize: 7,
    color: selected ? PG.cyan : "#c8e8b0",
    fontFamily: "var(--pg-font)",
    maxWidth: 96,
    textAlign: "center",
    lineHeight: 1.2,
  };
}
