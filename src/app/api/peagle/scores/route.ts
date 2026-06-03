export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { peagleScores, user } from "@/lib/db/schema";
import { getAuth } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

// GET /api/peagle/scores — top 10 leaderboard (best score per user)
export async function GET() {
  try {
    const rows = db()
      .select({
        userId: peagleScores.userId,
        username: user.username,
        displayUsername: user.displayUsername,
        name: user.name,
        score: peagleScores.score,
        won: peagleScores.won,
        createdAt: peagleScores.createdAt,
      })
      .from(peagleScores)
      .innerJoin(user, eq(peagleScores.userId, user.id))
      .orderBy(desc(peagleScores.score))
      .limit(50)
      .all();

    // Keep only best score per user
    const seen = new Set<string>();
    const leaderboard = rows
      .filter((r) => {
        if (seen.has(r.userId)) return false;
        seen.add(r.userId);
        return true;
      })
      .slice(0, 10);

    return NextResponse.json(leaderboard);
  } catch (err) {
    console.error("peagle GET scores error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Score maximum plausible — borne de sanité côté serveur. Le score reste
// client-trusted (pas de re-simulation), mais ce plafond + le rate-limit limitent
// l'abus évident. Si l'équilibrage du jeu évolue, ajuste cette borne.
const MAX_PLAUSIBLE_SCORE = 999999;

// ── Rate limiting en mémoire (fenêtre glissante, par process) ────────────────
// Suffisant pour un OS rétro mono-serveur. Pour du multi-instance il faudrait un
// store partagé (Redis…). Empêche un client authentifié de spammer la table.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const submissionLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const hits = (submissionLog.get(userId) ?? []).filter((t) => t > cutoff);
  if (hits.length >= RATE_MAX) {
    submissionLog.set(userId, hits);
    return true;
  }
  hits.push(now);
  submissionLog.set(userId, hits);
  // Élagage opportuniste pour borner la croissance de la Map.
  if (submissionLog.size > 5000) {
    for (const [uid, ts] of submissionLog) {
      const kept = ts.filter((t) => t > cutoff);
      if (kept.length === 0) submissionLog.delete(uid);
      else submissionLog.set(uid, kept);
    }
  }
  return false;
}

// POST /api/peagle/scores — submit a score (auth required)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId = session.user.id;
    if (isRateLimited(userId)) {
      return NextResponse.json({ error: "Trop de soumissions, réessaie dans un instant." }, { status: 429 });
    }

    const body = await req.json() as { score: number; won: boolean };
    const score = Number(body.score);
    const won = Boolean(body.won);

    if (!Number.isInteger(score) || score < 0 || score > MAX_PLAUSIBLE_SCORE) {
      return NextResponse.json({ error: "Score invalide" }, { status: 400 });
    }

    // Une seule ligne « meilleur score » par joueur : on met à jour si le nouveau
    // score est meilleur (ou si la partie est gagnée pour la 1re fois), sinon on
    // ne touche pas. Évite le gonflement de la table à chaque soumission.
    const existing = db()
      .select({ id: peagleScores.id, score: peagleScores.score, won: peagleScores.won })
      .from(peagleScores)
      .where(eq(peagleScores.userId, userId))
      .orderBy(desc(peagleScores.score))
      .limit(1)
      .get();

    if (!existing) {
      db().insert(peagleScores).values({ userId, score, won }).run();
    } else {
      const bestScore = Math.max(existing.score, score);
      const bestWon = existing.won || won;
      if (bestScore !== existing.score || bestWon !== existing.won) {
        db()
          .update(peagleScores)
          .set({ score: bestScore, won: bestWon, createdAt: new Date() })
          .where(eq(peagleScores.id, existing.id))
          .run();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("peagle POST scores error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
