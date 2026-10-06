import fs from "fs/promises";
import path from "path";
import type { IntlData } from "@/types/intl";

// Written by scripts/fetch_intl.py — independent of the World Cup data file.
const DATA_FILE = path.resolve(process.cwd(), "data/intl.json");

export async function getIntlData(): Promise<IntlData> {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as IntlData;
}

/**
 * One window's rows (or "all"), so the browser doesn't download the whole
 * season. No window given → the most recent window that has matches.
 */
export async function getIntlWindow(window?: string | null): Promise<IntlData & { selected: string }> {
  const data = await getIntlData();
  const latest = [...data.windows].reverse().find((w) => w.matches > 0)?.id ?? "all";
  const selected = window && (window === "all" || data.windows.some((w) => w.id === window)) ? window : latest;
  if (selected === "all") return { ...data, selected };
  const inWin = <T extends { window: string }>(rows: T[]) => rows.filter((r) => r.window === selected);
  return {
    ...data,
    selected,
    matches: inWin(data.matches),
    appearances: inWin(data.appearances),
    injuries: inWin(data.injuries),
  };
}
