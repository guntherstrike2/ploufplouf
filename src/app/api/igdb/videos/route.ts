export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = "064v7k0pvgi3glsje5mkm3b8x5qeu7";
const CLIENT_SECRET = "qwza7uzglo1zmsvxcz032e5x6xcjjr";

let cachedToken: string | null = null;
let cachedExpiresAt = 0;

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
    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = data.access_token;
    cachedExpiresAt = Date.now() + (data.expires_in ?? 86400) * 1000;
    return cachedToken as string;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const igdbId = req.nextUrl.searchParams.get("igdbId");
  if (!igdbId) return NextResponse.json({ videos: [] });

  const token = await getAccessToken();
  if (!token) return NextResponse.json({ videos: [] });

  try {
    const res = await fetchWithRetry("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `where id = ${igdbId}; fields videos.video_id,videos.name; limit 1;`,
    });

    const data = await res.json() as Array<{ videos?: Array<{ video_id: string; name?: string }> }>;
    const videos = data[0]?.videos?.map((v) => ({
      videoId: v.video_id,
      name: v.name ?? null,
    })) ?? [];

    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ videos: [] });
  }
}
