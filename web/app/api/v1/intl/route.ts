import { NextResponse, type NextRequest } from "next/server";
import { getIntlWindow } from "@/lib/stores/intl";

// ?window=2026-09 | all — defaults to the latest window with matches.
export async function GET(req: NextRequest) {
  const data = await getIntlWindow(req.nextUrl.searchParams.get("window"));
  return NextResponse.json({ response: data });
}
