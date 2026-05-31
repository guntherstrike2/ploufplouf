import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { broadcastToRoom } from "@/lib/meet-rooms";
import type { SseEvent, ReactionEmoji } from "@/apps/gunth-meet/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_EMOJIS: ReactionEmoji[] = ["👍", "👏", "✋", "❤️", "😂"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await params;
  const body = await req.json();
  const { emoji } = body as { emoji: unknown };

  if (!emoji || !VALID_EMOJIS.includes(emoji as ReactionEmoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  const reaction = {
    userId: session.user.id,
    displayName: session.user.name ?? session.user.email ?? session.user.id,
    emoji: emoji as ReactionEmoji,
    id: `${Date.now()}-${session.user.id}`,
  };

  const event: SseEvent = { kind: "reaction", reaction };
  broadcastToRoom(roomId, event);

  return NextResponse.json({ ok: true });
}
