"use client";

import { useState, type CSSProperties } from "react";
import { useWindowActions } from "@/lib/contexts/window-manager-context";
import { useSettings } from "@/lib/contexts/settings-context";
import { SETTINGS_RAM_STATUSES, SETTINGS_LICENSES } from "@/lib/gunth-jokes";
import { pickRandom } from "@/lib/utils/random";
import { THEMES, type ThemeId } from "@/lib/themes";
import { CURSORS, type CursorId } from "@/lib/cursors";
import { WALLPAPERS, WALLPAPER_MAP, type WallpaperId } from "@/lib/wallpapers";
import { FONT_PAIRS, type FontPairId } from "@/lib/font-pairs";
import { SOUND_SCHEMES, type SoundSchemeId } from "@/lib/sound-schemes";
import { ICON_THEMES, type IconThemeId, type IconTheme } from "@/lib/icon-themes";
import { OsIcon } from "@/components/ui/os-icon";
import { useSoundContext } from "@/lib/contexts/sound-context";
import { RetroTitlebarBtn } from "@/components/ui/retro-titlebar-btn";
import { APP_REGISTRY } from "@/apps";
import { OS_VERSIONS } from "@/lib/os-versions";
import type { AppProps } from "@/types";

type Tab = "theme" | "wallpaper" | "display" | "icons" | "system" | "about";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "theme", label: "THÈME", icon: "🎨" },
  { id: "wallpaper", label: "FOND", icon: "🖼️" },
  { id: "display", label: "AFFICHAGE", icon: "🖥️" },
  { id: "icons", label: "ICÔNES", icon: "🗂️" },
  { id: "system", label: "SYSTÈME", icon: "⚙️" },
  { id: "about", label: "À PROPOS", icon: "ℹ️" },
];

export function SettingsApp({ windowId }: AppProps) {
  const { closeWindow } = useWindowActions();
  const onClose = () => closeWindow(windowId);
  const { settings, setTheme, setSoundEnabled, setAmbientVolume, setSoundScheme, setAnimationsEnabled, setScanlinesEnabled, setPixelizeEnabled, setPerformanceModeEnabled, setCursorId, setWallpaperId, resetWallpaperToTheme, setFontPairId, setFontSize, setIconTheme } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>("theme");

  return (
    <div>
      <div className="flex border-b-2 overflow-x-auto" style={{ borderBottomColor: "var(--t-border-dark)" }}>
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="px-3 py-2 tracking-widest border-r cursor-pointer shrink-0"
              style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: isActive ? "var(--t-accent)" : "var(--t-text-muted)", backgroundColor: isActive ? "var(--t-bg)" : "var(--t-bg-dark)", borderRightColor: "var(--t-border-dark)", borderBottom: isActive ? "2px solid var(--t-bg)" : "none", marginBottom: isActive ? "-2px" : "0" }}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {activeTab === "theme" && <ThemeTab themeId={settings.themeId} setTheme={setTheme} />}
        {activeTab === "wallpaper" && <WallpaperTab wallpaperId={settings.wallpaperId ?? "bliss"} wallpaperOverridden={settings.wallpaperOverridden} themeId={settings.themeId} setWallpaperId={setWallpaperId} resetWallpaperToTheme={resetWallpaperToTheme} />}
        {activeTab === "display" && <DisplayTab animationsEnabled={settings.animationsEnabled} scanlinesEnabled={settings.scanlinesEnabled} pixelizeEnabled={settings.pixelizeEnabled} cursorId={settings.cursorId} fontPairId={settings.fontPairId} fontSize={settings.fontSize} setAnimationsEnabled={setAnimationsEnabled} setScanlinesEnabled={setScanlinesEnabled} setPixelizeEnabled={setPixelizeEnabled} setCursorId={setCursorId} setFontPairId={setFontPairId} setFontSize={setFontSize} />}
        {activeTab === "icons" && <IconsTab iconThemeId={settings.iconThemeId} setIconTheme={setIconTheme} />}
        {activeTab === "system" && <SystemTab soundEnabled={settings.soundEnabled} setSoundEnabled={setSoundEnabled} ambientVolume={settings.ambientVolume} setAmbientVolume={setAmbientVolume} soundSchemeId={settings.soundSchemeId} setSoundScheme={setSoundScheme} performanceModeEnabled={settings.performanceModeEnabled} setPerformanceModeEnabled={setPerformanceModeEnabled} />}
        {activeTab === "about" && <AboutTab />}

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="px-6 py-1.5 border-[2px] tracking-wider cursor-pointer"
            style={{ backgroundColor: "var(--t-bg)", color: "var(--t-text)", fontFamily: "var(--t-font-display)", borderTopColor: "var(--t-border-light)", borderLeftColor: "var(--t-border-light)", borderBottomColor: "var(--t-border-dark)", borderRightColor: "var(--t-border-dark)" }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// Keep non-embedded export for backwards compatibility (used by site-shell overlay)
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, setTheme, setSoundEnabled, setAmbientVolume, setSoundScheme, setAnimationsEnabled, setScanlinesEnabled, setPixelizeEnabled, setPerformanceModeEnabled, setCursorId, setWallpaperId, resetWallpaperToTheme, setFontPairId, setFontSize, setIconTheme } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>("theme");

  const content = (
    <div>
      <div className="flex border-b-2 overflow-x-auto" style={{ borderBottomColor: "var(--t-border-dark)" }}>
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="px-3 py-2 tracking-widest border-r cursor-pointer shrink-0"
              style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: isActive ? "var(--t-accent)" : "var(--t-text-muted)", backgroundColor: isActive ? "var(--t-bg)" : "var(--t-bg-dark)", borderRightColor: "var(--t-border-dark)", borderBottom: isActive ? "2px solid var(--t-bg)" : "none", marginBottom: isActive ? "-2px" : "0" }}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {activeTab === "theme" && <ThemeTab themeId={settings.themeId} setTheme={setTheme} />}
        {activeTab === "wallpaper" && <WallpaperTab wallpaperId={settings.wallpaperId ?? "bliss"} wallpaperOverridden={settings.wallpaperOverridden} themeId={settings.themeId} setWallpaperId={setWallpaperId} resetWallpaperToTheme={resetWallpaperToTheme} />}
        {activeTab === "display" && <DisplayTab animationsEnabled={settings.animationsEnabled} scanlinesEnabled={settings.scanlinesEnabled} pixelizeEnabled={settings.pixelizeEnabled} cursorId={settings.cursorId} fontPairId={settings.fontPairId} fontSize={settings.fontSize} setAnimationsEnabled={setAnimationsEnabled} setScanlinesEnabled={setScanlinesEnabled} setPixelizeEnabled={setPixelizeEnabled} setCursorId={setCursorId} setFontPairId={setFontPairId} setFontSize={setFontSize} />}
        {activeTab === "icons" && <IconsTab iconThemeId={settings.iconThemeId} setIconTheme={setIconTheme} />}
        {activeTab === "system" && <SystemTab soundEnabled={settings.soundEnabled} setSoundEnabled={setSoundEnabled} ambientVolume={settings.ambientVolume} setAmbientVolume={setAmbientVolume} soundSchemeId={settings.soundSchemeId} setSoundScheme={setSoundScheme} performanceModeEnabled={settings.performanceModeEnabled} setPerformanceModeEnabled={setPerformanceModeEnabled} />}
        {activeTab === "about" && <AboutTab />}
        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="px-6 py-1.5 border-[2px] tracking-wider cursor-pointer" style={{ backgroundColor: "var(--t-bg)", color: "var(--t-text)", fontFamily: "var(--t-font-display)", borderTopColor: "var(--t-border-light)", borderLeftColor: "var(--t-border-light)", borderBottomColor: "var(--t-border-dark)", borderRightColor: "var(--t-border-dark)" }}>OK</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg border-[3px] shadow-[8px_8px_0_rgba(0,0,0,0.5)] animate-[fadeIn_0.2s_ease]" style={{ backgroundColor: "var(--t-bg)", borderTopColor: "var(--t-border-light)", borderLeftColor: "var(--t-border-light)", borderRightColor: "var(--t-border-dark)", borderBottomColor: "var(--t-border-dark)" }}>
        <div className="px-[10px] py-[6px] flex justify-between items-center border-b-2 border-black tracking-wider select-none" style={{ fontSize: "var(--t-text-base)", background: "linear-gradient(to right, var(--t-titlebar-from), var(--t-titlebar-to))", color: "var(--t-titlebar-text)", fontFamily: "var(--t-font-display)" }}>
          <span>⚙️ Paramètres GunthOS</span>
          <RetroTitlebarBtn onClick={onClose}>✕</RetroTitlebarBtn>
        </div>
        {content}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="tracking-widest mb-3 pb-1 border-b" style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)", fontFamily: "var(--t-font-display)", borderBottomColor: "var(--t-border-dark)" }}>
      {children}
    </div>
  );
}

function RetroToggle({ value, onChange, label, description }: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="tracking-wider" style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text)", fontFamily: "var(--t-font-display)" }}>{label}</div>
        {description && <div style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text-subtle)", fontFamily: "var(--t-font-body)" }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!value)} className="flex items-center gap-1.5 px-3 py-1 border-[2px] tracking-wider cursor-pointer shrink-0"
        style={{ fontSize: "var(--t-text-sm)", backgroundColor: value ? "var(--t-accent)" : "var(--t-bg-dark)", color: value ? "var(--t-bg)" : "var(--t-text-muted)", fontFamily: "var(--t-font-display)", borderTopColor: value ? "var(--t-border-dark)" : "var(--t-border-light)", borderLeftColor: value ? "var(--t-border-dark)" : "var(--t-border-light)", borderBottomColor: value ? "var(--t-border-light)" : "var(--t-border-dark)", borderRightColor: value ? "var(--t-border-light)" : "var(--t-border-dark)" }}
      >
        {value ? "✓ ON" : "✗ OFF"}
      </button>
    </div>
  );
}

function ThemeTab({ themeId, setTheme }: { themeId: ThemeId; setTheme: (id: ThemeId) => void }) {
  return (
    <>
      <SectionTitle>🎨 THÈME VISUEL</SectionTitle>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {THEMES.map((theme) => {
          const isActive = theme.id === themeId;
          const p = theme.preview;
          return (
            <button key={theme.id} onClick={() => setTheme(theme.id as ThemeId)} className="p-0 border-[2px] text-left cursor-pointer overflow-hidden flex flex-col"
              style={{ backgroundColor: p.bg, borderTopColor: isActive ? p.accent : p.titlebarFrom, borderLeftColor: isActive ? p.accent : p.titlebarFrom, borderBottomColor: isActive ? p.accent : "rgba(0,0,0,0.4)", borderRightColor: isActive ? p.accent : "rgba(0,0,0,0.4)", outline: isActive ? `2px solid ${p.accent}` : "none", outlineOffset: "1px" }}
            >
              <div className="w-full px-1.5 py-0.5 flex items-center gap-1 text-xs shrink-0" style={{ background: `linear-gradient(90deg, ${p.titlebarFrom}, ${p.titlebarTo})`, color: p.titlebarText, fontFamily: "monospace", fontSize: "10px" }}>
                <span>{theme.emoji}</span>
                <span className="truncate">{theme.name}</span>
                {isActive && <span className="ml-auto">✓</span>}
              </div>
              <div className="flex-1 p-1.5 flex flex-col gap-1" style={{ backgroundColor: p.bg }}>
                <div className="h-1 rounded-sm w-3/4" style={{ backgroundColor: p.accent, opacity: 0.7 }} />
                <div className="h-1 rounded-sm w-1/2" style={{ backgroundColor: p.text, opacity: 0.3 }} />
                <div className="h-1 rounded-sm w-2/3" style={{ backgroundColor: p.text, opacity: 0.2 }} />
              </div>
              <div className="px-1.5 pb-1.5 pt-0.5" style={{ backgroundColor: p.bg }}>
                <div className="text-xs font-bold tracking-wider truncate" style={{ color: p.accent, fontFamily: "monospace" }}>{theme.name.toUpperCase()}</div>
                <div className="text-xs truncate opacity-70" style={{ color: p.text, fontFamily: "monospace", fontSize: "9px" }}>{theme.description}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="p-3 border-[2px]" style={{ backgroundColor: "var(--t-inset-from)", borderTopColor: "var(--t-border-dark)", borderLeftColor: "var(--t-border-dark)", borderBottomColor: "var(--t-border-light)", borderRightColor: "var(--t-border-light)" }}>
        <div className="tracking-widest mb-2" style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text-subtle)", fontFamily: "var(--t-font-display)" }}>PALETTE ACTIVE</div>
        <div className="flex gap-1 flex-wrap">
          {["--t-bg", "--t-accent", "--t-titlebar-from", "--t-titlebar-to", "--t-marquee-text", "--t-card-hover-border", "--t-defrag-used", "--t-defrag-mystery"].map((v) => (
            <div key={v} className="w-6 h-6 border border-black/30" style={{ backgroundColor: `var(${v})` }} title={v.replace("--t-", "")} />
          ))}
        </div>
      </div>
    </>
  );
}

function DisplayTab({ animationsEnabled, scanlinesEnabled, pixelizeEnabled, cursorId, fontPairId, fontSize, setAnimationsEnabled, setScanlinesEnabled, setPixelizeEnabled, setCursorId, setFontPairId, setFontSize }: {
  animationsEnabled: boolean; scanlinesEnabled: boolean; pixelizeEnabled: boolean; cursorId: CursorId; fontPairId: FontPairId; fontSize: number;
  setAnimationsEnabled: (v: boolean) => void; setScanlinesEnabled: (v: boolean) => void; setPixelizeEnabled: (v: boolean) => void; setCursorId: (v: CursorId) => void; setFontPairId: (v: FontPairId) => void; setFontSize: (v: number) => void;
}) {
  return (
    <>
      <SectionTitle>🔤 TYPOGRAPHIE</SectionTitle>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {FONT_PAIRS.map((pair) => {
          const isActive = pair.id === fontPairId;
          return (
            <button key={pair.id} onClick={() => setFontPairId(pair.id)} className="flex flex-col gap-1 p-2.5 border-[2px] text-left cursor-pointer"
              style={{ backgroundColor: isActive ? "var(--t-card-hover)" : "var(--t-bg-dark)", borderTopColor: isActive ? "var(--t-border-dark)" : "var(--t-border-light)", borderLeftColor: isActive ? "var(--t-border-dark)" : "var(--t-border-light)", borderBottomColor: isActive ? "var(--t-border-light)" : "var(--t-border-dark)", borderRightColor: isActive ? "var(--t-border-light)" : "var(--t-border-dark)" }}
            >
              <div className="leading-tight" style={{ fontSize: "var(--t-text-xl)", fontFamily: pair.displayVar, color: isActive ? "var(--t-accent)" : "var(--t-text)" }}>
                {isActive ? "✓ " : ""}{pair.sample}
              </div>
              <div className="tracking-widest" style={{ fontSize: "var(--t-text-xs)", fontFamily: "var(--t-font-display)", color: isActive ? "var(--t-accent)" : "var(--t-text-muted)" }}>
                {pair.emoji} {pair.name.toUpperCase()}
              </div>
              <div style={{ fontSize: "var(--t-text-xs)", fontFamily: pair.bodyVar, color: "var(--t-text-subtle)" }}>
                {pair.description}
              </div>
            </button>
          );
        })}
      </div>
      <SectionTitle>🔡 TAILLE DU TEXTE</SectionTitle>
      <div className="flex items-center gap-3 mb-6 py-2">
        <span style={{ fontSize: "var(--t-text-xs)", fontFamily: "var(--t-font-display)", color: "var(--t-text-subtle)", minWidth: 20 }}>A</span>
        <input
          type="range" min={85} max={130} step={5} value={Math.round(fontSize * 100)}
          onChange={(e) => setFontSize(Number(e.target.value) / 100)}
          className="flex-1 cursor-pointer"
          style={{ accentColor: "var(--t-accent)" }}
        />
        <span style={{ fontSize: "var(--t-text-lg)", fontFamily: "var(--t-font-display)", color: "var(--t-text-subtle)", minWidth: 20 }}>A</span>
        <span className="tabular-nums w-10 text-right" style={{ fontSize: "var(--t-text-xs)", fontFamily: "var(--t-font-display)", color: "var(--t-text-muted)" }}>{Math.round(fontSize * 100)}%</span>
        {fontSize !== 1 && (
          <button onClick={() => setFontSize(1)} className="px-2 py-0.5 border-[2px] cursor-pointer"
            style={{ fontSize: "var(--t-text-xs)", fontFamily: "var(--t-font-display)", color: "var(--t-accent)", backgroundColor: "var(--t-bg)", borderTopColor: "var(--t-border-light)", borderLeftColor: "var(--t-border-light)", borderBottomColor: "var(--t-border-dark)", borderRightColor: "var(--t-border-dark)" }}
          >↺</button>
        )}
      </div>
      <SectionTitle>✨ ANIMATIONS</SectionTitle>
      <RetroToggle value={animationsEnabled} onChange={setAnimationsEnabled} label="Animations du système" description="Transitions, effets visuels, ouverture de fenêtres" />
      <SectionTitle>📺 EFFETS CRT</SectionTitle>
      <RetroToggle value={scanlinesEnabled} onChange={setScanlinesEnabled} label="Scanlines CRT" description="Lignes de balayage rétro" />
      <RetroToggle value={pixelizeEnabled} onChange={setPixelizeEnabled} label="Mode pixelisé" description="Grille de pixels par-dessus l'écran" />
      <SectionTitle>🖱️ CURSEUR SOURIS</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {CURSORS.map((c) => {
          const isActive = c.id === cursorId;
          return (
            <button key={c.id} onClick={() => setCursorId(c.id as CursorId)} className="flex flex-col items-center gap-1 py-2 px-1 border-[2px] text-center cursor-pointer"
              style={{ backgroundColor: isActive ? "var(--t-card-hover)" : "var(--t-bg-dark)", color: isActive ? "var(--t-accent)" : "var(--t-text-muted)", fontFamily: "var(--t-font-display)", borderTopColor: isActive ? "var(--t-border-dark)" : "var(--t-border-light)", borderLeftColor: isActive ? "var(--t-border-dark)" : "var(--t-border-light)", borderBottomColor: isActive ? "var(--t-border-light)" : "var(--t-border-dark)", borderRightColor: isActive ? "var(--t-border-light)" : "var(--t-border-dark)" }}
            >
              <span style={{ fontSize: "20px", lineHeight: 1 }}>{c.emoji}</span>
              <span className="tracking-wider" style={{ fontSize: "var(--t-text-xs)" }}>{isActive ? "✓ " : ""}{c.label}</span>
              <span style={{ color: "var(--t-text-subtle)", fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", textAlign: "center" }}>{c.description}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function WallpaperTab({ wallpaperId, wallpaperOverridden, themeId, setWallpaperId, resetWallpaperToTheme }: {
  wallpaperId: WallpaperId; wallpaperOverridden: boolean; themeId: ThemeId;
  setWallpaperId: (id: WallpaperId) => void; resetWallpaperToTheme: () => void;
}) {
  const active = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0]!;
  const currentTheme = THEMES.find((t) => t.id === themeId);
  const themeDefaultWallpaper = currentTheme?.defaultWallpaperId ? WALLPAPER_MAP.get(currentTheme.defaultWallpaperId) : undefined;

  return (
    <>
      <SectionTitle>🖼️ FOND D&apos;ÉCRAN</SectionTitle>
      {themeDefaultWallpaper && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 border-[2px]"
          style={{ backgroundColor: wallpaperOverridden ? "var(--t-bg-dark)" : "var(--t-card-hover)", borderTopColor: wallpaperOverridden ? "var(--t-border-dark)" : "var(--t-accent)", borderLeftColor: wallpaperOverridden ? "var(--t-border-dark)" : "var(--t-accent)", borderBottomColor: "var(--t-border-dark)", borderRightColor: "var(--t-border-dark)" }}
        >
          <div>
            <div className="tracking-widest" style={{ fontSize: "var(--t-text-xs)", color: wallpaperOverridden ? "var(--t-text-subtle)" : "var(--t-accent)", fontFamily: "var(--t-font-display)" }}>
              {wallpaperOverridden ? "🔓 FOND PERSONNALISÉ" : `🔗 LIÉ AU THÈME ${currentTheme?.emoji ?? ""}`}
            </div>
            <div className="mt-0.5" style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", fontFamily: "var(--t-font-body)" }}>
              {wallpaperOverridden ? `Défaut du thème : ${themeDefaultWallpaper.emoji} ${themeDefaultWallpaper.name}` : `Appliqué automatiquement avec ce thème`}
            </div>
          </div>
          {wallpaperOverridden && (
            <button onClick={resetWallpaperToTheme} className="shrink-0 px-2 py-1 border-[2px] tracking-wider cursor-pointer"
              style={{ fontSize: "var(--t-text-xs)", fontFamily: "var(--t-font-display)", backgroundColor: "var(--t-bg)", color: "var(--t-accent)", borderTopColor: "var(--t-border-light)", borderLeftColor: "var(--t-border-light)", borderBottomColor: "var(--t-border-dark)", borderRightColor: "var(--t-border-dark)" }}
            >🔗 RELIER</button>
          )}
        </div>
      )}
      <div className="w-full mb-4 border-[2px] relative overflow-hidden"
        style={{ height: 90, ...(active.style as CSSProperties), borderTopColor: "var(--t-border-dark)", borderLeftColor: "var(--t-border-dark)", borderBottomColor: "var(--t-border-light)", borderRightColor: "var(--t-border-light)" }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 2, pointerEvents: "none" }}>
          <span style={{ fontSize: 28 }}>{active.emoji}</span>
          <span style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: "white", textShadow: "1px 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8)", marginTop: 4, letterSpacing: "0.1em" }}>{active.name}</span>
          {active.animated && <span style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "rgba(255,255,255,0.7)", marginTop: 2 }}>✨ Animé</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
        {WALLPAPERS.map((w) => {
          const isActive = w.id === wallpaperId;
          return (
            <button key={w.id} onClick={() => setWallpaperId(w.id)} className="relative border-[2px] text-left overflow-hidden flex flex-col cursor-pointer"
              style={{ height: 72, ...(w.style as CSSProperties), borderTopColor: isActive ? "var(--t-accent)" : "var(--t-border-dark)", borderLeftColor: isActive ? "var(--t-accent)" : "var(--t-border-dark)", borderBottomColor: isActive ? "var(--t-accent)" : "var(--t-border-light)", borderRightColor: isActive ? "var(--t-accent)" : "var(--t-border-light)", outline: isActive ? "2px solid var(--t-accent)" : "none", outlineOffset: "1px" }}
            >
              <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.15)", zIndex: 0 }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 1 }}>
                <span style={{ fontSize: 20 }}>{w.emoji}</span>
                <span style={{ fontFamily: "monospace", fontSize: 9, color: "white", textShadow: "1px 1px 2px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,0.9)", textAlign: "center", padding: "0 4px", lineHeight: 1.2, marginTop: 2 }}>{w.name}</span>
                {w.animated && <span style={{ fontSize: 7, color: "rgba(255,255,200,0.9)", textShadow: "1px 1px 2px rgba(0,0,0,1)" }}>✨</span>}
              </div>
              {isActive && <div className="absolute top-1 right-1" style={{ backgroundColor: "var(--t-accent)", color: "var(--t-bg)", fontSize: 8, padding: "1px 3px", fontFamily: "monospace", fontWeight: "bold", zIndex: 2 }}>✓</div>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 p-2 border-[2px]" style={{ backgroundColor: "var(--t-inset-from)", borderTopColor: "var(--t-border-dark)", borderLeftColor: "var(--t-border-dark)", borderBottomColor: "var(--t-border-light)", borderRightColor: "var(--t-border-light)" }}>
        <div className="tracking-widest" style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-subtle)", fontFamily: "var(--t-font-display)" }}>
          {active.emoji} {active.name.toUpperCase()} — {active.description}
        </div>
      </div>
    </>
  );
}

function SystemTab({ soundEnabled, setSoundEnabled, ambientVolume, setAmbientVolume, soundSchemeId, setSoundScheme, performanceModeEnabled, setPerformanceModeEnabled }: {
  soundEnabled: boolean; setSoundEnabled: (v: boolean) => void;
  ambientVolume: number; setAmbientVolume: (v: number) => void;
  soundSchemeId: SoundSchemeId; setSoundScheme: (v: SoundSchemeId) => void;
  performanceModeEnabled: boolean; setPerformanceModeEnabled: (v: boolean) => void;
}) {
  const volumePct = Math.round(ambientVolume * 100);
  const [ramStatus] = useState(() => pickRandom(SETTINGS_RAM_STATUSES));
  const [licenseStatus] = useState(() => pickRandom(SETTINGS_LICENSES));
  const { playNotifyInfo, playNotifySuccess, playClick, playWindowOpen } = useSoundContext();

  const previewScheme = (id: SoundSchemeId) => {
    if (id === soundSchemeId) { playNotifySuccess(); return; }
    setSoundScheme(id);
    setTimeout(playNotifyInfo, 80);
  };

  return (
    <>
      <SectionTitle>⚡ PERFORMANCES</SectionTitle>
      <RetroToggle value={performanceModeEnabled} onChange={setPerformanceModeEnabled} label="Mode performance" description="Overclocking du processus avec bypass quantique" />
      <SectionTitle>🔊 SONS SYSTÈME</SectionTitle>
      <RetroToggle value={soundEnabled} onChange={setSoundEnabled} label="Sons GunthOS" description="Bips, pops et effets sonores du système" />
      <div className="flex items-center justify-between py-2 gap-4">
        <div>
          <div className="text-sm tracking-wider" style={{ color: "var(--t-text)", fontFamily: "var(--t-font-display)" }}>🖥️ Bruit ambiant machine</div>
          <div className="text-sm" style={{ color: "var(--t-text-subtle)", fontFamily: "var(--t-font-body)" }}>Ventilateur + bourdonnement électronique</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input type="range" min={0} max={100} value={volumePct} disabled={!soundEnabled} onChange={(e) => setAmbientVolume(Number(e.target.value) / 100)} className="w-24 cursor-pointer" style={{ accentColor: "var(--t-accent)", opacity: soundEnabled ? 1 : 0.4 }} />
          <span className="text-sm w-8 text-right tabular-nums" style={{ color: "var(--t-text-muted)", fontFamily: "var(--t-font-display)" }}>{volumePct}%</span>
        </div>
      </div>
      <SectionTitle>🎵 THÈME SONORE</SectionTitle>
      <div className="grid grid-cols-1 gap-1.5 mb-4" style={{ opacity: soundEnabled ? 1 : 0.4, pointerEvents: soundEnabled ? "auto" : "none" }}>
        {SOUND_SCHEMES.map((scheme) => {
          const isActive = scheme.id === soundSchemeId;
          return (
            <button
              key={scheme.id}
              onClick={() => previewScheme(scheme.id)}
              className="flex items-center gap-3 px-3 py-2 border-[2px] text-left cursor-pointer w-full"
              style={{
                backgroundColor: isActive ? "var(--t-card-hover)" : "var(--t-bg-dark)",
                borderTopColor: isActive ? "var(--t-border-dark)" : "var(--t-border-light)",
                borderLeftColor: isActive ? "var(--t-border-dark)" : "var(--t-border-light)",
                borderBottomColor: isActive ? "var(--t-border-light)" : "var(--t-border-dark)",
                borderRightColor: isActive ? "var(--t-border-light)" : "var(--t-border-dark)",
              }}
              onMouseEnter={() => { if (!isActive) playClick(); }}
              onFocus={() => { if (!isActive) playWindowOpen(); }}
            >
              <div className="flex-1">
                <div className="tracking-wider" style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: isActive ? "var(--t-accent)" : "var(--t-text)" }}>
                  {isActive ? "✓ " : ""}{scheme.label.toUpperCase()}
                </div>
                <div style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-subtle)", marginTop: 2 }}>
                  {scheme.description}
                </div>
              </div>
              {isActive && (
                <div style={{ fontSize: "var(--t-text-xs)", color: "var(--t-accent)", fontFamily: "var(--t-font-display)" }}>▶</div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4 p-3 border-[2px]" style={{ backgroundColor: "var(--t-inset-from)", borderTopColor: "var(--t-border-dark)", borderLeftColor: "var(--t-border-dark)", borderBottomColor: "var(--t-border-light)", borderRightColor: "var(--t-border-light)" }}>
        <div className="text-sm tracking-widest mb-1" style={{ color: "var(--t-text-subtle)", fontFamily: "var(--t-font-display)" }}>ℹ️ INFO SYSTÈME</div>
        <div className="text-sm space-y-0.5" style={{ color: "var(--t-text-muted)", fontFamily: "var(--t-font-display)" }}>
          <div>GunthOS v1.0 — Build 19981225</div>
          <div>{ramStatus}</div>
          <div>{licenseStatus}</div>
        </div>
      </div>
    </>
  );
}

const ICON_PREVIEW_SLUGS = ["settings", "radio", "msn", "solitaire", "trash", "notepad"];

function IconThemePreview({ theme, size = 24 }: { theme: IconTheme; size?: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {ICON_PREVIEW_SLUGS.map((slug) => (
        <OsIcon key={slug} slug={slug} size={size} theme={theme} />
      ))}
    </div>
  );
}

function IconsTab({ iconThemeId, setIconTheme }: { iconThemeId: IconThemeId; setIconTheme: (id: IconThemeId) => void }) {
  const STYLE_LABELS: Record<string, string> = {
    "colored-bg": "Fond coloré par app",
    "win98": "Boîte Win98 en relief",
    "plain": "Icône seule (plat)",
    "neon": "Fond noir, lueur colorée",
    "crt": "Phosphore vert monochrome",
    "pixel": "Style jeu vidéo 16-bit",
    "flat": "SVG sans fond",
    "pastel": "Tons doux, fond pastel",
    "glass": "Glassmorphisme, flou & reflets",
    "synthwave": "Rétro-futuriste années 80",
    "aqua": "Bulle brillante style macOS/XP",
    "gameboy": "Monochrome LCD olive Game Boy",
    "blueprint": "Plan technique bleu cobalt",
    "candy": "Dégradé radial acidulé",
    "vintage": "Papier sépia vieux document",
  };

  const activeTheme = ICON_THEMES.find((t) => t.id === iconThemeId);

  return (
    <>
      <SectionTitle>🗂️ THÈME D&apos;ICÔNES</SectionTitle>

      {activeTheme && (
        <div className="mb-4 p-3 border-[2px]" style={{ backgroundColor: "var(--t-inset-from)", borderTopColor: "var(--t-border-dark)", borderLeftColor: "var(--t-border-dark)", borderBottomColor: "var(--t-border-light)", borderRightColor: "var(--t-border-light)" }}>
          <div className="tracking-widest mb-2" style={{ fontSize: "var(--t-text-xs)", color: "var(--t-accent)", fontFamily: "var(--t-font-display)" }}>
            ✓ {activeTheme.displayName.toUpperCase()} — APERÇU
          </div>
          <IconThemePreview theme={activeTheme} size={32} />
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-h-[340px] overflow-y-auto pr-1">
        {ICON_THEMES.map((theme) => {
          const isActive = theme.id === iconThemeId;
          return (
            <button
              key={theme.id}
              onClick={() => setIconTheme(theme.id)}
              className="flex items-center gap-3 p-2.5 border-[2px] text-left cursor-pointer w-full"
              style={{
                backgroundColor: isActive ? "var(--t-card-hover)" : "var(--t-bg)",
                borderTopColor: isActive ? "var(--t-border-dark)" : "var(--t-border-light)",
                borderLeftColor: isActive ? "var(--t-border-dark)" : "var(--t-border-light)",
                borderBottomColor: isActive ? "var(--t-border-light)" : "var(--t-border-dark)",
                borderRightColor: isActive ? "var(--t-border-light)" : "var(--t-border-dark)",
                outline: isActive ? "2px solid var(--t-accent)" : "none",
                outlineOffset: "1px",
              }}
            >
              <div className="shrink-0">
                <IconThemePreview theme={theme} size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="tracking-wider flex items-center gap-1.5" style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: isActive ? "var(--t-accent)" : "var(--t-text)" }}>
                  {isActive && <span>✓</span>}
                  {theme.displayName}
                  <span style={{ color: "var(--t-text-muted)", fontWeight: "normal" }}>— {STYLE_LABELS[theme.style] ?? theme.style}</span>
                </div>
                <div style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-subtle)", marginTop: 1 }}>
                  {theme.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function AboutTab() {
  const releases = OS_VERSIONS;
  const latest = releases[0];
  const appCount = APP_REGISTRY.length;
  const versionedCount = APP_REGISTRY.filter((a) => a.version).length;

  return (
    <>
      <SectionTitle>🖥️ GUNTHOS</SectionTitle>
      <div
        className="p-3 mb-4 border-[2px]"
        style={{ backgroundColor: "var(--t-inset-from)", borderTopColor: "var(--t-border-dark)", borderLeftColor: "var(--t-border-dark)", borderBottomColor: "var(--t-border-light)", borderRightColor: "var(--t-border-light)" }}
      >
        <div className="flex items-center gap-3 mb-2">
          <span style={{ fontSize: 32, lineHeight: 1 }}>💾</span>
          <div>
            <div style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-md)", color: "var(--t-accent)" }}>
              GunthOS™
            </div>
            <div style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
              {latest ? `Version ${latest.version}` : "Version inconnue"}
            </div>
          </div>
        </div>
        <div className="space-y-0.5" style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: "var(--t-text-subtle)" }}>
          <div>Build: Next.js 15 + SQLite + better-auth</div>
          <div>Apps installées: {appCount} ({versionedCount} versionnées)</div>
          {latest && <div>Dernière mise à jour: {new Date(latest.releasedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>}
        </div>
      </div>

      <SectionTitle>📋 HISTORIQUE DES VERSIONS</SectionTitle>
      <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
        {releases.map((r) => (
          <div
            key={r.version}
            className="p-2.5 border-[2px]"
            style={{ backgroundColor: "var(--t-bg-dark)", borderTopColor: "var(--t-border-light)", borderLeftColor: "var(--t-border-light)", borderBottomColor: "var(--t-border-dark)", borderRightColor: "var(--t-border-dark)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-sm)", color: "var(--t-accent)" }}>
                v{r.version}
              </span>
              <span style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                {new Date(r.releasedAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {r.changelog && (
              <div style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-subtle)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {r.changelog}
              </div>
            )}
          </div>
        ))}
      </div>

      <SectionTitle>📦 APPS INSTALLÉES</SectionTitle>
      <div
        className="grid grid-cols-2 gap-1 max-h-[180px] overflow-y-auto pr-1"
      >
        {APP_REGISTRY.filter((a) => a.version).map((app) => (
          <div
            key={app.slug}
            className="flex items-center gap-2 px-2 py-1 border-[2px]"
            style={{ backgroundColor: "var(--t-bg-dark)", borderTopColor: "var(--t-border-light)", borderLeftColor: "var(--t-border-light)", borderBottomColor: "var(--t-border-dark)", borderRightColor: "var(--t-border-dark)" }}
          >
            <span style={{ fontSize: 14 }}>{app.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="truncate" style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: "var(--t-text)" }}>{app.name}</div>
            </div>
            <span style={{ fontFamily: "var(--t-font-display)", fontSize: "10px", color: "var(--t-text-muted)", flexShrink: 0 }}>v{app.version}</span>
          </div>
        ))}
      </div>
    </>
  );
}
