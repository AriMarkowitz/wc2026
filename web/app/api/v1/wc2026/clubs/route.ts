import { NextRequest, NextResponse } from "next/server";
import { getClubs } from "@/lib/stores/wc2026";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clubs = await getClubs({
    nationality: searchParams.get("nationality") ?? undefined,
    position: searchParams.get("position") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  });
  return NextResponse.json({ response: clubs });
}
