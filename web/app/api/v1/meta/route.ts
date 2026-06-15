import { NextResponse } from "next/server";
import { getMeta } from "@/lib/wc-store";

export async function GET() {
  const meta = await getMeta();
  return NextResponse.json({ response: meta });
}
