"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LAUNCHER_APPS } from "@/apps";
import { useSettings } from "@/lib/contexts/settings-context";
import { OsIcon } from "./os-icon";
import { useOpenApp } from "@/lib/hooks/use-open-app";
import { useUnread } from "@/lib/contexts/unread-context";
import { useSeenApps } from "@/lib/contexts/seen-apps-context";
import { WALLPAPER_MAP, DEFAULT_WALLPAPER_ID } from "@/lib/wallpapers";
import { WallpaperDecoration } from "./wallpaper-decorations";
import { useAuth } from "@/lib/contexts/auth-context";
import { useMobile } from "@/lib/hooks/use-mobile";

const CELL_W = 110;
const CELL_H = 100;
const GRID_PADDING = 12;

type IconId = string;

interface GridCell {
  col: number;
  row: number;
}

interface IconDef {
  id: IconId;
  emoji: string | import("react").ReactNode;
  label: string;
  badge?: string;
  hot?: boolean;
  locked?: boolean;
  onOpen: () => void;
}

const STORAGE_KEY = "desktop-icon-positions";

function loadPositions(): Record<IconId, GridCell> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function savePositions(positions: Record<IconId, GridCell>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

const MAX_ROWS_PER_COL = 8;

function getDefaultLayout(icons: IconDef[]): Record<IconId, GridCell> {
  const layout: Record<IconId, GridCell> = {};
  icons.forEach((icon, i) => {
    layout[icon.id] = { col: Math.floor(i / MAX_ROWS_PER_COL), row: i % MAX_ROWS_PER_COL };
  });
  return layout;
}

function pixelToCell(px: number, py: number): GridCell {
  return {
    col: Math.max(0, Math.round((px - GRID_PADDING) / CELL_W)),
    row: Math.max(0, Math.round((py - GRID_PADDING) / CELL_H)),
  };
}

function cellToPixel(cell: GridCell): { x: number; y: number } {
  return {
    x: GRID_PADDING + cell.col * CELL_W,
    y: GRID_PADDING + cell.row * CELL_H,
  };
}

function isCellOccupied(
  cell: GridCell,
  positions: Record<IconId, GridCell>,
  excludeId: IconId
): boolean {
  return Object.entries(positions).some(
    ([id, c]) => id !== excludeId && c.col === cell.col && c.row === cell.row
  );
}

function findNearestFreeCell(
  target: GridCell,
  positions: Record<IconId, GridCell>,
  excludeId: IconId
): GridCell {
  if (!isCellOccupied(target, positions, excludeId)) return target;
  for (let radius = 1; radius < 20; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
        const candidate = {
          col: Math.max(0, target.col + dc),
          row: Math.max(0, target.row + dr),
        };
        if (!isCellOccupied(candidate, positions, excludeId)) return candidate;
      }
    }
  }
  return target;
}

export function OsDesktop() {
  const { settings } = useSettings();
  const { openApp, openNamedWindow } = useOpenApp();
  const { totalUnread } = useUnread();
  const { seen, isNewVersion } = useSeenApps();
  const { user, isPending } = useAuth();
  const isMobile = useMobile();

  const wallpaper =
    (settings.wallpaperId
      ? WALLPAPER_MAP.get(settings.wallpaperId)
      : undefined) ?? WALLPAPER_MAP.get(DEFAULT_WALLPAPER_ID)!;

  const handleOpenApp = useCallback(
    (slug: string) => { openApp(slug); },
    [openApp]
  );

  const handleOpenSettings = useCallback(() => {
    openNamedWindow("settings", "Paramètres GunthOS", null);
  }, [openNamedWindow]);

  const icons: IconDef[] = [
    ...LAUNCHER_APPS
      .filter((app) => app.slug !== "gunthrank")
      .map((app) => ({
        id: app.slug,
        emoji: <OsIcon slug={app.slug} size={46} />,
        label: app.name,
        badge:
          app.slug === "msn" && totalUnread > 0
            ? String(totalUnread > 9 ? "9+" : totalUnread)
            : isNewVersion(app.slug, app.version)
            ? "NEW"
            : app.badge && !seen.has(app.slug)
            ? app.badge
            : undefined,
        hot: app.hot,
        locked: app.requiresAuth && !isPending && !user,
        onOpen: () => handleOpenApp(app.slug),
      })),
    {
      id: "my-computer",
      emoji: <OsIcon slug="my-computer" size={46} />,
      label: "Mon Ordi",
      onOpen: () => openNamedWindow("my-computer", "Mon Ordinateur", "🖥️"),
    },
    {
      id: "settings",
      emoji: <OsIcon slug="settings" size={46} />,
      label: "Paramètres",
      onOpen: handleOpenSettings,
    },
    {
      id: "trash",
      emoji: <OsIcon slug="trash" size={46} />,
      label: "Corbeille",
      onOpen: () => openNamedWindow("trash", "Corbeille", "🗑️"),
    },
    {
      id: "gunthrank",
      emoji: <OsIcon slug="gunthrank" size={46} />,
      label: "Classement du Kiff",
      hot: true,
      onOpen: () => openNamedWindow("gunthrank", "Classement du Kiff", "🏆"),
    },
  ];

  const [positions, setPositions] = useState<Record<IconId, GridCell>>(() =>
    getDefaultLayout(icons)
  );

  const [selectedId, setSelectedId] = useState<IconId | null>(null);

  useEffect(() => {
    const saved = loadPositions();
    const defaults = getDefaultLayout(icons);
    const merged = { ...defaults };
    for (const [id, cell] of Object.entries(saved)) {
      if (id in defaults) merged[id] = cell;
    }
    // New icons not in saved positions: find a free cell
    for (const id of Object.keys(merged)) {
      if (!(id in saved)) {
        const cell = merged[id]!;
        const occupied = Object.fromEntries(
          Object.entries(merged).filter(([k]) => k !== id)
        ) as Record<IconId, GridCell>;
        merged[id] = findNearestFreeCell(cell, occupied, id);
      }
    }
    setPositions(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMove = useCallback(
    (id: IconId, newCell: GridCell) => {
      setPositions((prev) => {
        const resolved = findNearestFreeCell(newCell, prev, id);
        const next = { ...prev, [id]: resolved };
        savePositions(next);
        return next;
      });
    },
    []
  );

  const handleDesktopClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) setSelectedId(null);
    },
    []
  );

  if (isMobile) {
    return (
      <div
        className="flex-1 overflow-y-auto select-none relative"
        style={{
          ...wallpaper.style,
          padding: "12px 8px",
        }}
        onClick={handleDesktopClick}
      >
        {wallpaper.decorationKey && (
          <WallpaperDecoration
            decorationKey={wallpaper.decorationKey}
            wallpaperId={wallpaper.id}
          />
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
            gap: "8px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {icons.map((icon) => (
            <MobileDesktopIcon
              key={icon.id}
              icon={icon}
              selected={selectedId === icon.id}
              onSelect={() => setSelectedId(icon.id)}
              onOpen={icon.onOpen}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      id="os-desktop-area"
      className="flex-1 relative overflow-hidden select-none"
      style={wallpaper.style}
      onClick={handleDesktopClick}
    >
      {wallpaper.decorationKey && (
        <WallpaperDecoration
          decorationKey={wallpaper.decorationKey}
          wallpaperId={wallpaper.id}
        />
      )}

      {icons.map((icon) => {
        const cell = positions[icon.id] ?? { col: 0, row: 0 };
        const { x, y } = cellToPixel(cell);
        return (
          <DraggableDesktopIcon
            key={icon.id}
            icon={icon}
            x={x}
            y={y}
            selected={selectedId === icon.id}
            onSelect={() => setSelectedId(icon.id)}
            onDeselect={() => setSelectedId(null)}
            onMove={(newCell) => handleMove(icon.id, newCell)}
          />
        );
      })}
    </div>
  );
}

// ─── Mobile icon — grid cell, single tap to open, long press for future menu ──

interface MobileDesktopIconProps {
  icon: IconDef;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

function MobileDesktopIcon({ icon, selected, onSelect, onOpen }: MobileDesktopIconProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerMoved = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    return () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    pointerMoved.current = false;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      // future: context menu
    }, 500);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    if (dx > 8 || dy > 8) {
      pointerMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!pointerMoved.current) {
      onSelect();
      onOpen();
    }
  }, [onSelect, onOpen]);

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="flex flex-col items-center gap-1 p-2 focus:outline-none cursor-default w-full"
      style={{ userSelect: "none", touchAction: "pan-y", minHeight: 80 }}
    >
      <div className="relative">
        {typeof icon.emoji === "string" ? (
          <span
            className={`leading-none transition-opacity ${selected ? "opacity-75" : ""}`}
            style={{ fontSize: "calc(2.4rem * var(--t-font-scale))", filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.7))" }}
          >
            {icon.emoji}
          </span>
        ) : (
          <div
            className={`leading-none transition-opacity ${selected ? "opacity-75" : ""}`}
            style={{ filter: "drop-shadow(1px 2px 3px rgba(0,0,0,0.6))" }}
          >
            {icon.emoji}
          </div>
        )}
        {icon.hot && (
          <span
            className="absolute -top-2 -left-2 text-xs font-bold px-1 border border-black animate-hot-badge"
            style={{
              backgroundColor: "var(--t-hot-bg, #ff3300)",
              color: "var(--t-hot-text, #fff)",
              fontFamily: "var(--t-font-display)",
              transform: "rotate(-12deg)",
              transformOrigin: "center",
            }}
          >
            HOT
          </span>
        )}
        {icon.badge && (
          <span
            className="absolute -top-1 -right-3 text-xs font-bold px-1 border border-black"
            style={{
              backgroundColor: "var(--t-badge-bg)",
              color: "var(--t-badge-text)",
              fontFamily: "var(--t-font-display)",
            }}
          >
            {icon.badge}
          </span>
        )}
        {icon.locked && (
          <span
            className="absolute -bottom-1 -right-2 text-base leading-none"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
          >
            🔒
          </span>
        )}
      </div>
      <span
        className="block text-center leading-tight w-full break-words"
        style={{
          fontFamily: "var(--t-font-display)",
          fontSize: "var(--t-text-sm)",
          color: "white",
          textShadow: "1px 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)",
        }}
      >
        <span
          className="px-0.5"
          style={selected ? { backgroundColor: "rgba(0,80,180,0.7)", color: "white" } : {}}
        >
          {icon.label}
        </span>
      </span>
    </button>
  );
}

// ─── Desktop icon — draggable, double-tap to open ─────────────────────────────

interface DraggableDesktopIconProps {
  icon: IconDef;
  x: number;
  y: number;
  selected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onMove: (cell: GridCell) => void;
}

function DraggableDesktopIcon({
  icon,
  x,
  y,
  selected,
  onSelect,
  onMove,
}: DraggableDesktopIconProps) {
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const lastTapTime = useRef(0);
  const onOpenRef = useRef(icon.onOpen);
  onOpenRef.current = icon.onOpen;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      onSelect();
      dragging.current = true;
      dragOffset.current = { x: e.clientX - x, y: e.clientY - y };
      startPos.current = { x: e.clientX, y: e.clientY };
      setDragPos(null);

      const onPointerMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const dx = Math.abs(ev.clientX - startPos.current.x);
        const dy = Math.abs(ev.clientY - startPos.current.y);
        if (dx > 4 || dy > 4) {
          setDragPos({
            x: ev.clientX - dragOffset.current.x,
            y: ev.clientY - dragOffset.current.y,
          });
        }
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onUp);
        if (!dragging.current) return;
        dragging.current = false;

        const finalX = ev.clientX - dragOffset.current.x;
        const finalY = ev.clientY - dragOffset.current.y;
        const dx = Math.abs(ev.clientX - startPos.current.x);
        const dy = Math.abs(ev.clientY - startPos.current.y);

        setDragPos(null);

        if (dx > 4 || dy > 4) {
          const desktopEl = document.getElementById("os-desktop-area");
          const rect = desktopEl?.getBoundingClientRect();
          const relX = finalX - (rect?.left ?? 0);
          const relY = finalY - (rect?.top ?? 0);
          onMove(pixelToCell(relX, relY));
        } else {
          // Tap — check for double-tap
          const now = Date.now();
          if (now - lastTapTime.current < 300) {
            onOpenRef.current();
            lastTapTime.current = 0;
          } else {
            lastTapTime.current = now;
          }
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onUp);
    },
    [x, y, onSelect, onMove]
  );

  const currentX = dragPos?.x ?? x;
  const currentY = dragPos?.y ?? y;
  const isDragging = dragPos !== null;

  return (
    <button
      onPointerDown={handlePointerDown}
      className="group absolute flex flex-col items-center gap-1 p-1.5 focus:outline-none cursor-default"
      style={{
        left: currentX,
        top: currentY,
        width: CELL_W,
        zIndex: isDragging ? 1000 : 10,
        opacity: isDragging ? 0.85 : 1,
        transform: isDragging ? "scale(1.05)" : "scale(1)",
        transition: isDragging ? "none" : "left 0.12s ease, top 0.12s ease",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      <div className="relative">
        {typeof icon.emoji === "string" ? (
          <span
            className={`text-[2.8rem] leading-none transition-opacity ${selected ? "opacity-75" : ""}`}
            style={{
              filter:
                "drop-shadow(1px 1px 2px rgba(0,0,0,0.7)) drop-shadow(0 0 8px rgba(0,0,0,0.3))",
            }}
          >
            {icon.emoji}
          </span>
        ) : (
          <div
            className={`leading-none transition-opacity ${selected ? "opacity-75" : ""}`}
            style={{
              filter: "drop-shadow(1px 2px 3px rgba(0,0,0,0.6))",
            }}
          >
            {icon.emoji}
          </div>
        )}
        {icon.hot && (
          <span
            className="absolute -top-2 -left-2 text-xs font-bold px-1 border border-black animate-hot-badge"
            style={{
              backgroundColor: "var(--t-hot-bg, #ff3300)",
              color: "var(--t-hot-text, #fff)",
              fontFamily: "var(--t-font-display)",
              transform: "rotate(-12deg)",
              transformOrigin: "center",
            }}
          >
            HOT
          </span>
        )}
        {icon.badge && (
          <span
            className="absolute -top-1 -right-3 text-xs font-bold px-1 border border-black"
            style={{
              backgroundColor: "var(--t-badge-bg)",
              color: "var(--t-badge-text)",
              fontFamily: "var(--t-font-display)",
            }}
          >
            {icon.badge}
          </span>
        )}
        {icon.locked && (
          <span
            className="absolute -bottom-1 -right-2 text-base leading-none"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
          >
            🔒
          </span>
        )}
      </div>
      <span
        className="text-center leading-tight px-0.5 max-w-full break-words"
        style={{
          fontFamily: "var(--t-font-display)",
          fontSize: "var(--t-text-sm)",
          color: "white",
          textShadow:
            "1px 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8)",
        }}
      >
        <span
          className="px-0.5"
          style={
            selected
              ? { backgroundColor: "rgba(0,80,180,0.7)", color: "white" }
              : {}
          }
        >
          {icon.label}
        </span>
      </span>
    </button>
  );
}
