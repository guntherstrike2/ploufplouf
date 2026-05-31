export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gunthrankGames } from "@/lib/db/schema";
import { getAuth } from "@/lib/auth";
import { eq, like } from "drizzle-orm";
import { headers } from "next/headers";
import { unauthorized } from "@/lib/api-utils";
import { translateToFrench } from "@/lib/translate";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (q && q.length >= 2) {
    const results = db()
      .select()
      .from(gunthrankGames)
      .where(like(gunthrankGames.name, `%${q}%`))
      .limit(20)
      .all();
    return NextResponse.json({ games: results });
  }
  const all = db().select().from(gunthrankGames).all();
  return NextResponse.json({ games: all });
}

export async function POST(req: NextRequest) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return unauthorized();

  const body = await req.json() as {
    igdbId?: number | null;
    name: string;
    slug?: string | null;
    coverUrl?: string | null;
    platforms?: string[] | null;
    genres?: string[] | null;
    releaseDate?: number | null;
    summary?: string | null;
    videos?: Array<{ videoId: string; name: string | null }> | null;
  };

  // Check for existing game by igdbId or name — update videos if new data available
  if (body.igdbId) {
    const existing = db().select().from(gunthrankGames).where(eq(gunthrankGames.igdbId, body.igdbId)).get();
    if (existing) {
      // Merge in videos if the existing record doesn't have them yet
      if (body.videos?.length && !existing.videos) {
        db().update(gunthrankGames).set({ videos: JSON.stringify(body.videos) }).where(eq(gunthrankGames.id, existing.id)).run();
        return NextResponse.json({ game: { ...existing, videos: JSON.stringify(body.videos) } });
      }
      return NextResponse.json({ game: existing });
    }
  }
  const byName = db().select().from(gunthrankGames).where(eq(gunthrankGames.name, body.name)).get();
  if (byName) {
    if (body.videos?.length && !byName.videos) {
      db().update(gunthrankGames).set({ videos: JSON.stringify(body.videos) }).where(eq(gunthrankGames.id, byName.id)).run();
      return NextResponse.json({ game: { ...byName, videos: JSON.stringify(body.videos) } });
    }
    return NextResponse.json({ game: byName });
  }

  // Translate summary to French
  const summaryFr = body.summary ? await translateToFrench(body.summary) : null;

  const inserted = db()
    .insert(gunthrankGames)
    .values({
      igdbId: body.igdbId ?? null,
      name: body.name,
      slug: body.slug ?? null,
      coverUrl: body.coverUrl ?? null,
      platforms: body.platforms ? JSON.stringify(body.platforms) : null,
      genres: body.genres ? JSON.stringify(body.genres) : null,
      releaseDate: body.releaseDate ?? null,
      summary: body.summary ?? null,
      summaryFr,
      videos: body.videos ? JSON.stringify(body.videos) : null,
    })
    .returning()
    .get();

  return NextResponse.json({ game: inserted });
}
