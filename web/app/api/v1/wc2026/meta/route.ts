import { NextResponse } from "next/server";
import { getMeta } from "@/lib/stores/wc2026";

export async function GET() {
  const meta = await getMeta();
  return NextResponse.json({ response: meta });
}
