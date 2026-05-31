export type DrawMode = "roulette" | "horizontal" | "vertical";

export type CelebType =
  | "confetti"
  | "hearts"
  | "matrix"
  | "bubbles"
  | "fireworks"
  | "rain"
  | "xp"
  | "money"
  | "stars"
  | "alien"
  | "flame"
  | "poop"
  | "trophy"
  | "trophy-gold"
  | "trophy-silver"
  | "trophy-bronze"
  | "trophy-diamond";

export interface CelebrationOptions {
  preset: string;
  type: CelebType;
  text: string;
  density: number;
  duration: number;
  shake: number;
  color1: string;
  color2: string;
  color3: string;
  rainbow: boolean;
  flash: boolean;
  marquee: boolean;
  bigText: boolean;
  damageNumbers: boolean;
  bgPulse: boolean;
  epicResult: boolean;
  randomPreset: boolean;
  forceTransparent: boolean;
  winnerColor: string;
  winnerSubColor: string;
  /** Multiplier for particle velocities (1 = normal, 0.5 = half speed) */
  speedMultiplier?: number;
  /** How much life decreases per frame (0 = no fade, 0.005 ≈ 3.3s fade) */
  lifeDecay?: number;
  /** When true (default), particles fade out gracefully after duration. When false, instant stop. */
  fadeOut?: boolean;
}

export const DEFAULT_OPTIONS: CelebrationOptions = {
  preset: "classic",
  type: "confetti",
  text: "VICTOIRE!",
  density: 150,
  duration: 10,
  shake: 5,
  color1: "#ff0080",
  color2: "#00ffff",
  color3: "#ffee00",
  rainbow: true,
  flash: true,
  marquee: true,
  bigText: true,
  damageNumbers: true,
  bgPulse: true,
  epicResult: true,
  randomPreset: true,
  forceTransparent: false,
  winnerColor: "#ffff00",
  winnerSubColor: "#ffffff",
  speedMultiplier: 1,
  lifeDecay: 0,
};

export type PresetName =
  | "classic"
  | "invasion"
  | "zen"
  | "plus-haut"
  | "kawaii"
  | "glitch"
  | "fire"
  | "caca-dor"
  | "vampire"
  | "gwak"
  | "kwag"
  | "lnk"
  | "kiff-dor"
  | "kiff-dargent"
  | "kiff-de-bronze";

export const PRESET_LABELS: Record<PresetName, string> = {
  classic: "Classic",
  invasion: "Invasion",
  zen: "Zen",
  "plus-haut": "Plus Haut",
  kawaii: "Kawaii",
  glitch: "Glitch",
  fire: "Fire",
  "caca-dor": "Caca d'Or",
  vampire: "Vampire",
  gwak: "Gwak",
  kwag: "Kwag",
  lnk: "LNK",
  "kiff-dor": "Kiff d'Or",
  "kiff-dargent": "Kiff d'Argent",
  "kiff-de-bronze": "Kiff de Bronze",
};

/** Canonical text + colors for each celebration type. Kept in sync with PRESETS. */
export const TYPE_DEFAULTS: Record<
  CelebType,
  Pick<CelebrationOptions, "text" | "color1" | "color2" | "color3" | "rainbow" | "winnerColor" | "winnerSubColor">
> = {
  confetti:  { text: "VICTOIRE!",   color1: "#ff0080", color2: "#00ffff", color3: "#ffee00", rainbow: true,  winnerColor: "#ffffff", winnerSubColor: "#ffee00" },
  fireworks: { text: "DISCO!",      color1: "#ff00ff", color2: "#ffea00", color3: "#00ffff", rainbow: false, winnerColor: "#ffffff", winnerSubColor: "#ffea00" },
  alien:     { text: "INVASION!!",  color1: "#00ff41", color2: "#9900ff", color3: "#ff0000", rainbow: false, winnerColor: "#ffff00", winnerSubColor: "#00ff41" },
  bubbles:   { text: "~ calme ~",   color1: "#b8e6ff", color2: "#e0f0ff", color3: "#ffffff", rainbow: false, winnerColor: "#ff6b6b", winnerSubColor: "#ffffff" },
  hearts:    { text: "♥ WIN! ♥",    color1: "#bb99aa", color2: "#ff00ff", color3: "#ff69b4", rainbow: false, winnerColor: "#00ffe0", winnerSubColor: "#ff69b4" },
  stars:     { text: "SUGOI!!",     color1: "#ff88c2", color2: "#ffc0eb", color3: "#fff0f5", rainbow: false, winnerColor: "#66ffcc", winnerSubColor: "#ff88c2" },
  matrix:    { text: "H4CK3D!!",    color1: "#00ff41", color2: "#00cc33", color3: "#003b00", rainbow: false, winnerColor: "#ff00ff", winnerSubColor: "#00ff41" },
  flame:     { text: "UNTZ UNTZ!!", color1: "#ff00ff", color2: "#ff6600", color3: "#ffff00", rainbow: false, winnerColor: "#00ffff", winnerSubColor: "#ffff00" },
  rain:      { text: "PLEURE...",   color1: "#4169e1", color2: "#6495ed", color3: "#87ceeb", rainbow: false, winnerColor: "#ffa500", winnerSubColor: "#ffffff" },
  money:     { text: "ALOHA!",      color1: "#ffd700", color2: "#ff6b35", color3: "#ff1493", rainbow: true,  winnerColor: "#ffffff", winnerSubColor: "#ffd700" },
  poop:      { text: "CACA D'OR ?", color1: "#8b4513", color2: "#654321", color3: "#d2691e", rainbow: false, winnerColor: "#00ffff", winnerSubColor: "#ffd700" },
  xp:        { text: "Le Sang !!!", color1: "#ff0000", color2: "#ffffff", color3: "#000000", rainbow: false, winnerColor: "#00ffcc", winnerSubColor: "#ffffff" },
  trophy:    { text: "Kiff d'Or ?",  color1: "#ffd700", color2: "#ffaa00", color3: "#ffec00", rainbow: false, winnerColor: "#ffd700", winnerSubColor: "#ffaa00" },
  "trophy-gold":   { text: "Kiff d'Or !",  color1: "#ffd700", color2: "#ffaa00", color3: "#ffec00", rainbow: false, winnerColor: "#ffd700", winnerSubColor: "#ffaa00" },
  "trophy-silver": { text: "Kiff d'Argent !", color1: "#c0c0c0", color2: "#e8e8e8", color3: "#a0a0a0", rainbow: false, winnerColor: "#e8e8e8", winnerSubColor: "#c0c0c0" },
  "trophy-bronze": { text: "Kiff de Bronze !", color1: "#cd7f32", color2: "#e8a860", color3: "#8b5a2b", rainbow: false, winnerColor: "#e8a860", winnerSubColor: "#cd7f32" },
  "trophy-diamond": { text: "Kiff de Diamant !", color1: "#b9f2ff", color2: "#ffffff", color3: "#e0f7ff", rainbow: false, winnerColor: "#b9f2ff", winnerSubColor: "#ffffff" },
};

export const PRESETS: Record<PresetName, CelebrationOptions> = {
  classic: { ...DEFAULT_OPTIONS, preset: "classic", text: "c'est parti !" },
  invasion: {
    ...DEFAULT_OPTIONS,
    preset: "invasion",
    type: "alien",
    text: "INVASION!!",
    density: 350,
    duration: 10,
    shake: 10,
    color1: "#00ff41",
    color2: "#9900ff",
    color3: "#ff0000",
    winnerColor: "#ffff00",
    winnerSubColor: "#00ff41",
    rainbow: false,
    flash: true,
    marquee: false,
    bgPulse: false,
  },
  zen: {
    ...DEFAULT_OPTIONS,
    preset: "zen",
    type: "bubbles",
    text: "pepouze...",
    density: 50,
    duration: 10,
    shake: 0,
    color1: "#b8e6ff",
    color2: "#e0f0ff",
    color3: "#ffffff",
    winnerColor: "#ff6b6b",
    winnerSubColor: "#ffffff",
    rainbow: false,
    flash: false,
    marquee: false,
    bigText: true,
    damageNumbers: false,
    bgPulse: false,
  },
  "plus-haut": {
    ...DEFAULT_OPTIONS,
    preset: "plus-haut",
    type: "hearts",
    text: "♥ oh oui ♥",
    density: 180,
    duration: 10,
    shake: 4,
    color1: "#bb99aa",
    color2: "#ff00ff",
    color3: "#ff69b4",
    winnerColor: "#00ffe0",
    winnerSubColor: "#ff69b4",
    rainbow: false,
    damageNumbers: false,
  },
  kawaii: {
    ...DEFAULT_OPTIONS,
    preset: "kawaii",
    type: "stars",
    text: "Yataaa !",
    density: 120,
    duration: 10,
    shake: 2,
    color1: "#ff88c2",
    color2: "#ffc0eb",
    color3: "#fff0f5",
    winnerColor: "#66ffcc",
    winnerSubColor: "#ff88c2",
    rainbow: false,
    damageNumbers: false,
    marquee: false,
    bgPulse: true,
  },
  glitch: {
    ...DEFAULT_OPTIONS,
    preset: "glitch",
    type: "matrix",
    text: "H4CK3D!!",
    density: 300,
    duration: 10,
    shake: 8,
    color1: "#00ff41",
    color2: "#00cc33",
    color3: "#003b00",
    winnerColor: "#ff00ff",
    winnerSubColor: "#00ff41",
    rainbow: false,
    flash: true,
    marquee: true,
    bigText: true,
    damageNumbers: true,
    bgPulse: false,
  },
  fire: {
    ...DEFAULT_OPTIONS,
    preset: "fire",
    type: "flame",
    text: "EXTREMLY HOT",
    density: 350,
    duration: 10,
    shake: 10,
    color1: "#ff00ff",
    color2: "#ff6600",
    color3: "#ffff00",
    winnerColor: "#00ffff",
    winnerSubColor: "#ffff00",
    rainbow: true,
    flash: true,
    damageNumbers: true,
    epicResult: true,
  },
  "caca-dor": {
    ...DEFAULT_OPTIONS,
    preset: "caca-dor",
    type: "poop",
    text: "CACA D'OR ?",
    density: 180,
    duration: 10,
    shake: 6,
    color1: "#8b4513",
    color2: "#654321",
    color3: "#d2691e",
    winnerColor: "#ff8c00",
    winnerSubColor: "#ffd700",
    rainbow: false,
    flash: false,
    marquee: true,
    bigText: true,
    damageNumbers: true,
    bgPulse: false,
  },
  vampire: {
    ...DEFAULT_OPTIONS,
    preset: "vampire",
    type: "xp",
    text: "Le Sang !!!",
    density: 300,
    duration: 10,
    shake: 7,
    color1: "#ff0000",
    color2: "#ffffff",
    color3: "#000000",
    winnerColor: "#ff0000",
    winnerSubColor: "#ffffff",
    rainbow: false,
    marquee: false,
  },
  gwak: {
    ...DEFAULT_OPTIONS,
    preset: "gwak",
    type: "bubbles",
    text: "l'amour gagne toujours a la fin",
    density: 200,
    duration: 10,
    shake: 4,
    color1: "#39ff14",
    color2: "#ff1493",
    color3: "#ffff00",
    winnerColor: "#ffffff",
    winnerSubColor: "#ff1493",
    rainbow: false,
    flash: true,
    marquee: true,
    bigText: true,
    damageNumbers: false,
    bgPulse: true,
    epicResult: false,
  },
  kwag: {
    ...DEFAULT_OPTIONS,
    preset: "kwag",
    type: "bubbles",
    text: "la fin gagne toujours sur l'amour",
    density: 200,
    duration: 10,
    shake: 4,
    color1: "#0088ff",
    color2: "#ffdd00",
    color3: "#00ffff",
    winnerColor: "#ffffff",
    winnerSubColor: "#ffdd00",
    rainbow: false,
    flash: true,
    marquee: true,
    bigText: true,
    damageNumbers: false,
    bgPulse: true,
    epicResult: false,
  },
  lnk: {
    ...DEFAULT_OPTIONS,
    preset: "lnk",
    type: "fireworks",
    text: "ALLOO ????",
    density: 250,
    duration: 10,
    shake: 5,
    color1: "#9146ff",
    color2: "#772ce8",
    color3: "#ffffff",
    winnerColor: "#b366ff",
    winnerSubColor: "#ffffff",
    rainbow: false,
    flash: true,
    marquee: true,
    bigText: true,
    damageNumbers: true,
    bgPulse: true,
    epicResult: true,
  },
  "kiff-dor": {
    ...DEFAULT_OPTIONS,
    preset: "kiff-dor",
    type: "trophy-gold",
    text: "Kiff d'Or ?",
    density: 120,
    duration: 10,
    shake: 4,
    color1: "#ffd700",
    color2: "#ffaa00",
    color3: "#ffec00",
    winnerColor: "#ffd700",
    winnerSubColor: "#ffaa00",
    rainbow: false,
    marquee: true,
    bigText: true,
    damageNumbers: false,
    epicResult: true,
  },
  "kiff-dargent": {
    ...DEFAULT_OPTIONS,
    preset: "kiff-dargent",
    type: "trophy-silver",
    text: "Kiff d'Argent ?",
    density: 100,
    duration: 10,
    shake: 3,
    color1: "#c0c0c0",
    color2: "#e8e8e8",
    color3: "#a0a0a0",
    winnerColor: "#e8e8e8",
    winnerSubColor: "#c0c0c0",
    rainbow: false,
    marquee: true,
    bigText: true,
    damageNumbers: false,
    epicResult: false,
  },
  "kiff-de-bronze": {
    ...DEFAULT_OPTIONS,
    preset: "kiff-de-bronze",
    type: "trophy-bronze",
    text: "Kiff de Bronze ?",
    density: 80,
    duration: 10,
    shake: 2,
    color1: "#cd7f32",
    color2: "#e8a860",
    color3: "#8b5a2b",
    winnerColor: "#e8a860",
    winnerSubColor: "#cd7f32",
    rainbow: false,
    marquee: true,
    bigText: true,
    damageNumbers: false,
    epicResult: false,
  },
};
