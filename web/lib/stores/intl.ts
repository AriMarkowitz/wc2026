import fs from "fs/promises";
import path from "path";
import type { IntlData } from "@/types/intl";

// Written by scripts/fetch_intl.py — independent of the World Cup data file.
const DATA_FILE = path.resolve(process.cwd(), "data/intl.json");

export async function getIntlData(): Promise<IntlData> {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as IntlData;
}
