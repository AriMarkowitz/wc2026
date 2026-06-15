"use client";

import { useEffect, useMemo, useState } from "react";
import type { Club, Player, WcMeta } from "@/types/wc";
import styles from "./wc2026.module.css";
import FilterHeader from "./FilterHeader";
import { useColumnResize } from "./useColumnResize";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "clubs" | "players" | "astro";

const SIGN_EMOJI: Record<string, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋",
  Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏",
  Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

const ALL_SIGNS = [
  "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces",
];

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

function posBadgeClass(pos: string): string {
  if (pos === "Goalkeeper") return styles.posGoalkeeper;
  if (pos === "Defender")   return styles.posDefender;
  if (pos === "Midfielder") return styles.posMidfielder;
  if (pos === "Forward")    return styles.posForward;
  return "";
}

function distinct<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// ---------------------------------------------------------------------------
// Plain sortable numeric header
// ---------------------------------------------------------------------------

function SortTh({
  label, active, onSort, title,
}: { label: string; active: boolean; onSort: () => void; title?: string }) {
  return (
    <span
      className={`${styles.thLabel} ${active ? styles.sortThActive : ""}`}
      onClick={onSort}
      title={title}
    >
      {label}{active && <span className={styles.sortArrow}> ▼</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Club table
// ---------------------------------------------------------------------------

function ClubTable({
  clubs, meta, onDrillDown,
}: {
  clubs: Club[];
  meta: WcMeta | null;
  onDrillDown: (c: string) => void;
}) {
  const [sort, setSort] = useState<keyof Club>("total_goals");
  const [fClub, setFClub] = useState<Set<string>>(new Set());
  const [fLeague, setFLeague] = useState<Set<string>>(new Set());

  const { widths, startResize } = useColumnResize({
    rank: 48, club: 180, players: 80, goals: 70, assists: 80, ga: 70,
    g90: 70, a90: 70, ga90: 84, mins: 80, yc: 60, rc: 60, age: 80,
  });

  const filtered = useMemo(() => {
    let r = clubs;
    if (fClub.size)   r = r.filter((c) => fClub.has(c.club));
    if (fLeague.size) r = r.filter((c) => c.league && fLeague.has(c.league));
    return r;
  }, [clubs, fClub, fLeague]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => ((b[sort] as number) ?? -1) - ((a[sort] as number) ?? -1)),
    [filtered, sort]);

  const numCols: { key: string; label: string; col: keyof Club; title?: string; accent?: boolean; dec?: boolean }[] = [
    { key: "players", label: "Players", col: "player_count", title: "Players at the World Cup from this club" },
    { key: "goals",   label: "Goals",   col: "total_goals" },
    { key: "assists", label: "Assists", col: "total_assists" },
    { key: "ga",      label: "G+A",     col: "total_goal_contributions", title: "Total goal contributions" },
    { key: "g90",     label: "G/90",    col: "goals_per_90", dec: true, title: "Goals per 90 (all squad minutes)" },
    { key: "a90",     label: "A/90",    col: "assists_per_90", dec: true, title: "Assists per 90 (all squad minutes)" },
    { key: "ga90",    label: "G+A/90",  col: "ga_per_90", dec: true, accent: true, title: "Goal contributions per 90 — accounts for squad minutes" },
    { key: "mins",    label: "Mins",    col: "total_minutes", title: "Total player-minutes" },
    { key: "yc",      label: "YC",      col: "total_yellow_cards", title: "Yellow cards" },
    { key: "rc",      label: "RC",      col: "total_red_cards", title: "Red cards" },
    { key: "age",     label: "Avg Age", col: "avg_age" },
  ];

  const clubOptions = meta?.clubs ?? distinct(clubs.map((c) => c.club)).sort();
  const leagueOptions = meta?.leagues ?? distinct(clubs.map((c) => c.league).filter(Boolean) as string[]).sort();

  return (
    <div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: widths.rank }} />
            <col style={{ width: widths.club }} />
            {numCols.map((c) => <col key={c.key} style={{ width: widths[c.key] }} />)}
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th className={styles.thResizable}>
                <FilterHeader
                  label="Club"
                  options={clubOptions}
                  selected={fClub}
                  onChange={setFClub}
                  sortActive={false}
                  onSort={() => {}}
                  title="Hover a club name to see its league"
                />
                <span className={styles.resizeHandle} onPointerDown={startResize("club")} />
              </th>
              {numCols.map((c) => (
                <th key={c.key} className={styles.thResizable}>
                  {c.key === "players" ? (
                    <div className={styles.thInner}>
                      <SortTh label={c.label} active={sort === c.col} onSort={() => setSort(c.col)} title={c.title} />
                      <FilterHeader
                        label="League"
                        options={leagueOptions}
                        selected={fLeague}
                        onChange={setFLeague}
                        sortActive={false}
                        onSort={() => {}}
                        title="Filter by league"
                      />
                    </div>
                  ) : (
                    <SortTh label={c.label} active={sort === c.col} onSort={() => setSort(c.col)} title={c.title} />
                  )}
                  <span className={styles.resizeHandle} onPointerDown={startResize(c.key)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={c.club}>
                <td className={styles.rank}>{i + 1}</td>
                <td className={styles.wrap}>
                  <button
                    className={styles.clubLink}
                    onClick={() => onDrillDown(c.club)}
                    title={c.league ? `${c.club} · ${c.league}` : c.club}
                  >
                    {c.club}
                  </button>
                </td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.player_count}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.total_goals}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.total_assists}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.total_goal_contributions}</td>
                <td className={styles.nowrap}>{fmtDec(c.goals_per_90)}</td>
                <td className={styles.nowrap}>{fmtDec(c.assists_per_90)}</td>
                <td className={`${styles.statCellAccent} ${styles.nowrap}`}>{fmtDec(c.ga_per_90)}</td>
                <td className={styles.nowrap}>{c.total_minutes}</td>
                <td className={styles.nowrap}>{c.total_yellow_cards}</td>
                <td className={styles.nowrap}>{c.total_red_cards}</td>
                <td className={styles.nowrap}>{fmt(c.avg_age)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableMeta}>{sorted.length} clubs</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player table
// ---------------------------------------------------------------------------

type PlayerSort = keyof Player | "min_per_goal";

function PlayerTable({
  players, meta, fClub, setFClub,
}: {
  players: Player[];
  meta: WcMeta | null;
  fClub: Set<string>;
  setFClub: (s: Set<string>) => void;
}) {
  const [sort, setSort] = useState<PlayerSort>("goals");
  const [fLeague, setFLeague] = useState<Set<string>>(new Set());
  const [fNat, setFNat] = useState<Set<string>>(new Set());
  const [fPos, setFPos] = useState<Set<string>>(new Set());
  const [fSign, setFSign] = useState<Set<string>>(new Set());

  const { widths, startResize } = useColumnResize({
    rank: 48, name: 170, club: 150, nat: 120, pos: 70, age: 56, sign: 110,
    mp: 50, goals: 64, assists: 76, ga90: 80, mpg: 72, sot: 56, mins: 64, yc: 50, rc: 50,
  });

  const filtered = useMemo(() => {
    let r = players;
    if (fClub.size)   r = r.filter((p) => fClub.has(p.club));
    if (fLeague.size) r = r.filter((p) => p.league && fLeague.has(p.league));
    if (fNat.size)    r = r.filter((p) => fNat.has(p.nationality));
    if (fPos.size)    r = r.filter((p) => fPos.has(p.position));
    if (fSign.size)   r = r.filter((p) => p.sun_sign && fSign.has(p.sun_sign));
    return r;
  }, [players, fClub, fLeague, fNat, fPos, fSign]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      if (sort === "min_per_goal") {
        const av = a.goals ? a.minutes_played / a.goals : Infinity;
        const bv = b.goals ? b.minutes_played / b.goals : Infinity;
        return av - bv;
      }
      const av = ((a as unknown as Record<string, unknown>)[sort as string] as number) ?? 0;
      const bv = ((b as unknown as Record<string, unknown>)[sort as string] as number) ?? 0;
      return bv - av;
    }),
    [filtered, sort]);

  const clubOptions   = meta?.clubs ?? distinct(players.map((p) => p.club)).sort();
  const leagueOptions = meta?.leagues ?? distinct(players.map((p) => p.league).filter(Boolean) as string[]).sort();
  const natOptions    = meta?.nationalities ?? distinct(players.map((p) => p.nationality)).sort();
  const posOptions    = meta?.positions ?? distinct(players.map((p) => p.position)).sort();

  const numCols: { key: string; label: string; col: PlayerSort; title?: string; accent?: boolean }[] = [
    { key: "mp",     label: "MP",     col: "matches_played", title: "Matches played" },
    { key: "goals",  label: "Goals",  col: "goals" },
    { key: "assists",label: "Assists",col: "assists" },
    { key: "ga90",   label: "G+A/90", col: "goal_contributions_per_90", accent: true, title: "Goal contributions per 90" },
    { key: "mpg",    label: "Min/G",  col: "min_per_goal", title: "Minutes per goal — lower is better" },
    { key: "sot",    label: "SOT",    col: "shots_on_target", title: "Shots on target" },
    { key: "mins",   label: "Mins",   col: "minutes_played" },
    { key: "yc",     label: "YC",     col: "yellow_cards", title: "Yellow cards" },
    { key: "rc",     label: "RC",     col: "red_cards", title: "Red cards" },
  ];

  const anyFilter = fClub.size || fLeague.size || fNat.size || fPos.size || fSign.size;

  return (
    <div>
      {anyFilter ? (
        <div className={styles.activeFilterRow}>
          {fClub.size > 0 && <span className={styles.activePill}>Club: {[...fClub].join(", ")}</span>}
          {fLeague.size > 0 && <span className={styles.activePill}>League: {[...fLeague].join(", ")}</span>}
          {fNat.size > 0 && <span className={styles.activePill}>Nat: {[...fNat].join(", ")}</span>}
          {fPos.size > 0 && <span className={styles.activePill}>Pos: {[...fPos].join(", ")}</span>}
          {fSign.size > 0 && <span className={styles.activePill}>Sign: {[...fSign].join(", ")}</span>}
          <button
            className={styles.clearBtn}
            onClick={() => { setFClub(new Set()); setFLeague(new Set()); setFNat(new Set()); setFPos(new Set()); setFSign(new Set()); }}
          >
            Clear filters
          </button>
        </div>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: widths.rank }} />
            <col style={{ width: widths.name }} />
            <col style={{ width: widths.club }} />
            <col style={{ width: widths.nat }} />
            <col style={{ width: widths.pos }} />
            <col style={{ width: widths.age }} />
            <col style={{ width: widths.sign }} />
            {numCols.map((c) => <col key={c.key} style={{ width: widths[c.key] }} />)}
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th className={styles.thResizable}>
                <SortTh label="Player" active={sort === "name"} onSort={() => setSort("name" as PlayerSort)} />
                <span className={styles.resizeHandle} onPointerDown={startResize("name")} />
              </th>
              <th className={styles.thResizable}>
                <div className={styles.thInner}>
                  <FilterHeader label="Club" options={clubOptions} selected={fClub} onChange={setFClub} sortActive={false} onSort={() => {}} />
                  <FilterHeader label="League" options={leagueOptions} selected={fLeague} onChange={setFLeague} sortActive={false} onSort={() => {}} title="Filter by league" />
                </div>
                <span className={styles.resizeHandle} onPointerDown={startResize("club")} />
              </th>
              <th className={styles.thResizable}>
                <FilterHeader label="Nat." options={natOptions} selected={fNat} onChange={setFNat} sortActive={false} onSort={() => {}} />
                <span className={styles.resizeHandle} onPointerDown={startResize("nat")} />
              </th>
              <th className={styles.thResizable}>
                <FilterHeader label="Pos." options={posOptions} selected={fPos} onChange={setFPos} sortActive={false} onSort={() => {}} />
                <span className={styles.resizeHandle} onPointerDown={startResize("pos")} />
              </th>
              <th className={styles.thResizable}>
                <SortTh label="Age" active={sort === "age"} onSort={() => setSort("age" as PlayerSort)} />
                <span className={styles.resizeHandle} onPointerDown={startResize("age")} />
              </th>
              <th className={styles.thResizable}>
                <FilterHeader
                  label="Sign"
                  options={ALL_SIGNS}
                  selected={fSign}
                  onChange={setFSign}
                  sortActive={false}
                  onSort={() => {}}
                  renderOption={(s) => `${SIGN_EMOJI[s] ?? ""} ${s}`}
                />
                <span className={styles.resizeHandle} onPointerDown={startResize("sign")} />
              </th>
              {numCols.map((c) => (
                <th key={c.key} className={styles.thResizable}>
                  <SortTh label={c.label} active={sort === c.col} onSort={() => setSort(c.col)} title={c.title} />
                  <span className={styles.resizeHandle} onPointerDown={startResize(c.key)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.player_id}>
                <td className={styles.rank}>{i + 1}</td>
                <td className={`${styles.statCell} ${styles.wrap}`}>{p.name}</td>
                <td className={styles.wrap}>
                  <button
                    className={styles.clubLink}
                    onClick={() => setFClub(fClub.has(p.club) ? new Set() : new Set([p.club]))}
                    title={p.league ? `${p.club} · ${p.league}` : p.club}
                  >
                    {p.club}
                  </button>
                </td>
                <td className={styles.wrap}>{p.nationality}</td>
                <td className={styles.nowrap}>
                  <span className={`${styles.posBadge} ${posBadgeClass(p.position)}`}>
                    {p.position?.slice(0, 3)}
                  </span>
                </td>
                <td className={styles.nowrap}>{fmt(p.age)}</td>
                <td className={styles.nowrap}>
                  {p.sun_sign ? (
                    <span className={styles.signBadge} title={p.sun_sign}>
                      {SIGN_EMOJI[p.sun_sign] ?? ""} {p.sun_sign}
                    </span>
                  ) : "—"}
                </td>
                <td className={styles.nowrap}>{p.matches_played}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{p.goals}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{p.assists}</td>
                <td className={`${styles.statCellAccent} ${styles.nowrap}`}>{fmtDec(p.goal_contributions_per_90)}</td>
                <td className={styles.nowrap}>{p.goals ? Math.round(p.minutes_played / p.goals) : "—"}</td>
                <td className={styles.nowrap}>{p.shots_on_target}</td>
                <td className={styles.nowrap}>{p.minutes_played}</td>
                <td className={styles.nowrap}>{p.yellow_cards}</td>
                <td className={styles.nowrap}>{p.red_cards}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableMeta}>{sorted.length} players</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Astrology table
// ---------------------------------------------------------------------------

function AstroTable({ players }: { players: Player[] }) {
  const [sort, setSort] = useState<string>("ga_per_90");

  const rows = useMemo(() => {
    return ALL_SIGNS.map((sign) => {
      const group = players.filter((p) => p.sun_sign === sign);
      const count   = group.length;
      const goals   = group.reduce((s, p) => s + p.goals, 0);
      const assists = group.reduce((s, p) => s + p.assists, 0);
      const mins    = group.reduce((s, p) => s + p.minutes_played, 0);
      const ga      = goals + assists;
      const ga_per_90 = mins > 0 ? Math.round((ga / mins) * 90 * 100) / 100 : 0;
      const g_per_player = count ? Math.round((goals / count) * 100) / 100 : 0;
      const top = [...group].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))[0];
      return { sign, count, goals, assists, ga, mins, ga_per_90, g_per_player, top };
    }).filter((r) => r.count > 0);
  }, [players]);

  const sorted = useMemo(() =>
    [...rows].sort((a, b) => ((b as unknown as Record<string, number>)[sort] ?? 0) - ((a as unknown as Record<string, number>)[sort] ?? 0)),
    [rows, sort]);

  const cols: { key: string; label: string; title?: string; accent?: boolean }[] = [
    { key: "count",        label: "Players" },
    { key: "goals",        label: "Goals" },
    { key: "assists",      label: "Assists" },
    { key: "ga",           label: "G+A" },
    { key: "ga_per_90",    label: "G+A/90", accent: true, title: "Goal contributions per 90 across all players of this sign" },
    { key: "g_per_player", label: "G/Player", title: "Average goals per player" },
    { key: "mins",         label: "Mins" },
  ];

  return (
    <div>
      <p className={styles.astroIntro}>
        Which star signs are outscoring the zodiac? Ranked by goal contributions per 90 minutes. Click any header to sort. Pure vibes.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table} style={{ tableLayout: "auto" }}>
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th style={{ width: 160 }}>Sign</th>
              {cols.map((c) => (
                <th key={c.key}>
                  <SortTh label={c.label} active={sort === c.key} onSort={() => setSort(c.key)} title={c.title} />
                </th>
              ))}
              <th>Top Performer</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.sign}>
                <td className={styles.rank}>{i + 1}</td>
                <td className={styles.statCell}>
                  <span className={styles.signEmoji} style={{ fontSize: "1.1rem" }}>{SIGN_EMOJI[r.sign]}</span>{" "}
                  {r.sign}
                </td>
                <td>{r.count}</td>
                <td className={styles.statCell}>{r.goals}</td>
                <td className={styles.statCell}>{r.assists}</td>
                <td className={styles.statCell}>{r.ga}</td>
                <td className={styles.statCellAccent}>{r.ga_per_90.toFixed(2)}</td>
                <td>{r.g_per_player.toFixed(2)}</td>
                <td>{r.mins}</td>
                <td className={styles.wrap}>
                  {r.top ? (
                    <span>
                      {r.top.name} <span style={{ color: "var(--accent)" }}>({r.top.goals}G {r.top.assists}A)</span>
                    </span>
                  ) : "—"}
                </td>
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
  const [playerClubFilter, setPlayerClubFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [clubsRes, playersRes, metaRes] = await Promise.all([
        fetch("/api/v1/clubs"),
        fetch("/api/v1/players"),
        fetch("/api/v1/meta"),
      ]);
      const [clubsJson, playersJson, metaJson] = await Promise.all([
        clubsRes.json(), playersRes.json(), metaRes.json(),
      ]);
      setClubs(clubsJson.response);
      setPlayers(playersJson.response);
      setMeta(metaJson.response);
      setLastUpdated(metaJson.response.last_updated ?? "");
      setMatchesPlayed(metaJson.response.matches_played ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  function handleDrillDown(club: string) {
    setPlayerClubFilter(new Set([club]));
    setTab("players");
  }

  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : "";

  const totalGoals   = players.reduce((s, p) => s + p.goals, 0);
  const totalAssists = players.reduce((s, p) => s + p.assists, 0);
  const totalYellow  = players.reduce((s, p) => s + p.yellow_cards, 0);
  const totalRed     = players.reduce((s, p) => s + p.red_cards, 0);
  const numLeagues   = meta?.leagues.length ?? 0;

  return (
    <main className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          FIFA World Cup 2026
        </div>
        <h1 className={styles.title}>
          Club <span className={styles.titleAccent}>Dashboard</span>
        </h1>
        <p className={styles.subtitle}>
          Which domestic clubs are showing out most at the World Cup?
          {updatedStr && <span className={styles.updatedBadge}>Updated {updatedStr}</span>}
        </p>
      </div>

      {/* KPI cards */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardValue}>{matchesPlayed}</div>
          <div className={styles.cardLabel}>Matches played</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValueAccent}>{totalGoals}</div>
          <div className={styles.cardLabel}>Goals scored</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{totalAssists}</div>
          <div className={styles.cardLabel}>Assists</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{clubs.length}</div>
          <div className={styles.cardLabel}>Clubs represented</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{numLeagues}</div>
          <div className={styles.cardLabel}>Leagues represented</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardValue}>{players.length}</div>
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

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "clubs" ? styles.tabActive : ""}`} onClick={() => setTab("clubs")}>
          Club Rankings
        </button>
        <button className={`${styles.tab} ${tab === "players" ? styles.tabActive : ""}`} onClick={() => setTab("players")}>
          Player Stats
        </button>
        <button className={`${styles.tab} ${tab === "astro" ? styles.tabActive : ""}`} onClick={() => setTab("astro")}>
          ☀️ Astrology
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading data…</div>
      ) : (
        <div className={styles.tabContent}>
          {tab === "clubs" && <ClubTable clubs={clubs} meta={meta} onDrillDown={handleDrillDown} />}
          {tab === "players" && (
            <PlayerTable players={players} meta={meta} fClub={playerClubFilter} setFClub={setPlayerClubFilter} />
          )}
          {tab === "astro" && <AstroTable players={players} />}
        </div>
      )}
    </main>
  );
}
