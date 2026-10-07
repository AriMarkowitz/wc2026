import fs from "fs/promises";
import path from "path";
import type { IntlData, IntlRace } from "@/types/intl";

// Written by scripts/fetch_intl.py — independent of the World Cup data file.
const DATA_FILE = path.resolve(process.cwd(), "data/intl.json");

export async function getIntlData(): Promise<IntlData> {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const data = JSON.parse(raw) as IntlData;
  // ESPN lists the national team as the "club" for players it has no club for.
  // The pipeline already drops these; this also covers data fetched before that fix.
  const nationalTeams = new Set(data.matches.flatMap((m) => m.teams));
  const declub = <T extends { club: string; league: string | null }>(r: T): T =>
    nationalTeams.has(r.club) ? { ...r, club: "Unknown", league: null } : r;
  return { ...data, appearances: data.appearances.map(declub), injuries: data.injuries.map(declub) };
}

/**
 * One window's rows (or "all"), so the browser doesn't download the whole
 * season. No window given → the most recent window that has matches.
 */
export async function getIntlWindow(
  window?: string | null,
): Promise<Omit<IntlData, "timeseries"> & { selected: string; race: IntlRace | null }> {
  const { timeseries, ...data } = await getIntlData();
  const latest = [...data.windows].reverse().find((w) => w.matches > 0)?.id ?? "all";
  const selected = window && (window === "all" || data.windows.some((w) => w.id === window)) ? window : latest;
  const race = timeseries?.[selected] ?? null;
  if (selected === "all") return { ...data, selected, race };
  const inWin = <T extends { window: string }>(rows: T[]) => rows.filter((r) => r.window === selected);
  return {
    ...data,
    selected,
    race,
    matches: inWin(data.matches),
    appearances: inWin(data.appearances),
    injuries: inWin(data.injuries),
  };
}
