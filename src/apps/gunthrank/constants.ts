import type { gunthrankGames, gunthrankRankings } from "@/lib/db/schema";

export const PLATFORM_COLORS: Record<string, string> = {
  "PC": "#4a9eff",
  "PlayStation 5": "#2e6db4",
  "PlayStation 4": "#1a4b7c",
  "PlayStation 3": "#0d3260",
  "PlayStation 2": "#0a1f40",
  "PlayStation": "#081830",
  "PSP": "#1e5f9e",
  "PS Vita": "#256ba8",
  "Xbox Series X|S": "#107c10",
  "Xbox One": "#0e5e0e",
  "Xbox 360": "#0a4a0a",
  "Xbox": "#074007",
  "Nintendo Switch": "#e60012",
  "Nintendo 64": "#b3000e",
  "Nintendo GameCube": "#6c00a8",
  "Super Nintendo": "#8b8b8b",
  "Game Boy Advance": "#7c007c",
  "Wii": "#0096c8",
  "Wii U": "#007a9e",
  "Game Boy": "#4a7c2e",
  "Nintendo DS": "#c0c0c0",
  "Nintendo 3DS": "#d50000",
  "Sega Genesis": "#005aab",
  "Sega Saturn": "#3b3b3b",
  "Dreamcast": "#e87500",
  "Game Gear": "#2d2d2d",
  "Arcade": "#ff6a00",
  "Mobile": "#ffb800",
  "Mac": "#999999",
  "Linux": "#f5c842",
  "Stadia": "#ff4c3a",
  "Oculus Quest": "#8b5cf6",
  "Meta Quest 2": "#7c3aed",
  "Meta Quest 3": "#a78bfa",
  "PlayStation VR": "#1a6fb5",
  "PlayStation VR2": "#2098d4",
  "SteamVR": "#1a9ed4",
};

export function getPlatformColor(platform: string | null | undefined): string | null {
  if (!platform) return null;
  // Exact match first
  if (PLATFORM_COLORS[platform]) return PLATFORM_COLORS[platform] ?? null;
  // Try case-insensitive
  const key = Object.keys(PLATFORM_COLORS).find((k) => k.toLowerCase() === platform.toLowerCase());
  return key ? (PLATFORM_COLORS[key] ?? null) : null;
}

export const TIERS = [
  { id: "diamond", label: "Kiff de Diamant", emoji: "💎", color: "#4facfe" },
  { id: "gold", label: "Kiff d'Or", emoji: "🥇", color: "#f9d423" },
  { id: "silver", label: "Kiff d'Argent", emoji: "🥈", color: "#bdc3c7" },
  { id: "bronze", label: "Kiff de Bronze", emoji: "🥉", color: "#cd7f32" },
  { id: "banger", label: "Déjà Oublié", emoji: "🌫️", color: "#9b8ea8" },
  { id: "caca", label: "Kiff Caca d'Or", emoji: "💩", color: "#8b7355" },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

export type GameCatalogEntry = typeof gunthrankGames.$inferSelect;

export type RankingRow = typeof gunthrankRankings.$inferSelect;

export interface RankingEntry extends RankingRow {
  game: GameCatalogEntry | null;
}

export interface IgdbSearchResult {
  igdbId: number;
  name: string;
  slug: string | null;
  coverUrl: string | null;
  platforms: string[];
  genres: string[];
  publishers: string[];
  developers: string[];
  releaseYear: number | null;
  summary: string | null;
  videos: Array<{ videoId: string; name: string | null }>;
}

export interface Filters {
  platform: string | null;
  genre: string | null;
  year: number | null;
  tiers: TierId[];
}

// ── Mode Journaliste ──

/** Priorité des tiers pour le tiebreaker (plus haut = prioritaire). */
export const TIER_PRIORITY: Record<TierId, number> = {
  diamond: 5,
  gold: 4,
  silver: 3,
  bronze: 2,
  banger: 1,
  caca: 0,
};

export interface JournalistCategory {
  min: number;
  max: number;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

/** Catégories journalistiques façon Console+. */
export const JOURNALIST_CATEGORIES: JournalistCategory[] = [
  { min: 95, max: 100, label: "MYTHIQUE", emoji: "👑", color: "#FFD700", bgColor: "#1a1a2e" },
  { min: 85, max: 94,  label: "EXCEPTIONNEL", emoji: "🌟", color: "#FF6B6B", bgColor: "#1a1a2e" },
  { min: 75, max: 84,  label: "EXCELLENT", emoji: "✨", color: "#4ECDC4", bgColor: "#1a1a2e" },
  { min: 65, max: 74,  label: "TRÈS BON", emoji: "👍", color: "#45B7D1", bgColor: "#1a1a2e" },
  { min: 50, max: 64,  label: "BON", emoji: "👌", color: "#96CEB4", bgColor: "#1a1a2e" },
  { min: 35, max: 49,  label: "MOYEN", emoji: "😐", color: "#FFEAA7", bgColor: "#1a1a2e" },
  { min: 20, max: 34,  label: "PASSABLE", emoji: "😬", color: "#DFE6E9", bgColor: "#1a1a2e" },
  { min: 0,  max: 19,  label: "À ÉVITER", emoji: "💀", color: "#B2BEC3", bgColor: "#1a1a2e" },
];

/** Retourne la catégorie correspondant à un pourcentage. */
export function getJournalistCategory(pct: number): JournalistCategory {
  for (const cat of JOURNALIST_CATEGORIES) {
    if (pct >= cat.min && pct <= cat.max) return cat;
  }
  return JOURNALIST_CATEGORIES[JOURNALIST_CATEGORIES.length - 1]!;
}

export interface JournalistEntry {
  ranking: RankingEntry;
  /** Position absolue (1-based) dans le classement journalistique. */
  rank: number;
  /** Note convertie en pourcentage (0-100). */
  percentage: number;
  /** Catégorie Console+. */
  category: JournalistCategory;
  /** Position dans le vrai classement du kiff (0 = meilleur), pour le tiebreaker. */
  kiffRank: number;
}

/**
 * Calcule la liste journalistique.
 * @param displayRankings Les jeux à afficher (peut être filtré par plateforme/genre/année).
 * @param kiffRankSource La source pour le calcul du "vrai classement du kiff" (tiebreaker).
 *                        Si omis, utilise displayRankings.
 */
export function computeJournalistList(
  displayRankings: RankingEntry[],
  kiffRankSource?: RankingEntry[],
): JournalistEntry[] {
  const source = kiffRankSource ?? displayRankings;

  // 1. Calculer le "kiff rank" global (position dans le classement par tiers)
  const byKiffRank = [...source].sort((a, b) => {
    const pa = TIER_PRIORITY[a.tier as TierId] ?? 0;
    const pb = TIER_PRIORITY[b.tier as TierId] ?? 0;
    if (pa !== pb) return pb - pa; // priorité décroissante
    return a.sortOrder - b.sortOrder; // sortOrder croissant
  });
  const kiffRankMap = new Map<number, number>();
  byKiffRank.forEach((r, i) => kiffRankMap.set(r.id, i));

  // 2. Filtrer les jeux sans note (sur la liste d'affichage)
  const withNotes = displayRankings.filter((r) => r.objectiveNote != null);

  // 3. Trier par note décroissante, puis kiff rank croissant (tiebreaker)
  withNotes.sort((a, b) => {
    const noteDiff = (b.objectiveNote ?? 0) - (a.objectiveNote ?? 0);
    if (noteDiff !== 0) return noteDiff;
    const ka = kiffRankMap.get(a.id) ?? 9999;
    const kb = kiffRankMap.get(b.id) ?? 9999;
    return ka - kb;
  });

  // 4. Construire la liste finale
  return withNotes.map((r, i) => {
    const pct = (r.objectiveNote ?? 0) * 10;
    return {
      ranking: r,
      rank: i + 1,
      percentage: pct,
      category: getJournalistCategory(pct),
      kiffRank: kiffRankMap.get(r.id) ?? 9999,
    };
  });
}
