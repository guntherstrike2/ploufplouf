export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = "064v7k0pvgi3glsje5mkm3b8x5qeu7";
const CLIENT_SECRET = "qwza7uzglo1zmsvxcz032e5x6xcjjr";

let cachedToken: string | null = null;
let cachedExpiresAt = 0;

const FIELDS = "name,slug,cover.url,platforms.name,genres.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,first_release_date,summary";

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, i) * 500));
      }
    }
  }
  throw lastErr;
}

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedExpiresAt - 60_000) return cachedToken;

  try {
    const res = await fetchWithRetry("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) {
      console.error("Twitch OAuth failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json() as { access_token: string; expires_in: number };
    cachedToken = data.access_token;
    cachedExpiresAt = Date.now() + data.expires_in * 1000;
    console.log("IGDB: token refreshed, expires in", data.expires_in, "s");
    return cachedToken;
  } catch (err) {
    console.error("Twitch OAuth exception:", err);
    return null;
  }
}

async function searchEndpoint(token: string, searchTerm: string, limit: number): Promise<{ ids: number[]; rateLimited: boolean }> {
  const res = await fetchWithRetry("https://api.igdb.com/v4/search", {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: `search "${searchTerm}"; fields game; limit ${limit};`,
  });
  if (res.status === 429) return { ids: [], rateLimited: true };
  if (!res.ok) {
    console.error("IGDB search endpoint error", res.status);
    return { ids: [], rateLimited: false };
  }
  const data = (await res.json()) as Array<{ game?: number | null }>;
  const ids = data
    .map((d) => d.game)
    .filter((id): id is number => typeof id === "number" && !isNaN(id));
  console.log(
    "IGDB search: raw results",
    data.length,
    "→ filtered IDs",
    ids.length,
    "(dropped",
    data.length - ids.length,
    "non-game results)",
  );
  return { ids, rateLimited: false };
}

async function queryIgdb(token: string, bodyStr: string) {
  const igdbRes = await fetchWithRetry("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: bodyStr,
  });

  if (igdbRes.status === 429) return { data: null, rateLimited: true } as const;
  if (!igdbRes.ok) {
    console.error("IGDB API error", igdbRes.status, await igdbRes.text().catch(() => ""));
    return { data: null, rateLimited: false } as const;
  }

  const raw = await igdbRes.json() as Array<{
    id: number; name: string; slug?: string;
    cover?: { url: string };
    platforms?: Array<{ name: string }>;
    genres?: Array<{ name: string }>;
    involved_companies?: Array<{ developer: boolean; publisher: boolean; company: { name: string } }>;
    first_release_date?: number; summary?: string;
  }>;

  return {
    data: raw.map((g) => ({
      igdbId: g.id,
      name: g.name,
      slug: g.slug ?? null,
      coverUrl: g.cover?.url
        ? `https:${g.cover.url}`.replace("t_thumb", "t_cover_big")
        : null,
      platforms: g.platforms?.map((p) => p.name) ?? [],
      genres: g.genres?.map((g2) => g2.name) ?? [],
      publishers: g.involved_companies
        ? [...new Set(g.involved_companies.filter((c) => c.publisher).map((c) => c.company.name))]
        : [],
      developers: g.involved_companies
        ? [...new Set(g.involved_companies.filter((c) => c.developer).map((c) => c.company.name))]
        : [],
      releaseYear: g.first_release_date
        ? new Date(g.first_release_date * 1000).getFullYear()
        : null,
      summary: g.summary ?? null,
    })),
    rateLimited: false,
  } as const;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { query?: string; genre?: string; platform?: string; limit?: number };
  const { query, genre, platform } = body;
  const limit = body.limit ?? 20;
  const hasQuery = query && query.trim().length >= 2;

  const token = await getAccessToken();
  if (!token) {
    console.error("IGDB: no token");
    return NextResponse.json({ offline: true, results: [], error: "Impossible de se connecter à IGDB (token invalide)." });
  }

  type IgdbResult = { igdbId: number; name: string; slug: string | null; coverUrl: string | null; platforms: string[]; genres: string[]; publishers: string[]; developers: string[]; releaseYear: number | null; summary: string | null };

  try {
    // If no filters at all, return popular games
    if (!hasQuery && !genre && !platform) {
      const popularQuery = `where total_rating_count > 50; sort total_rating_count desc; fields ${FIELDS}; limit ${limit};`;
      console.log("IGDB popular:", popularQuery);
      const popular = await queryIgdb(token, popularQuery);
      if (popular.rateLimited) return NextResponse.json({ results: [], rateLimited: true, error: "Limite IGDB atteinte — réessaie dans quelques secondes." });
      const popularResults: IgdbResult[] = popular.data ?? [];
      console.log("IGDB popular: returned", popularResults.length, "results");
      return NextResponse.json({ results: popularResults });
    }

    let results: IgdbResult[] = [];

    // If we have a text query, use the dedicated /v4/search endpoint
    if (hasQuery) {
      console.log("IGDB text search:", query!.trim());
      const { ids: gameIds, rateLimited: searchLimited } = await searchEndpoint(token, query!.trim(), limit);
      if (searchLimited) return NextResponse.json({ results: [], rateLimited: true, error: "Limite IGDB atteinte — réessaie dans quelques secondes." });

      if (gameIds.length > 0) {
        // Fetch full game data for the matched IDs
        const wheresForIds: string[] = [];
        if (genre) wheresForIds.push(`genres.name = "${genre}"`);
        if (platform) wheresForIds.push(`platforms.name = "${platform}"`);

        let queryByIds = `where id = (${gameIds.join(",")}); sort total_rating_count desc; fields ${FIELDS}; limit ${limit};`;
        if (wheresForIds.length > 0) {
          queryByIds = `where id = (${gameIds.join(",")}) & ${wheresForIds.join(" & ")}; sort total_rating_count desc; fields ${FIELDS}; limit ${limit};`;
        }
        console.log("IGDB fetching by IDs:", queryByIds.substring(0, 200));
        const byIds = await queryIgdb(token, queryByIds);
        if (byIds.rateLimited) return NextResponse.json({ results: [], rateLimited: true, error: "Limite IGDB atteinte — réessaie dans quelques secondes." });
        results = byIds.data ?? [];
      }

      // Fallback: if search+fetch returned nothing, try a direct search on the games endpoint
      if (results.length === 0 && !genre && !platform) {
        console.log("IGDB fallback: direct game search for", query!.trim());
        const fallbackQuery = `search "${query!.trim()}"; fields ${FIELDS}; limit ${limit};`;
        const fallback = await queryIgdb(token, fallbackQuery);
        if (!fallback.rateLimited && fallback.data) {
          results = fallback.data;
          console.log("IGDB fallback: returned", results.length, "results");
        }
      }
    } else if (genre || platform) {
      // Genre/platform filters only (no text query)
      const wheres: string[] = [];
      if (genre) wheres.push(`genres.name = "${genre}"`);
      if (platform) wheres.push(`platforms.name = "${platform}"`);
      wheres.push("total_rating_count > 5");

      const bodyStr = `where ${wheres.join(" & ")}; sort total_rating_count desc; fields ${FIELDS}; limit ${limit};`;
      console.log("IGDB filter query:", bodyStr.substring(0, 200));
      const filtered = await queryIgdb(token, bodyStr);
      if (filtered.rateLimited) return NextResponse.json({ results: [], rateLimited: true, error: "Limite IGDB atteinte — réessaie dans quelques secondes." });
      results = filtered.data ?? [];
    }

    console.log("IGDB: returned", results.length, "results");
    return NextResponse.json({ results });
  } catch (err) {
    console.error("IGDB exception:", err);
    return NextResponse.json({ offline: true, results: [], error: "IGDB inaccessible — vérifie ta connexion." });
  }
}
