import { NextResponse } from "next/server";
import { getTimeseries } from "@/lib/wc-store";

export async function GET() {
  const data = await getTimeseries();
  return NextResponse.json({ response: data });
}
