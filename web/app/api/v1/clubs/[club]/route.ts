import { NextRequest, NextResponse } from "next/server";
import { getClubPlayers } from "@/lib/wc-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ club: string }> }
) {
  const { club } = await params;
  const players = await getClubPlayers(decodeURIComponent(club));
  return NextResponse.json({ response: players });
}
