import { NextRequest, NextResponse } from "next/server";
import { getPlayers } from "@/lib/wc-store";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const players = await getPlayers({
    club: searchParams.get("club") ?? undefined,
    nationality: searchParams.get("nationality") ?? undefined,
    position: searchParams.get("position") ?? undefined,
    min_age: searchParams.get("min_age") ? Number(searchParams.get("min_age")) : undefined,
    max_age: searchParams.get("max_age") ? Number(searchParams.get("max_age")) : undefined,
    min_minutes: searchParams.get("min_minutes") ? Number(searchParams.get("min_minutes")) : undefined,
    sort: searchParams.get("sort") ?? undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  });
  return NextResponse.json({ response: players });
}
