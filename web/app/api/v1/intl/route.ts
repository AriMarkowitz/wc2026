import { NextResponse } from "next/server";
import { getIntlData } from "@/lib/stores/intl";

export async function GET() {
  const data = await getIntlData();
  return NextResponse.json({ response: data });
}
