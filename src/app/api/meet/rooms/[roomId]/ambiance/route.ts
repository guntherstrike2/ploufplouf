import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { broadcastToRoom } from "@/lib/meet-rooms";
import type { SseEvent } from "@/apps/gunth-meet/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_SAMPLE_IDS = new Set(["rain", "fire", "cafe", "lofi", "space"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId } = await params;
  const body = await req.json();
  const { sampleId } = body as { sampleId: unknown };

  if (sampleId !== null && (typeof sampleId !== "string" || !VALID_SAMPLE_IDS.has(sampleId))) {
    return NextResponse.json({ error: "Invalid sampleId" }, { status: 400 });
  }

  const event: SseEvent = {
    kind: "ambiance-sync",
    sampleId: sampleId ?? null,
    displayName: session.user.name ?? session.user.email ?? session.user.id,
  };

  broadcastToRoom(roomId, event, session.user.id);

  return NextResponse.json({ ok: true });
}
