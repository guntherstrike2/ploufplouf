"use client";

import { useSoundContext } from "@/lib/contexts/sound-context";
import type { Filters, TierId } from "../constants";

interface FilterBarProps {
  filters: Filters;
  setFilters: (f: Filters) => void;
  allPlatforms: string[];
  allGenres: string[];
  allYears: number[];
}

export function FilterBar({ filters, setFilters, allPlatforms, allGenres, allYears }: FilterBarProps) {
  const { playClick } = useSoundContext();

  const set = (patch: Partial<Filters>) => {
    playClick();
    setFilters({ ...filters, ...patch });
  };

  const hasFilters = filters.platform || filters.genre || filters.year || filters.tiers.length > 0;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0 flex-wrap"
      style={{ borderBottom: "1px solid var(--t-border-dark)", background: "var(--t-bg)" }}
    >
      <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>Filtres:</span>

      <select
        value={filters.platform ?? ""}
        onChange={(e) => set({ platform: e.target.value || null })}
        style={{
          fontSize: "var(--t-text-xs)",
          background: "var(--t-bg)",
          color: "var(--t-text)",
          borderTop: "2px solid var(--t-border-dark)",
          borderLeft: "2px solid var(--t-border-dark)",
          borderBottom: "2px solid var(--t-border-light)",
          borderRight: "2px solid var(--t-border-light)",
          padding: "2px 4px",
        }}
      >
        <option value="">Plateforme</option>
        {allPlatforms.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select
        value={filters.genre ?? ""}
        onChange={(e) => set({ genre: e.target.value || null })}
        style={{
          fontSize: "var(--t-text-xs)",
          background: "var(--t-bg)",
          color: "var(--t-text)",
          borderTop: "2px solid var(--t-border-dark)",
          borderLeft: "2px solid var(--t-border-dark)",
          borderBottom: "2px solid var(--t-border-light)",
          borderRight: "2px solid var(--t-border-light)",
          padding: "2px 4px",
        }}
      >
        <option value="">Genre</option>
        {allGenres.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      <select
        value={filters.year ?? ""}
        onChange={(e) => set({ year: e.target.value ? parseInt(e.target.value, 10) : null })}
        style={{
          fontSize: "var(--t-text-xs)",
          background: "var(--t-bg)",
          color: "var(--t-text)",
          borderTop: "2px solid var(--t-border-dark)",
          borderLeft: "2px solid var(--t-border-dark)",
          borderBottom: "2px solid var(--t-border-light)",
          borderRight: "2px solid var(--t-border-light)",
          padding: "2px 4px",
        }}
      >
        <option value="">Année</option>
        {allYears.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        {(["diamond", "gold", "silver", "bronze", "banger", "caca"] as TierId[]).map((tier) => {
          const tierEmojis: Record<string, string> = { diamond: "💎", gold: "🥇", silver: "🥈", bronze: "🥉", banger: "🍑", caca: "💩" };
          return (
          <button
            key={tier}
            onClick={() => {
              const next = filters.tiers.includes(tier)
                ? filters.tiers.filter((t) => t !== tier)
                : [...filters.tiers, tier];
              set({ tiers: next });
            }}
            className="px-2 py-1 font-bold"
            style={{
              fontSize: "var(--t-text-xs)",
              background: filters.tiers.includes(tier) ? "var(--t-accent)" : "var(--t-bg-dark)",
              color: filters.tiers.includes(tier) ? "#fff" : "var(--t-text-muted)",
              borderRadius: "4px",
              border: "1px solid var(--t-border-dark)",
              boxShadow: filters.tiers.includes(tier)
                ? "0 2px 6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)"
                : "0 1px 3px rgba(0,0,0,0.15)",
              textShadow: filters.tiers.includes(tier) ? "0 1px 2px rgba(0,0,0,0.4)" : "none",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tierEmojis[tier]}
          </button>
          );
        })}
      </div>

      {hasFilters && (
        <button
          onClick={() => set({ platform: null, genre: null, year: null, tiers: [] })}
          className="px-2 py-0.5"
          style={{
            fontSize: "var(--t-text-xs)",
            background: "var(--t-error)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
