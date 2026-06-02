export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gunthrankRankings, gunthrankGames } from "@/lib/db/schema";
import { getAuth } from "@/lib/auth";
import { eq, and, or } from "drizzle-orm";
import { headers } from "next/headers";
import { unauthorized } from "@/lib/api-utils";
import { translateToFrench } from "@/lib/translate";

const TIER_ORDER: Record<string, number> = {
  diamond: 0,
  gold: 1,
  silver: 2,
  bronze: 3,
  banger: 4,
  caca: 5,
};

function tierSort(a: typeof gunthrankRankings.$inferSelect, b: typeof gunthrankRankings.$inferSelect): number {
  const oa = TIER_ORDER[a.tier] ?? 99;
  const ob = TIER_ORDER[b.tier] ?? 99;
  if (oa !== ob) return oa - ob;
  return a.sortOrder - b.sortOrder;
}

export async function GET() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return unauthorized();

  const rankings = db()
    .select()
    .from(gunthrankRankings)
    .where(eq(gunthrankRankings.userId, session.user.id))
    .all();

  const gameIds = [...new Set(rankings.map((r) => r.gameId))];
  const games = gameIds.length > 0
    ? db().select().from(gunthrankGames).where(
        (() => {
          // Build OR condition chain for game IDs
          const conds = gameIds.map((id) => eq(gunthrankGames.id, id));
          return conds.length === 1 ? conds[0] : or(...conds);
        })(),
      ).all()
    : [];

  const gameMap = new Map(games.map((g) => [g.id, g]));

  // Backfill French summaries for games that have English but no French translation
  for (const game of games) {
    if (game.summary && !game.summaryFr) {
      const summaryFr = await translateToFrench(game.summary);
      if (summaryFr) {
        db().update(gunthrankGames).set({ summaryFr }).where(eq(gunthrankGames.id, game.id)).run();
        gameMap.set(game.id, { ...game, summaryFr });
      }
    }
  }

  const enriched = rankings
    .map((r) => ({ ...r, game: gameMap.get(r.gameId) ?? null }))
    .sort((a, b) => tierSort(a, b));

  return NextResponse.json({ rankings: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return unauthorized();

  const body = await req.json() as {
    gameId: number;
    tier: string;
    objectiveNote?: number | null;
    noteText?: string | null;
    sortOrder?: number;
    playedOn?: string | null;
  };

  const existing = db()
    .select()
    .from(gunthrankRankings)
    .where(and(eq(gunthrankRankings.userId, session.user.id), eq(gunthrankRankings.gameId, body.gameId)))
    .get();

  if (existing) {
    db()
      .update(gunthrankRankings)
      .set({
        tier: body.tier ?? existing.tier,
        objectiveNote: body.objectiveNote !== undefined ? body.objectiveNote : existing.objectiveNote,
        noteText: body.noteText !== undefined ? body.noteText : existing.noteText,
        playedOn: body.playedOn !== undefined ? body.playedOn : existing.playedOn,
        sortOrder: body.sortOrder ?? existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(gunthrankRankings.id, existing.id))
      .run();
    const updated = db().select().from(gunthrankRankings).where(eq(gunthrankRankings.id, existing.id)).get();
    return NextResponse.json({ ranking: updated });
  }

  const maxOrder = db()
    .select()
    .from(gunthrankRankings)
    .where(and(eq(gunthrankRankings.userId, session.user.id), eq(gunthrankRankings.tier, body.tier)))
    .all()
    .reduce((max, r) => Math.max(max, r.sortOrder), -1);

  const inserted = db()
    .insert(gunthrankRankings)
    .values({
      userId: session.user.id,
      gameId: body.gameId,
      tier: body.tier,
      objectiveNote: body.objectiveNote ?? null,
      noteText: body.noteText ?? null,
      playedOn: body.playedOn ?? null,
      sortOrder: body.sortOrder ?? maxOrder + 1,
    })
    .returning()
    .get();

  return NextResponse.json({ ranking: inserted });
}

export async function DELETE(req: NextRequest) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  db()
    .delete(gunthrankRankings)
    .where(and(eq(gunthrankRankings.userId, session.user.id), eq(gunthrankRankings.gameId, parseInt(gameId, 10))))
    .run();

  return NextResponse.json({ ok: true });
}
