// ─── Peagle 98 — Registre d'assets (galerie) ─────────────────────────────────
// Source unique des variantes visuelles, et de la sélection active (persistée).
//
// POINT D'EXTENSION : pour proposer un nouvel asset dans la Galerie, ajoute une
// variante dans le tableau de sa catégorie ci-dessous. La Galerie l'affiche et
// le jeu l'applique automatiquement.

import type { PegTheme, BgTheme } from "./game-theme";

export interface AssetVariant<T> {
  id: string;
  name: string;
  value: T;
}

export interface BgVariant {
  bg: BgTheme;
  flash: { normal: string; fever: string };
}

export interface BirdSprite {
  grid: readonly string[];
  palette: Record<string, string>;
}

export interface BucketStyle {
  egg: string;
  eggHi: string;
  nestDark: string;
  nestMid: string;
  nestLight: string;
  nestRim: string;
}

export interface BallStyle {
  body: string;    // corps de l'œuf lancé
  glow: string;    // halo
  speckle: string; // mouchetures (rgba)
}

// ─── Palettes de pegs ──────────────────────────────────────────────────────────

export const PEG_PALETTES: AssetVariant<PegTheme>[] = [
  {
    id: "foret", name: "Forêt",
    value: {
      normal: "#2233aa", normalHi: "#4455ff", normalDark: "#000d44",
      orange: "#ff5500", orangeHi: "#ffdd44", orangeDark: "#882200",
      orangeFever: "#ff00cc", orangeGlow: "#ff88ee",
      popRing: { normal: "#4455ff", orange: "#ffaa00" },
    },
  },
  {
    id: "abime", name: "Abîme",
    value: {
      normal: "#1144cc", normalHi: "#4488ff", normalDark: "#00082a",
      orange: "#ff7700", orangeHi: "#ffcc44", orangeDark: "#883300",
      orangeFever: "#ff00ff", orangeGlow: "#ff88ff",
      popRing: { normal: "#4488ff", orange: "#ffaa00" },
    },
  },
  {
    id: "enfer", name: "Enfer",
    value: {
      normal: "#882200", normalHi: "#dd4400", normalDark: "#330800",
      orange: "#ff8800", orangeHi: "#ffcc00", orangeDark: "#884400",
      orangeFever: "#ff0000", orangeGlow: "#ff6600",
      popRing: { normal: "#dd4400", orange: "#ffcc00" },
    },
  },
  {
    id: "glace", name: "Glace",
    value: {
      normal: "#224488", normalHi: "#88aaff", normalDark: "#001133",
      orange: "#ee6622", orangeHi: "#ffcc88", orangeDark: "#883311",
      orangeFever: "#00ccff", orangeGlow: "#88eeff",
      popRing: { normal: "#88aaff", orange: "#ffcc88" },
    },
  },
];

// ─── Arrière-plans / ambiances ──────────────────────────────────────────────────

export const BACKGROUNDS: AssetVariant<BgVariant>[] = [
  {
    id: "foret", name: "Forêt",
    value: {
      bg: {
        skyTop: [58, 110, 140], skyBot: [106, 170, 68],
        skyTopFever: [8, 4, 28], skyBotFever: [18, 10, 52],
        groundColor: "#3a8c28", groundColorFever: "#0a0a28",
        subGroundColor: "#1e6016", subGroundColorFever: "#050514",
        mistColor: "rgba(180,240,160,0.07)", mistColorFever: "rgba(100,80,200,0.06)",
        mistFarColor: "rgba(180,240,160,0.04)", mistFarColorFever: "rgba(80,60,180,0.04)",
        hasTrees: true, hasFireflies: true,
      },
      flash: { normal: "#4455ff", fever: "#ff00cc" },
    },
  },
  {
    id: "abime", name: "Abîme",
    value: {
      bg: {
        skyTop: [2, 0, 10], skyBot: [6, 0, 18],
        skyTopFever: [6, 0, 18], skyBotFever: [12, 4, 36],
        groundColor: "#04000c", groundColorFever: "#080018",
        subGroundColor: "#020008", subGroundColorFever: "#04000e",
        mistColor: "rgba(80,0,180,0.08)", mistColorFever: "rgba(180,0,255,0.10)",
        mistFarColor: "rgba(60,0,150,0.05)", mistFarColorFever: "rgba(140,0,200,0.07)",
        hasTrees: false, hasFireflies: false,
      },
      flash: { normal: "#4488ff", fever: "#ff00ff" },
    },
  },
  {
    id: "enfer", name: "Enfer",
    value: {
      bg: {
        skyTop: [38, 6, 2], skyBot: [74, 18, 4],
        skyTopFever: [60, 4, 2], skyBotFever: [100, 10, 4],
        groundColor: "#3d1208", groundColorFever: "#220600",
        subGroundColor: "#1a0602", subGroundColorFever: "#0e0200",
        mistColor: "rgba(200,60,0,0.08)", mistColorFever: "rgba(255,40,0,0.12)",
        mistFarColor: "rgba(180,40,0,0.05)", mistFarColorFever: "rgba(220,20,0,0.08)",
        hasTrees: false, hasFireflies: false,
      },
      flash: { normal: "#ff4400", fever: "#ff0000" },
    },
  },
  {
    id: "glace", name: "Glace",
    value: {
      bg: {
        skyTop: [140, 180, 210], skyBot: [200, 225, 240],
        skyTopFever: [60, 100, 160], skyBotFever: [100, 150, 200],
        groundColor: "#b0d8ee", groundColorFever: "#5077aa",
        subGroundColor: "#80b8d8", subGroundColorFever: "#304466",
        mistColor: "rgba(200,235,255,0.12)", mistColorFever: "rgba(100,150,220,0.12)",
        mistFarColor: "rgba(180,220,255,0.08)", mistFarColorFever: "rgba(80,120,200,0.08)",
        hasTrees: false, hasFireflies: false,
      },
      flash: { normal: "#44ccff", fever: "#00eeff" },
    },
  },
];

// ─── Sprites d'oiseau (le lanceur) ───────────────────────────────────────────────
// Grilles dessinées tête en haut. '.' = vide, autres lettres = clé de palette.

export const BIRD_SPRITES: AssetVariant<BirdSprite>[] = [
  { id: "pelican_1", name: "Pélican", value: {
    grid: ["...y.y...", "...www...", "..wywyw..", "..wwwyy.", ".wbbbbbb.", "wwbbbbbww", ".wbbbbbw.", "...wbbw...", "...www..."],
    palette: { w: "#f0ece0", b: "#d4c4a0", y: "#f5c542" },
  } },
  { id: "pelican_2", name: "Pélican tropical", value: {
    grid: ["...y.y...", "...www...", "..wywyw..", "...wbbw..", ".wbbbbwa.", "wwbbbbwa.", "..wbbbba.", "...wbbww.", "....www.."],
    palette: { w: "#e8f4ff", b: "#c8e0ff", a: "#ff7722", y: "#ffdd44" },
  } },
  { id: "pelican_5", name: "Pélican doré", value: {
    grid: ["...r.r...", "...ggg...", "..gorgg..", "..goorr..", ".gooooog.", "ggooooogg", ".gooooog.", "..ggoog..", "...ggg..."],
    palette: { g: "#ffd700", o: "#ffeeaa", r: "#ff4422" },
  } },
  { id: "corbeau_1", name: "Corbeau", value: {
    grid: ["..b...b..", "..bb.bb..", "..bbbbb..", ".bbbbbbb.", "bbbbbbbb.", ".bbbbbbb.", "..bbbbb..", "..brrbb..", "...bbb..."],
    palette: { b: "#1a1a2e", r: "#ff2244" },
  } },
  { id: "corbeau_3", name: "Corbeau sorcier", value: {
    grid: ["..p...p..", "..pp.pp..", "..ppppp..", ".ppppppp.", "pppppppp.", ".ppppppp.", "..ppppp..", "..pvvpp..", "...ppp..."],
    palette: { p: "#2d0a4e", v: "#cc00ff" },
  } },
  { id: "faucon_1", name: "Faucon", value: {
    grid: ["...y..y..", "..mbbm...", "..mbbm...", ".mbbbbbm.", "mmwwwwwmm", ".mwwwwwm.", "..mwwwm..", "..mbbwm..", "...mmm..."],
    palette: { m: "#1a1a1a", b: "#8b6040", w: "#f0ece8", y: "#f5c542" },
  } },
  { id: "faucon_4", name: "Faucon arctique", value: {
    grid: ["...y..y..", "..w..w...", "..wwsww..", ".wwwwwww.", "wwswwsww.", ".wwwwwww.", "..wwwww..", "..wsbww..", "...www..."],
    palette: { w: "#f8fcff", s: "#334455", b: "#4488cc", y: "#f5c542" },
  } },
  { id: "faucon_5", name: "Faucon cyber", value: {
    grid: ["...e..e..", "..c..c...", "..ceec...", ".cceeecc.", "cccccccc.", ".ccccccc.", "..ccccc..", "..cnnccc.", "...ccc..."],
    palette: { c: "#003344", n: "#00ffff", e: "#00ff88" },
  } },
];

// ─── Styles de panier (le nid) ───────────────────────────────────────────────────

export const BUCKET_STYLES: AssetVariant<BucketStyle>[] = [
  { id: "classique", name: "Nid classique", value: {
    egg: "#e8e4d8", eggHi: "#ffffff",
    nestDark: "#1c0a02", nestMid: "#4a2208", nestLight: "#6b3c12", nestRim: "#8c5020",
  } },
  { id: "dore", name: "Nid doré", value: {
    egg: "#e8c840", eggHi: "#ffe870",
    nestDark: "#2a1a02", nestMid: "#5a3a08", nestLight: "#8a6010", nestRim: "#c89030",
  } },
  { id: "sombre", name: "Nid d'ombre", value: {
    egg: "#5599ee", eggHi: "#99ccff",
    nestDark: "#0a0a12", nestMid: "#1a1a28", nestLight: "#2a2a3a", nestRim: "#4a4a60",
  } },
  { id: "mousse", name: "Nid moussu", value: {
    egg: "#dcecc4", eggHi: "#ffffff",
    nestDark: "#10180a", nestMid: "#2a3a14", nestLight: "#4a6020", nestRim: "#6a8838",
  } },
];

// ─── Œufs (le projectile lancé) ──────────────────────────────────────────────────

export const BALL_STYLES: AssetVariant<BallStyle>[] = [
  { id: "blanc", name: "Œuf blanc", value: { body: "#e0e0ff", glow: "#aaaaff", speckle: "rgba(80,60,40,0.45)" } },
  { id: "dore",  name: "Œuf doré",  value: { body: "#ffe870", glow: "#ffcc44", speckle: "rgba(120,80,0,0.40)" } },
  { id: "bleu",  name: "Œuf bleu",  value: { body: "#aaccff", glow: "#5599ee", speckle: "rgba(40,60,120,0.40)" } },
  { id: "vert",  name: "Œuf vert",  value: { body: "#aaffcc", glow: "#44cc88", speckle: "rgba(20,80,40,0.40)" } },
  { id: "rose",  name: "Œuf rosé",  value: { body: "#ffccdd", glow: "#ff88aa", speckle: "rgba(120,40,70,0.40)" } },
  { id: "noir",  name: "Œuf corbeau", value: { body: "#5a5a78", glow: "#8888cc", speckle: "rgba(0,0,0,0.55)" } },
];

// ─── Catégories (utilisé par la Galerie pour s'auto-construire) ──────────────────

export type AssetCategory = "pegPalette" | "background" | "bird" | "ball" | "bucket";

export const ASSET_CATEGORIES: { id: AssetCategory; label: string; variants: AssetVariant<unknown>[] }[] = [
  { id: "pegPalette", label: "Pegs",        variants: PEG_PALETTES },
  { id: "background", label: "Arrière-plan", variants: BACKGROUNDS },
  { id: "bird",       label: "Oiseau",      variants: BIRD_SPRITES },
  { id: "ball",       label: "Œuf",         variants: BALL_STYLES },
  { id: "bucket",     label: "Panier",      variants: BUCKET_STYLES },
];

const DEFAULT_IDS: Record<AssetCategory, string> = {
  pegPalette: "foret",
  background: "foret",
  bird: "pelican_1",
  ball: "blanc",
  bucket: "classique",
};

// ─── Sélection active (persistée + cache module partagé) ─────────────────────────
// Le cache est un singleton de module : la Galerie et le jeu partagent la même
// instance, donc choisir une variante met à jour le rendu en live.

const STORAGE_KEY = "peagle_active_assets";
export const ASSETS_CHANGED_EVENT = "peagle-assets-changed";

let _cache: Record<AssetCategory, string> | null = null;

function readFromStorage(): Record<AssetCategory, string> {
  if (typeof window === "undefined") return { ...DEFAULT_IDS };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Record<AssetCategory, string>>;
    return { ...DEFAULT_IDS, ...stored };
  } catch {
    return { ...DEFAULT_IDS };
  }
}

function active(): Record<AssetCategory, string> {
  return (_cache ??= readFromStorage());
}

/** Force la relecture de la sélection depuis localStorage (sync inter-fenêtres). */
export function refreshAssetCache(): void {
  _cache = readFromStorage();
}

export function getActiveAssetId(cat: AssetCategory): string {
  return active()[cat] ?? DEFAULT_IDS[cat];
}

export function setActiveAsset(cat: AssetCategory, id: string): void {
  const next = { ...active(), [cat]: id };
  _cache = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(ASSETS_CHANGED_EVENT));
  }
}

function find<T>(list: AssetVariant<T>[], id: string): T {
  return (list.find(v => v.id === id) ?? list[0]!).value;
}

// ─── Getters résolus (lus par le renderer) ──────────────────────────────────────

export function getActivePegPalette(): PegTheme { return find(PEG_PALETTES, getActiveAssetId("pegPalette")); }
export function getActiveBackground(): BgVariant { return find(BACKGROUNDS, getActiveAssetId("background")); }
export function getActiveBird(): BirdSprite { return find(BIRD_SPRITES, getActiveAssetId("bird")); }
export function getActiveBall(): BallStyle { return find(BALL_STYLES, getActiveAssetId("ball")); }
export function getActiveBucket(): BucketStyle { return find(BUCKET_STYLES, getActiveAssetId("bucket")); }
