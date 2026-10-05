import { NextResponse } from "next/server";
import { getTimeseries } from "@/lib/stores/wc2026";

export async function GET() {
  const data = await getTimeseries();
  return NextResponse.json({ response: data });
}
