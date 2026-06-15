import { NextRequest, NextResponse } from "next/server";
import { getPlayers } from "@/lib/wc-store";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const players = await getPlayers({
    club: searchParams.get("club") ?? undefined,
    nationality: searchParams.get("nationality") ?? undefined,
    position: searchParams.get("position") ?? undefined,
    min_minutes: searchParams.get("min_minutes") ? Number(searchParams.get("min_minutes")) : undefined,
    sort: "assists",
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 10,
  });
  return NextResponse.json({ response: players });
}
