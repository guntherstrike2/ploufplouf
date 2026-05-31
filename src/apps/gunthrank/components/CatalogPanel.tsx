"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TIERS, type TierId, type GameCatalogEntry, type IgdbSearchResult } from "../constants";

interface CatalogPanelProps {
  onClose: () => void;
  onAddFromCatalog?: (gameId: number, toTier: TierId) => void;
  onAddFromIgdb?: (game: IgdbSearchResult, toTier: TierId) => void;
}

const POPULAR_GENRES = ["Adventure", "RPG", "Shooter", "Platform", "Strategy", "Racing", "Fighting", "Sport", "Puzzle", "Indie", "Simulator", "Arcade"];
const POPULAR_PLATFORMS = ["PC", "PlayStation 5", "Xbox Series X|S", "Nintendo Switch", "PlayStation 4", "Xbox One", "Xbox 360", "Nintendo 64", "PlayStation 2", "Super Nintendo", "Game Boy Advance", "Nintendo GameCube", "Wii", "Wii U", "Quest"];

export function CatalogPanel({ onClose, onAddFromCatalog, onAddFromIgdb }: CatalogPanelProps) {
  const [allDbGames, setAllDbGames] = useState<GameCatalogEntry[]>([]);
  const [tierPickerId, setTierPickerId] = useState<string | null>(null);
  const [igdbResults, setIgdbResults] = useState<IgdbSearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [igdbError, setIgdbError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load full catalog once on mount (never replaced)
  useEffect(() => {
    inputRef.current?.focus();
    fetch("/api/gunthrank/games")
      .then((r) => r.json())
      .then((d: { games: GameCatalogEntry[] }) => setAllDbGames(d.games));
  }, []);

  const hasFilters = query.length >= 2 || genreFilter || platformFilter;

  // IGDB search — fires on mount for popular games, and on every filter change
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const body: Record<string, unknown> = { limit: 30 };
        if (query.length >= 2) body.query = query;
        if (genreFilter) body.genre = genreFilter;
        if (platformFilter) body.platform = platformFilter;

        const igdbRes = await fetch("/api/igdb/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await igdbRes.json() as { results: IgdbSearchResult[]; offline?: boolean; rateLimited?: boolean; error?: string };
        const newResults = data.results ?? [];
        // Only replace results if we got something, or if there's no text query active.
        // Prevents popular games from vanishing when text search returns empty.
        if (newResults.length > 0 || query.length < 2) {
          setIgdbResults(newResults);
        }
        setOffline(!!data.offline);
        setRateLimited(!!data.rateLimited);
        setIgdbError(data.error ?? null);
      } catch {
        if (query.length < 2) setIgdbResults([]);
        setOffline(true);
        setRateLimited(false);
        setIgdbError("IGDB inaccessible — vérifie ta connexion.");
      }
      setLoading(false);
    }, query.length >= 2 ? 300 : 0); // debounce only for text search, instant for filters
    return () => clearTimeout(timer);
  }, [query, genreFilter, platformFilter]);

  // Filter local catalog by ALL criteria (text + genre + platform)
  const filteredDbGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allDbGames.filter((g) => {
      if (q.length >= 2 && !g.name.toLowerCase().includes(q)) return false;
      if (genreFilter && g.genres) {
        try {
          const genres: string[] = JSON.parse(g.genres);
          if (!genres.includes(genreFilter)) return false;
        } catch { return false; }
      }
      if (platformFilter && g.platforms) {
        try {
          const platforms: string[] = JSON.parse(g.platforms);
          if (!platforms.some((p) => p.toLowerCase().includes(platformFilter.toLowerCase()))) return false;
        } catch { return false; }
      }
      return true;
    });
  }, [allDbGames, query, genreFilter, platformFilter]);

  const handleDragStartDb = useCallback((e: React.DragEvent, game: GameCatalogEntry) => {
    e.dataTransfer.setData("text/plain", `catalog:${game.id}`);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleDragStartIgdb = useCallback((e: React.DragEvent, game: IgdbSearchResult) => {
    e.dataTransfer.setData("text/plain", `igdb:${JSON.stringify(game)}`);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const clearFilters = () => {
    setQuery("");
    setGenreFilter(null);
    setPlatformFilter(null);
  };

  return (
    <div
      className="flex flex-col flex-shrink-0 border-r"
      style={{
        width: 250,
        background: "var(--t-bg)",
        borderRightColor: "var(--t-border-dark)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-2 py-1.5"
        style={{ borderBottom: "1px solid var(--t-border-dark)" }}
      >
        <span style={{ fontSize: "var(--t-text-sm)", fontWeight: "bold" }}>Catalogue</span>
        <button
          onClick={onClose}
          style={{
            fontSize: "var(--t-text-sm)",
            background: "none",
            border: "none",
            color: "var(--t-text-muted)",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5" style={{ borderBottom: "1px solid var(--t-border-dark)" }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un jeu..."
          className="w-full px-2 py-1"
          style={{
            fontSize: "var(--t-text-sm)",
            background: "var(--t-app-bg)",
            color: "var(--t-text)",
            borderTop: "2px solid var(--t-border-dark)",
            borderLeft: "2px solid var(--t-border-dark)",
            borderBottom: "2px solid var(--t-border-light)",
            borderRight: "2px solid var(--t-border-light)",
          }}
        />
      </div>

      {/* Quick filters */}
      <div className="px-2 py-1.5" style={{ borderBottom: "1px solid var(--t-border-dark)" }}>
        <div style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", marginBottom: 2 }}>Genre</div>
        <div className="flex flex-wrap gap-1 max-h-16 overflow-auto">
          {POPULAR_GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setGenreFilter(genreFilter === g ? null : g)}
              className="px-1 py-0.5 flex-shrink-0"
              style={{
                fontSize: "calc(var(--t-text-xs) * 0.85)",
                background: genreFilter === g ? "var(--t-accent)" : "var(--t-bg-dark)",
                color: genreFilter === g ? "#fff" : "var(--t-text-muted)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {g}
            </button>
          ))}
        </div>

        <div style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", marginTop: 4, marginBottom: 2 }}>Plateforme</div>
        <div className="flex flex-wrap gap-1 max-h-16 overflow-auto">
          {POPULAR_PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
              className="px-1 py-0.5 flex-shrink-0"
              style={{
                fontSize: "calc(var(--t-text-xs) * 0.85)",
                background: platformFilter === p ? "var(--t-accent)" : "var(--t-bg-dark)",
                color: platformFilter === p ? "#fff" : "var(--t-text-muted)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Results count + status */}
      <div className="px-2 py-1 flex flex-col gap-0.5" style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
        <div className="flex items-center gap-2">
          {loading ? (
            <span>Recherche...</span>
          ) : (
            <span>{filteredDbGames.length} locaux · {igdbResults.length} IGDB</span>
          )}
          {hasFilters && (
            <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--t-accent)", cursor: "pointer", fontSize: "inherit" }}>clear</button>
          )}
        </div>
        {rateLimited && (
          <span className="px-1 py-0.5" style={{ fontSize: "calc(var(--t-text-xs) * 0.85)", background: "#ff3300", color: "#fff" }}>
            ⚡ Limite IGDB atteinte — réessaie dans quelques secondes
          </span>
        )}
        {!rateLimited && igdbError && (
          <span style={{ color: "var(--t-error)" }}>⚠ {igdbError}</span>
        )}
        {!rateLimited && !igdbError && offline && (
          <span style={{ color: "var(--t-warning)" }}>⚠ IGDB hors-ligne</span>
        )}
      </div>

      {/* Results */}
      <div className="overflow-auto flex-1">

        {filteredDbGames.map((game) => {
          const pickerKey = `db:${game.id}`;
          const showPicker = tierPickerId === pickerKey;
          return (
            <div
              key={`db-${game.id}`}
              draggable
              onDragStart={(e) => handleDragStartDb(e, game)}
              className="flex items-center gap-2 px-2 py-1.5 cursor-grab active:cursor-grabbing select-none hover:brightness-110"
              style={{ borderBottom: "1px solid var(--t-border-dark)" }}
              title={`${game.name} — glisse vers un tier ou clique sur +`}
            >
              {game.coverUrl ? (
                <img src={game.coverUrl} alt={game.name} className="flex-shrink-0 object-cover" style={{ width: 32, height: 44 }} draggable={false} />
              ) : (
                <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 32, height: 44, background: "var(--t-bg-dark)", fontSize: "var(--t-text-md)" }}>
                  🎮
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ fontSize: "var(--t-text-sm)" }}>{game.name}</div>
                {game.platforms && (
                  <div style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                    {(JSON.parse(game.platforms) as string[]).slice(0, 2).join(", ")}
                  </div>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <button
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 22, height: 22,
                    fontSize: "var(--t-text-xs)",
                    fontWeight: "bold",
                    background: showPicker ? "var(--t-accent)" : "var(--t-bg-dark)",
                    color: showPicker ? "#fff" : "var(--t-text-muted)",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={(e) => { e.stopPropagation(); setTierPickerId(showPicker ? null : pickerKey); }}
                  title="Ajouter à un tier"
                >
                  +
                </button>
                {showPicker && (
                  <div
                    className="absolute right-0 top-full z-30 p-1 rounded"
                    style={{
                      background: "var(--t-bg)",
                      borderTop: "2px solid var(--t-border-light)",
                      borderLeft: "2px solid var(--t-border-light)",
                      borderBottom: "2px solid var(--t-border-dark)",
                      borderRight: "2px solid var(--t-border-dark)",
                      minWidth: 130,
                    }}
                  >
                    {TIERS.map((t) => (
                      <button
                        key={t.id}
                        className="flex items-center gap-1 w-full px-2 py-1 text-left"
                        style={{
                          fontSize: "var(--t-text-xs)",
                          background: "none",
                          color: "var(--t-text)",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddFromCatalog?.(game.id, t.id);
                          setTierPickerId(null);
                        }}
                      >
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {igdbResults.map((game) => {
          const pickerKey = `igdb:${game.igdbId}`;
          const showPicker = tierPickerId === pickerKey;
          return (
            <div
              key={`igdb-${game.igdbId}`}
              draggable
              onDragStart={(e) => handleDragStartIgdb(e, game)}
              className="flex items-center gap-2 px-2 py-1.5 cursor-grab active:cursor-grabbing select-none hover:brightness-110"
              style={{ borderBottom: "1px solid var(--t-border-dark)", background: "var(--t-card-bg)" }}
              title={`${game.name} (IGDB)\n${game.genres.join(", ")}\n${game.platforms.join(", ")}\n${game.publishers.join(", ")}`}
            >
              {game.coverUrl ? (
                <img src={game.coverUrl} alt={game.name} className="flex-shrink-0 object-cover" style={{ width: 32, height: 44 }} draggable={false} />
              ) : (
                <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 32, height: 44, background: "var(--t-bg-dark)", fontSize: "var(--t-text-md)" }}>
                  🎮
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate flex items-center gap-1" style={{ fontSize: "var(--t-text-xs)" }}>
                  {game.name}
                  <span className="flex-shrink-0 px-1" style={{ fontSize: "calc(var(--t-text-xs) * 0.85)", background: "var(--t-accent)", color: "#fff" }}>IGDB</span>
                </div>
                <div style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                  {game.genres.slice(0, 2).join(", ")}
                </div>
                <div style={{ fontSize: "calc(var(--t-text-xs) * 0.85)", color: "var(--t-text-muted)" }}>
                  {game.platforms.slice(0, 2).join(", ")}
                  {game.publishers.length > 0 ? ` — ${game.publishers[0]}` : ""}
                </div>
              </div>
              <div style={{ position: "relative" }}>
                <button
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 22, height: 22,
                    fontSize: "var(--t-text-xs)",
                    fontWeight: "bold",
                    background: showPicker ? "var(--t-accent)" : "var(--t-bg-dark)",
                    color: showPicker ? "#fff" : "var(--t-text-muted)",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={(e) => { e.stopPropagation(); setTierPickerId(showPicker ? null : pickerKey); }}
                  title="Ajouter à un tier"
                >
                  +
                </button>
                {showPicker && (
                  <div
                    className="absolute right-0 top-full z-30 p-1 rounded"
                    style={{
                      background: "var(--t-bg)",
                      borderTop: "2px solid var(--t-border-light)",
                      borderLeft: "2px solid var(--t-border-light)",
                      borderBottom: "2px solid var(--t-border-dark)",
                      borderRight: "2px solid var(--t-border-dark)",
                      minWidth: 130,
                    }}
                  >
                    {TIERS.map((t) => (
                      <button
                        key={t.id}
                        className="flex items-center gap-1 w-full px-2 py-1 text-left"
                        style={{
                          fontSize: "var(--t-text-xs)",
                          background: "none",
                          color: "var(--t-text)",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddFromIgdb?.(game, t.id);
                          setTierPickerId(null);
                        }}
                      >
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!loading && filteredDbGames.length === 0 && igdbResults.length === 0 && (
          <div className="px-2 py-2" style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
            {offline ? "IGDB hors-ligne. Vérifie ta connexion." : hasFilters ? "Aucun résultat." : "Aucun jeu trouvé."}
          </div>
        )}
      </div>
    </div>
  );
}
