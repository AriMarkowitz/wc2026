import fs from "fs/promises";
import path from "path";
import type { Club, Player, WcData, WcMeta } from "@/types/wc";

// In dev: process.cwd() is wc2026/web/, data is at wc2026/web/data/wc2026.json
// On Vercel: root is wc2026/web/, same relative path works
const DATA_FILE = path.resolve(process.cwd(), "data/wc2026.json");

async function loadData(): Promise<WcData> {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as WcData;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface PlayerFilters {
  club?: string;
  nationality?: string;
  position?: string;
  min_age?: number;
  max_age?: number;
  min_minutes?: number;
  sort?: string;
  limit?: number;
}

export interface ClubFilters {
  nationality?: string;
  position?: string;
  sort?: string;
}

function applyPlayerFilters(players: Player[], f: PlayerFilters): Player[] {
  let result = players;
  if (f.club) result = result.filter((p) => p.club === f.club);
  if (f.nationality) result = result.filter((p) => p.nationality === f.nationality);
  if (f.position) result = result.filter((p) => p.position === f.position);
  if (f.min_age != null) result = result.filter((p) => (p.age ?? 0) >= f.min_age!);
  if (f.max_age != null) result = result.filter((p) => (p.age ?? 999) <= f.max_age!);
  if (f.min_minutes != null) result = result.filter((p) => p.minutes_played >= f.min_minutes!);

  const sortKey = f.sort ?? "goals";
  result = [...result].sort((a, b) => {
    const av = ((a as unknown as Record<string, unknown>)[sortKey] as number) ?? 0;
    const bv = ((b as unknown as Record<string, unknown>)[sortKey] as number) ?? 0;
    return bv - av;
  });

  if (f.limit) result = result.slice(0, f.limit);
  return result;
}

// For club filters we re-derive totals from the matching player subset
function deriveClubTotals(players: Player[]): Club[] {
  const map = new Map<string, Player[]>();
  for (const p of players) {
    if (!map.has(p.club)) map.set(p.club, []);
    map.get(p.club)!.push(p);
  }
  const clubs: Club[] = [];
  for (const [club, ps] of map.entries()) {
    const ages = ps.map((p) => p.age).filter((a): a is number => a != null);
    const totalMins = ps.reduce((s, p) => s + p.minutes_played, 0);
    const totalGa   = ps.reduce((s, p) => s + p.goals + p.assists, 0);
    clubs.push({
      club,
      player_count: ps.length,
      total_goals: ps.reduce((s, p) => s + p.goals, 0),
      total_assists: ps.reduce((s, p) => s + p.assists, 0),
      total_goal_contributions: totalGa,
      total_minutes: totalMins,
      total_yellow_cards: ps.reduce((s, p) => s + p.yellow_cards, 0),
      total_red_cards: ps.reduce((s, p) => s + p.red_cards, 0),
      avg_age: ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null,
      ga_per_90: totalMins > 0 ? Math.round((totalGa / totalMins) * 90 * 100) / 100 : null,
      players: ps.map((p) => p.name),
    });
  }
  return clubs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getPlayers(filters: PlayerFilters = {}): Promise<Player[]> {
  const data = await loadData();
  return applyPlayerFilters(data.players, filters);
}

export async function getClubs(filters: ClubFilters = {}): Promise<Club[]> {
  const data = await loadData();
  let players = data.players;
  if (filters.nationality) players = players.filter((p) => p.nationality === filters.nationality);
  if (filters.position) players = players.filter((p) => p.position === filters.position);

  const clubs = deriveClubTotals(players);
  const sortKey = (filters.sort ?? "total_goal_contributions") as keyof Club;
  return clubs.sort((a, b) => ((b[sortKey] as number) ?? 0) - ((a[sortKey] as number) ?? 0));
}

export async function getClubPlayers(club: string): Promise<Player[]> {
  const data = await loadData();
  return data.players.filter((p) => p.club === club).sort((a, b) => b.goals - a.goals);
}

export async function getMeta(): Promise<WcMeta & { last_updated: string; matches_played: number; total_goals: number; total_assists: number; yellow_cards: number; red_cards: number }> {
  const data = await loadData();
  const matchStats = ((data as unknown) as Record<string, unknown>).match_stats as Record<string, unknown[]> ?? {};
  return {
    ...data.meta,
    last_updated: data.last_updated,
    matches_played: Object.keys(matchStats).length,
    total_goals: data.players.reduce((s, p) => s + p.goals, 0),
    total_assists: data.players.reduce((s, p) => s + p.assists, 0),
    yellow_cards: data.players.reduce((s, p) => s + p.yellow_cards, 0),
    red_cards: data.players.reduce((s, p) => s + p.red_cards, 0),
  };
}
