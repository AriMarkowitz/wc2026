"use client";

import { useEffect, useMemo, useState } from "react";
import type { Club, Player, WcMeta } from "@/types/wc";
import styles from "./wc2026.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "clubs" | "players";
type ClubSort = keyof Club;
type PlayerSort = keyof Player;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return String(v);
}

function fmtDec(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  return (v as number).toFixed(digits);
}


// ---------------------------------------------------------------------------
// SortTh
// ---------------------------------------------------------------------------

function SortTh({
  label, col, current, onSort, title,
}: { label: string; col: string; current: string; onSort: (c: string) => void; title?: string }) {
  const active = current === col;
  return (
    <th
      className={`${styles.sortTh} ${active ? styles.sortThActive : ""}`}
      onClick={() => onSort(col)}
      title={title}
    >
      {label}{active ? " ▼" : ""}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Club table
// ---------------------------------------------------------------------------

const CLUB_COLS: { label: string; col: ClubSort; title?: string; highlight?: boolean }[] = [
  { label: "Players", col: "player_count", title: "Players at World Cup" },
  { label: "Goals",   col: "total_goals" },
  { label: "Assists", col: "total_assists" },
  { label: "G+A",     col: "total_goal_contributions", title: "Total goal contributions" },
  { label: "G+A/90", col: "ga_per_90", highlight: true, title: "Goal contributions per 90 mins — accounts for squad size" },
  { label: "Mins",    col: "total_minutes", title: "Total minutes played" },
  { label: "Yellows", col: "total_yellow_cards" },
  { label: "Reds",    col: "total_red_cards" },
  { label: "Avg Age", col: "avg_age" },
];

function ClubTable({
  clubs, onDrillDown, filterClub, onFilterClub,
}: {
  clubs: Club[];
  onDrillDown: (c: string) => void;
  filterClub: string;
  onFilterClub: (c: string) => void;
}) {
  const [sort, setSort] = useState<ClubSort>("ga_per_90");

  const sorted = useMemo(() =>
    [...clubs].sort((a, b) => ((b[sort] as number) ?? 0) - ((a[sort] as number) ?? 0)),
    [clubs, sort]);

  return (
    <div>
      {filterClub && (
        <div className={styles.drillBanner}>
          Filtered to <strong>{filterClub}</strong>
          <button className={styles.clearBtn} onClick={() => onFilterClub("")}>Clear</button>
        </div>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Club</th>
              {CLUB_COLS.map(({ label, col, title, highlight }) => (
                <SortTh
                  key={`${col}-${label}`}
                  label={label}
                  col={col}
                  current={sort}
                  onSort={(c) => setSort(c as ClubSort)}
                  title={title}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              return (
                <tr key={c.club} className={filterClub === c.club ? styles.rowHighlighted : ""}>
                  <td className={styles.rank}>{i + 1}</td>
                  <td>
                    <button className={styles.clubLink} onClick={() => onDrillDown(c.club)}>
                      {c.club}
                    </button>
                  </td>
                  <td>{c.player_count}</td>
                  <td className={styles.statCell}>{c.total_goals}</td>
                  <td className={styles.statCell}>{c.total_assists}</td>
                  <td className={`${styles.statCell} ${styles.highlight}`}>{c.total_goal_contributions}</td>
                  <td>{c.total_minutes}</td>
                  <td className={styles.highlight}>{fmtDec(c.ga_per_90)}</td>
                  <td>{c.total_yellow_cards}</td>
                  <td>{c.total_red_cards}</td>
                  <td>{fmt(c.avg_age)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player table
// ---------------------------------------------------------------------------

const PLAYER_COLS: { label: string; col: PlayerSort; title?: string; highlight?: boolean }[] = [
  { label: "Goals",    col: "goals" },
  { label: "Assists",  col: "assists" },
  { label: "G+A/90",  col: "goal_contributions_per_90", highlight: true, title: "Goal contributions per 90 min" },
  { label: "Min/G",   col: "goals", title: "Minutes per goal — lower is better" },
  { label: "SOT",     col: "shots_on_target", title: "Shots on target" },
  { label: "Mins",    col: "minutes_played" },
  { label: "YC",      col: "yellow_cards", title: "Yellow cards" },
  { label: "RC",      col: "red_cards", title: "Red cards" },
];

function PlayerTable({
  players, filterClub, onFilterClub, meta,
}: {
  players: Player[];
  filterClub: string;
  onFilterClub: (c: string) => void;
  meta: WcMeta | null;
}) {
  const [sort, setSort] = useState<PlayerSort>("goals");
  const [colFilterClub, setColFilterClub] = useState(filterClub);
  const [colFilterPos, setColFilterPos] = useState("");

  // Sync external club filter into local state
  useEffect(() => { setColFilterClub(filterClub); }, [filterClub]);

  const filtered = useMemo(() => {
    let result = players;
    if (colFilterClub) result = result.filter((p) => p.club === colFilterClub);
    if (colFilterPos)  result = result.filter((p) => p.position === colFilterPos);
    return result;
  }, [players, colFilterClub, colFilterPos]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const av = ((a as unknown as Record<string, unknown>)[sort as string] as number) ?? 0;
      const bv = ((b as unknown as Record<string, unknown>)[sort as string] as number) ?? 0;
      return bv - av;
    }),
    [filtered, sort]);

  function handleColFilterClub(val: string) {
    setColFilterClub(val);
    onFilterClub(val);
  }

  return (
    <div>
      {/* In-table filter row */}
      <div className={styles.tableFilters}>
        <label className={styles.filterLabel}>
          Club
          <select
            value={colFilterClub}
            onChange={(e) => handleColFilterClub(e.target.value)}
            className={styles.select}
          >
            <option value="">All clubs</option>
            {meta?.clubs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className={styles.filterLabel}>
          Position
          <select
            value={colFilterPos}
            onChange={(e) => setColFilterPos(e.target.value)}
            className={styles.select}
          >
            <option value="">All positions</option>
            {meta?.positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        {(colFilterClub || colFilterPos) && (
          <button className={styles.clearBtn} onClick={() => { handleColFilterClub(""); setColFilterPos(""); }}>
            Clear
          </button>
        )}
        <span className={styles.rowCount}>{sorted.length} players</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Club</th>
              <th>Nat.</th>
              <th>Pos.</th>
              <th>Age</th>
              <th>MP</th>
              {PLAYER_COLS.map(({ label, col, title, highlight }) => (
                <SortTh
                  key={`${col}-${label}`}
                  label={label}
                  col={col as string}
                  current={sort as string}
                  onSort={(c) => setSort(c as PlayerSort)}
                  title={title}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.player_id}>
                <td className={styles.rank}>{i + 1}</td>
                <td>{p.name}</td>
                <td>
                  <button
                    className={styles.clubLink}
                    onClick={() => handleColFilterClub(colFilterClub === p.club ? "" : p.club)}
                  >
                    {p.club}
                  </button>
                </td>
                <td>{p.nationality}</td>
                <td>
                  <span className={`${styles.posBadge} ${styles[`pos${p.position}`]}`}>
                    {p.position?.slice(0, 3)}
                  </span>
                </td>
                <td>{fmt(p.age)}</td>
                <td>{p.matches_played}</td>
                <td className={styles.statCell}>{p.goals}</td>
                <td className={styles.statCell}>{p.assists}</td>
                <td className={`${styles.statCell} ${styles.highlight}`}>{fmtDec(p.goal_contributions_per_90)}</td>
                <td>{p.goals ? Math.round(p.minutes_played / p.goals) : "—"}</td>
                <td>{p.shots_on_target}</td>
                <td>{p.minutes_played}</td>
                <td>{p.yellow_cards}</td>
                <td>{p.red_cards}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WC2026Page() {
  const [tab, setTab] = useState<Tab>("clubs");
  const [clubs, setClubs] = useState<Club[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [meta, setMeta] = useState<WcMeta | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [matchesPlayed, setMatchesPlayed] = useState(0);
  const [loading, setLoading] = useState(true);

  // Global filters (nationality + min minutes applied server-side)
  const [filterNat, setFilterNat] = useState("");
  const [filterMinMins, setFilterMinMins] = useState(0);
  // Club filter shared between tabs
  const [filterClub, setFilterClub] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterNat) params.set("nationality", filterNat);
      if (filterMinMins) params.set("min_minutes", String(filterMinMins));

      const [clubsRes, playersRes, metaRes] = await Promise.all([
        fetch(`/api/v1/clubs?${params}`),
        fetch(`/api/v1/players?${params}`),
        fetch("/api/v1/meta"),
      ]);
      const [clubsJson, playersJson, metaJson] = await Promise.all([
        clubsRes.json(),
        playersRes.json(),
        metaRes.json(),
      ]);
      setClubs(clubsJson.response);
      setPlayers(playersJson.response);
      setMeta(metaJson.response);
      setLastUpdated(metaJson.response.last_updated ?? "");
      setMatchesPlayed(metaJson.response.matches_played ?? 0);
      setLoading(false);
    }
    load();
  }, [filterNat, filterMinMins]);

  function handleDrillDown(club: string) {
    setFilterClub(club);
    setTab("players");
  }

  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : "";

  // Derive KPIs from current player list (reflects nationality/min-minutes filters)
  const visiblePlayers = filterClub ? players.filter((p) => p.club === filterClub) : players;
  const totalGoals   = visiblePlayers.reduce((s, p) => s + p.goals, 0);
  const totalAssists = visiblePlayers.reduce((s, p) => s + p.assists, 0);
  const totalYellow  = visiblePlayers.reduce((s, p) => s + p.yellow_cards, 0);
  const totalRed     = visiblePlayers.reduce((s, p) => s + p.red_cards, 0);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>World Cup 2026 — Club Dashboard</h1>
        <p className={styles.subtitle}>
          Which clubs are showing out most? Tracking goals, assists &amp; more by domestic club.
          {updatedStr && <span className={styles.updated}> Updated: {updatedStr}</span>}
        </p>
      </div>

      {/* KPI cards */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardValue}>{matchesPlayed}</div>
          <div className={styles.cardLabel}>Matches played</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{totalGoals}</div>
          <div className={styles.cardLabel}>Goals scored</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{totalAssists}</div>
          <div className={styles.cardLabel}>Assists</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{filterClub ? 1 : clubs.length}</div>
          <div className={styles.cardLabel}>Clubs represented</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{visiblePlayers.length}</div>
          <div className={styles.cardLabel}>Players tracked</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{totalYellow}</div>
          <div className={styles.cardLabel}>Yellow cards</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{totalRed}</div>
          <div className={styles.cardLabel}>Red cards</div>
        </div>
      </div>

      {/* Global filter bar */}
      <div className={styles.filterBar}>
        <label className={styles.filterLabel}>
          Nationality
          <select value={filterNat} onChange={(e) => { setFilterNat(e.target.value); setFilterClub(""); }} className={styles.select}>
            <option value="">All</option>
            {meta?.nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className={styles.filterLabel}>
          Min minutes
          <select value={filterMinMins} onChange={(e) => { setFilterMinMins(Number(e.target.value)); setFilterClub(""); }} className={styles.select}>
            <option value={0}>Any</option>
            <option value={45}>45+</option>
            <option value={90}>90+</option>
            <option value={180}>180+</option>
            <option value={270}>270+</option>
          </select>
        </label>
        {(filterNat || filterMinMins > 0 || filterClub) && (
          <button className={styles.clearBtn} onClick={() => { setFilterNat(""); setFilterMinMins(0); setFilterClub(""); }}>
            Clear all filters
          </button>
        )}
        {filterClub && <span className={styles.activePill}>Club: {filterClub}</span>}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "clubs" ? styles.tabActive : ""}`} onClick={() => setTab("clubs")}>
          Club Rankings
        </button>
        <button className={`${styles.tab} ${tab === "players" ? styles.tabActive : ""}`} onClick={() => setTab("players")}>
          Player Stats
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <div className={styles.tabContent}>
          {tab === "clubs" && (
            <ClubTable
              clubs={clubs}
              onDrillDown={handleDrillDown}
              filterClub={filterClub}
              onFilterClub={setFilterClub}
            />
          )}
          {tab === "players" && (
            <PlayerTable
              players={players}
              filterClub={filterClub}
              onFilterClub={setFilterClub}
              meta={meta}
            />
          )}
        </div>
      )}
    </main>
  );
}
