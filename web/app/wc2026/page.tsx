"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Club, Player, WcMeta } from "@/types/wc";
import styles from "./wc2026.module.css";
import FilterBar from "./FilterBar";
import Tooltip from "./Tooltip";
import { useColumnResize } from "./useColumnResize";
import { drape, tension, gather, layIn, stagger, useCountUp } from "./motion";

// Count-up stat value (Cormorant numeral, spring-interpolated)
function StatNumber({ value, className }: { value: number; className?: string }) {
  const n = useCountUp(value);
  return <div className={className}>{n}</div>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "clubs" | "players" | "gk" | "chart" | "astro";

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

/** Tier color for the signature G+A/90 column: gold ≥1.0, sage 0.6–1.0, slate <0.6. */
function tierClass(v: number | null | undefined): string {
  if (v == null) return styles.tierSlate;
  if (v >= 1.0)  return styles.tierGold;
  if (v >= 0.6)  return styles.tierSage;
  return styles.tierSlate;
}

/** Compact league code for the care-tag line under a club name. */
const LEAGUE_ABBR: Record<string, string> = {
  "English Premier League": "PRL", "Spanish LALIGA": "LIGA",
  "German Bundesliga": "BUN", "Italian Serie A": "SERIE A",
  "French Ligue 1": "L1", "Dutch Eredivisie": "ERE",
  "Portuguese Primeira Liga": "PRIM", "Scottish Premiership": "SCO",
  "Belgian Pro League": "BEL", "Turkish Super Lig": "TUR",
  "Saudi Pro League": "SPL", "MLS": "MLS", "Liga MX": "MX",
  "Brazilian Serie A": "BRA", "Argentine Primera Division": "ARG",
};
function leagueCode(league: string | null | undefined): string {
  if (!league) return "—";
  return LEAGUE_ABBR[league] ?? league.toUpperCase().slice(0, 8);
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

  const { widths, startResize, autoFit } = useColumnResize({
    rank: 48, club: 180, players: 110, goals: 70, assists: 80, ga: 70,
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
    { key: "players", label: "Players in WC", col: "player_count", title: "Players selected in this club's WC squads" },
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
      <FilterBar filters={[
        { label: "Club", options: clubOptions, selected: fClub, onChange: setFClub },
        { label: "League", options: leagueOptions, selected: fLeague, onChange: setFLeague },
      ]} />
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
                <SortTh label="Club" active={false} onSort={() => {}} title="Hover a club to see its league" />
                <span className={styles.resizeHandle} onPointerDown={startResize("club")} onDoubleClick={autoFit("club", 1)} />
              </th>
              {numCols.map((c, idx) => (
                <th key={c.key} className={styles.thResizable}>
                  <SortTh label={c.label} active={sort === c.col} onSort={() => setSort(c.col)} title={c.title} />
                  <span className={styles.resizeHandle} onPointerDown={startResize(c.key)} onDoubleClick={autoFit(c.key, idx + 2)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <motion.tr key={c.club} layout transition={tension}>
                <td className={styles.rank}>{i + 1}</td>
                <td className={styles.wrap}>
                  <Tooltip text={c.league ? `${c.league}` : "League unknown"}>
                    <button className={styles.clubLink} onClick={() => onDrillDown(c.club)}>
                      {c.club}
                    </button>
                  </Tooltip>
                  <div className={styles.clubSub}>{leagueCode(c.league)}</div>
                </td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.player_count}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.total_goals}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.total_assists}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.total_goal_contributions}</td>
                <td className={styles.nowrap}>{fmtDec(c.goals_per_90)}</td>
                <td className={styles.nowrap}>{fmtDec(c.assists_per_90)}</td>
                <td className={`${styles.statCellAccent} ${tierClass(c.ga_per_90)} ${styles.nowrap}`}>{fmtDec(c.ga_per_90)}</td>
                <td className={styles.nowrap}>{c.total_minutes}</td>
                <td className={`${styles.nowrap} ${c.total_yellow_cards ? styles.cellAmber : ""}`}>{c.total_yellow_cards}</td>
                <td className={`${styles.nowrap} ${c.total_red_cards ? styles.cellRed : ""}`}>{c.total_red_cards}</td>
                <td className={styles.nowrap}>{fmt(c.avg_age)}</td>
              </motion.tr>
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
  players, meta, fClub, setFClub, onSignClick,
}: {
  players: Player[];
  meta: WcMeta | null;
  fClub: Set<string>;
  setFClub: (s: Set<string>) => void;
  onSignClick: () => void;
}) {
  const [sort, setSort] = useState<PlayerSort>("goals");
  const [fLeague, setFLeague] = useState<Set<string>>(new Set());
  const [fNat, setFNat] = useState<Set<string>>(new Set());
  const [fPos, setFPos] = useState<Set<string>>(new Set());
  const [fSign, setFSign] = useState<Set<string>>(new Set());

  const { widths, startResize, autoFit } = useColumnResize({
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

  return (
    <div>
      <FilterBar filters={[
        { label: "Club", options: clubOptions, selected: fClub, onChange: setFClub },
        { label: "League", options: leagueOptions, selected: fLeague, onChange: setFLeague },
        { label: "Nationality", options: natOptions, selected: fNat, onChange: setFNat },
        { label: "Position", options: posOptions, selected: fPos, onChange: setFPos },
        { label: "Sun Sign", options: ALL_SIGNS, selected: fSign, onChange: setFSign, renderOption: (s) => `${SIGN_EMOJI[s] ?? ""} ${s}` },
      ]} />

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
                <span className={styles.resizeHandle} onPointerDown={startResize("name")} onDoubleClick={autoFit("name", 1)} />
              </th>
              <th className={styles.thResizable}>
                <SortTh label="Club" active={false} onSort={() => {}} title="Hover a club to see its league" />
                <span className={styles.resizeHandle} onPointerDown={startResize("club")} onDoubleClick={autoFit("club", 2)} />
              </th>
              <th className={styles.thResizable}>
                <SortTh label="Nat." active={sort === "nationality"} onSort={() => setSort("nationality" as PlayerSort)} />
                <span className={styles.resizeHandle} onPointerDown={startResize("nat")} onDoubleClick={autoFit("nat", 3)} />
              </th>
              <th className={styles.thResizable}>
                <SortTh label="Pos." active={sort === "position"} onSort={() => setSort("position" as PlayerSort)} />
                <span className={styles.resizeHandle} onPointerDown={startResize("pos")} onDoubleClick={autoFit("pos", 4)} />
              </th>
              <th className={styles.thResizable}>
                <SortTh label="Age" active={sort === "age"} onSort={() => setSort("age" as PlayerSort)} />
                <span className={styles.resizeHandle} onPointerDown={startResize("age")} onDoubleClick={autoFit("age", 5)} />
              </th>
              <th className={styles.thResizable}>
                <SortTh label="Sign" active={sort === "sun_sign"} onSort={() => setSort("sun_sign" as PlayerSort)} />
                <span className={styles.resizeHandle} onPointerDown={startResize("sign")} onDoubleClick={autoFit("sign", 6)} />
              </th>
              {numCols.map((c, idx) => (
                <th key={c.key} className={styles.thResizable}>
                  <SortTh label={c.label} active={sort === c.col} onSort={() => setSort(c.col)} title={c.title} />
                  <span className={styles.resizeHandle} onPointerDown={startResize(c.key)} onDoubleClick={autoFit(c.key, idx + 7)} />
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
                  <Tooltip text={p.league ? `${p.league}` : "League unknown"}>
                    <button
                      className={styles.clubLink}
                      onClick={() => setFClub(fClub.has(p.club) ? new Set() : new Set([p.club]))}
                    >
                      {p.club}
                    </button>
                  </Tooltip>
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
                    <button className={styles.signLink} onClick={onSignClick} title="View astrology tab">
                      {SIGN_EMOJI[p.sun_sign] ?? ""} {p.sun_sign}
                    </button>
                  ) : "—"}
                </td>
                <td className={styles.nowrap}>{p.matches_played}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{p.goals}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{p.assists}</td>
                <td className={`${styles.statCellAccent} ${tierClass(p.goal_contributions_per_90)} ${styles.nowrap}`}>{fmtDec(p.goal_contributions_per_90)}</td>
                <td className={styles.nowrap}>{p.goals ? Math.round(p.minutes_played / p.goals) : "—"}</td>
                <td className={styles.nowrap}>{p.shots_on_target}</td>
                <td className={styles.nowrap}>{p.minutes_played}</td>
                <td className={`${styles.nowrap} ${p.yellow_cards ? styles.cellAmber : ""}`}>{p.yellow_cards}</td>
                <td className={`${styles.nowrap} ${p.red_cards ? styles.cellRed : ""}`}>{p.red_cards}</td>
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
// Club trend chart (SVG line chart — top 10 clubs, cumulative G+A by matchday)
// ---------------------------------------------------------------------------

// Distinguishable but theme-consistent: warm/muted hues spread across the
// wheel so 10 lines stay legible. Paired with a dash cycle (below) so adjacent
// strands differ in both color and stroke. Hovered line resolves to gold.
const CHART_COLORS = [
  "#C4943A", // gold
  "#7FAD8F", // sage
  "#C97A6D", // terracotta
  "#6B8FB5", // dusty blue
  "#B58DB0", // mauve
  "#D9B36B", // wheat
  "#5E9E91", // teal
  "#B0734A", // rust
  "#8A93C2", // periwinkle
  "#9DAE6B", // olive
];

// Dash patterns cycle every 3 colors so neighbors in the legend differ in style.
const CHART_DASHES = ["", "5 3", "1 3"];

// ---------------------------------------------------------------------------
// Radar / player web — one club's stat profile as a taut gold thread
// ---------------------------------------------------------------------------

// Colors for multi-club radar overlay (reuse chart palette)
const RADAR_COLORS = CHART_COLORS;

function RadarChart({ players }: { players: Player[] }) {
  const [pointTip, setPointTip] = useState<{ text: string; x: number; y: number } | null>(null);

  // aggregate per club from the player list
  const clubAgg = useMemo(() => {
    const m = new Map<string, { goals: number; assists: number; mins: number; sot: number; players: number; ga: number; ga90: number }>();
    for (const p of players) {
      if (!p.club || p.club === "Unknown") continue;
      const e = m.get(p.club) ?? { goals: 0, assists: 0, mins: 0, sot: 0, players: 0, ga: 0, ga90: 0 };
      e.goals += p.goals; e.assists += p.assists; e.mins += p.minutes_played;
      e.sot += p.shots_on_target; e.players += 1; e.ga += p.goals + p.assists;
      m.set(p.club, e);
    }
    // compute ga/90 after accumulation
    for (const [, e] of m) {
      e.ga90 = e.mins > 0 ? Math.round((e.ga / e.mins) * 90 * 100) / 100 : 0;
    }
    return m;
  }, [players]);

  // default to top G+A club
  const ranked = useMemo(
    () => [...clubAgg.entries()].sort((a, b) => b[1].ga - a[1].ga).map(([c]) => c),
    [clubAgg],
  );

  // multi-select: set of active clubs
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const activeClubs = useMemo(() => {
    const s = selected.size > 0
      ? ranked.filter((club) => selected.has(club))
      : [ranked[0]].filter(Boolean);
    return s.slice(0, RADAR_COLORS.length);
  }, [selected, ranked]);

  // axis maxima across all clubs
  const maxes = useMemo(() => {
    let g = 1, a = 1, st = 1, pl = 1, ga = 1, ga90 = 0.01;
    for (const e of clubAgg.values()) {
      g = Math.max(g, e.goals); a = Math.max(a, e.assists);
      st = Math.max(st, e.sot); pl = Math.max(pl, e.players);
      ga = Math.max(ga, e.ga); ga90 = Math.max(ga90, e.ga90);
    }
    return { g, a, st, pl, ga, ga90 };
  }, [clubAgg]);

  if (ranked.length === 0) return <div className={styles.loading}>No data yet.</div>;

  const W = 680, H = 560, cx = W / 2, cy = H / 2, R = 190;
  const axes = [
    { label: "GOALS",    key: "goals"   as const, max: maxes.g },
    { label: "G+A",      key: "ga"      as const, max: maxes.ga },
    { label: "ASSISTS",  key: "assists" as const, max: maxes.a },
    { label: "G+A/90",   key: "ga90"   as const, max: maxes.ga90 },
    { label: "SHOTS OT", key: "sot"    as const, max: maxes.st },
    { label: "SQUAD",    key: "players" as const, max: maxes.pl },
  ];
  const N = axes.length;
  const angle = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];

  function buildPath(clubName: string) {
    const e = clubAgg.get(clubName);
    if (!e) return "";
    return axes
      .map((ax, i) => {
        const r = R * Math.min(1, (e[ax.key] as number) / ax.max);
        const [x, y] = pt(i, r);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + "Z";
  }

  const rings = [0.25, 0.5, 0.75, 1];

  function handleClubFilterChange(next: Set<string>) {
    if (next.size <= RADAR_COLORS.length) {
      setSelected(next);
      return;
    }

    const limited = ranked.filter((club) => next.has(club)).slice(0, RADAR_COLORS.length);
    setSelected(new Set(limited));
  }

  return (
    <div>
      <FilterBar filters={[
        { label: "Clubs", options: ranked, selected, onChange: handleClubFilterChange },
      ]} />

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block", margin: "0 auto" }}>
        {/* web rings */}
        {rings.map((rr, ri) => (
          <polygon key={ri}
            points={axes.map((_, i) => pt(i, R * rr).map((n) => n.toFixed(1)).join(",")).join(" ")}
            fill="none" stroke="var(--seam)" strokeWidth={1} />
        ))}
        {/* spokes + labels */}
        {axes.map((ax, i) => {
          const [ex, ey] = pt(i, R);
          const [lx, ly] = pt(i, R + 30);
          return (
            <g key={ax.label}>
              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--seam)" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fontFamily="var(--font-mono)" letterSpacing="0.08em"
                fill="var(--slate)">{ax.label}</text>
            </g>
          );
        })}
        {/* one path + knots per active club */}
        {activeClubs.map((clubName, ci) => {
          const color = RADAR_COLORS[ci % RADAR_COLORS.length];
          const e = clubAgg.get(clubName);
          if (!e) return null;
          return (
            <g key={clubName}>
              <motion.path
                key={`${clubName}-path`}
                d={buildPath(clubName)}
                fill={`${color}18`}
                stroke={color}
                strokeWidth={activeClubs.length === 1 ? 1.5 : 1.25}
                strokeLinejoin="round"
                pointerEvents="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.55, ease: "easeInOut", delay: ci * 0.08 }}
              />
              {axes.map((ax, i) => {
                const r = R * Math.min(1, (e[ax.key] as number) / ax.max);
                const [x, y] = pt(i, r);
                const val = ax.key === "ga90" ? (e[ax.key] as number).toFixed(2) : e[ax.key];
                return (
                  <g key={`${clubName}-${ax.key}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={8}
                      fill="rgba(0,0,0,0.001)"
                      pointerEvents="all"
                      onMouseEnter={(event) => setPointTip({ text: String(val), x: event.clientX, y: event.clientY })}
                      onMouseMove={(event) => setPointTip({ text: String(val), x: event.clientX, y: event.clientY })}
                      onMouseLeave={() => setPointTip(null)}
                    />
                    <circle cx={x} cy={y} r={2.5} fill={color} stroke="var(--calico)" strokeWidth={1} pointerEvents="none" />
                    {activeClubs.length === 1 && (
                      <text x={x} y={y - 8} textAnchor="middle" dominantBaseline="middle"
                        fontSize={10} fontFamily="var(--font-serif)" fontStyle="italic" fontWeight={600}
                        fill="var(--carbon)">{String(val)}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {/* legend when multiple clubs */}
        {activeClubs.length > 1 && activeClubs.map((clubName, ci) => {
          const color = RADAR_COLORS[ci % RADAR_COLORS.length];
          return (
            <g key={`leg-${clubName}`}>
              <rect x={16} y={16 + ci * 20} width={12} height={3} fill={color} />
              <text x={34} y={16 + ci * 20 + 3} fontSize={10} fontFamily="var(--font-sans)" fontWeight={500} fill={color}>
                {clubName}
              </text>
            </g>
          );
        })}
      </svg>
      {pointTip && (
        <div
          className={styles.tipFixed}
          role="tooltip"
          style={{ left: pointTip.x + 10, top: pointTip.y - 8 }}
        >
          {pointTip.text}
        </div>
      )}
    </div>
  );
}

type Metric = "ga" | "goals" | "assists";
type TrendView = "line" | "radar";

function TrendChart({ players }: { players: Player[] }) {
  const [view, setView] = useState<TrendView>("line");
  const [data, setData] = useState<{
    matchdays: string[];
    series: Record<string, { goals: number[]; assists: number[]; ga: number[] }>;
  } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("ga");
  const [topN, setTopN] = useState(10);

  useEffect(() => {
    fetch("/api/v1/timeseries").then((r) => r.json()).then((j) => setData(j.response));
  }, []);

  // view switch lives above the data guard so radar works without timeseries
  const viewToggle = (
    <div className={styles.chartToggleGroup}>
      {(["line", "radar"] as TrendView[]).map((v) => (
        <button
          key={v}
          className={`${styles.chartToggle} ${view === v ? styles.chartToggleActive : ""}`}
          onClick={() => setView(v)}
        >
          {v === "line" ? "Trend" : "Profile"}
        </button>
      ))}
    </div>
  );

  if (view === "radar") {
    return (
      <div>
        <div className={styles.chartControls}>{viewToggle}</div>
        <RadarChart players={players} />
      </div>
    );
  }

  if (!data || data.matchdays.length === 0) {
    return (
      <div>
        <div className={styles.chartControls}>{viewToggle}</div>
        <div className={styles.loading}>No matchday data yet.</div>
      </div>
    );
  }

  const { matchdays } = data;
  const allClubs = Object.keys(data.series)
    .sort((a, b) => {
      const av = data.series[a][metric];
      const bv = data.series[b][metric];
      return (bv[bv.length - 1] ?? 0) - (av[av.length - 1] ?? 0);
    });
  const clubs = allClubs.slice(0, topN);
  if (clubs.length === 0) return <div className={styles.loading}>No data yet.</div>;

  const getSeries = (club: string) => data.series[club][metric];

  const W = 1180, H = 560, PAD = { top: 28, right: 210, bottom: 56, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...clubs.flatMap((c) => getSeries(c)));
  const xStep = matchdays.length > 1 ? chartW / (matchdays.length - 1) : chartW;

  function xPos(i: number) { return PAD.left + i * xStep; }
  function yPos(v: number) { return PAD.top + chartH - (maxVal > 0 ? (v / maxVal) * chartH : 0); }
  function polyline(vals: number[]) {
    return vals.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ");
  }

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal * i) / 4));

  const metricLabel = metric === "ga" ? "G+A" : metric === "goals" ? "Goals" : "Assists";

  return (
    <div>
      <div className={styles.chartControls}>
        {viewToggle}
        <div className={styles.chartToggleGroup}>
          {(["ga", "goals", "assists"] as Metric[]).map((m) => (
            <button
              key={m}
              className={`${styles.chartToggle} ${metric === m ? styles.chartToggleActive : ""}`}
              onClick={() => setMetric(m)}
            >
              {m === "ga" ? "G+A" : m === "goals" ? "Goals" : "Assists"}
            </button>
          ))}
        </div>
        <div className={styles.chartToggleGroup}>
          {[5, 10, 15, 20].map((n) => (
            <button
              key={n}
              className={`${styles.chartToggle} ${topN === n ? styles.chartToggleActive : ""}`}
              onClick={() => setTopN(n)}
            >
              Top {n}
            </button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 720, display: "block" }}>
          {/* draft guide lines — faint chalk on the pattern sheet */}
          {yTicks.map((v, ti) => (
            <line key={ti}
              x1={PAD.left} x2={W - PAD.right}
              y1={yPos(v)} y2={yPos(v)}
              stroke="var(--bone-10)" strokeWidth={1}
              strokeDasharray={v === 0 ? undefined : "2 4"}
            />
          ))}
          {yTicks.map((v, ti) => (
            <text key={ti} x={PAD.left - 8} y={yPos(v) + 3}
              textAnchor="end" fontSize={9} fontFamily="var(--font-mono)"
              fill="var(--slate)">{v}</text>
          ))}
          {/* x axis — matchday marks, like seam notches */}
          {matchdays.map((d, i) => (
            <g key={d}>
              <line x1={xPos(i)} x2={xPos(i)} y1={PAD.top + chartH} y2={PAD.top + chartH + 4}
                stroke="var(--slate)" strokeWidth={1} />
              <text
                x={xPos(i)} y={H - PAD.bottom + 16}
                textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)"
                fill="var(--slate)"
                transform={matchdays.length > 8 ? `rotate(-35,${xPos(i)},${H - PAD.bottom + 16})` : undefined}
              >
                {`${d.slice(4, 6)}.${d.slice(6, 8)}`}
              </text>
            </g>
          ))}
          {/* y axis caption */}
          <text
            x={PAD.left - 34} y={PAD.top + chartH / 2}
            textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)"
            letterSpacing="0.1em" fill="var(--slate)"
            transform={`rotate(-90,${PAD.left - 34},${PAD.top + chartH / 2})`}
          >
            CUMULATIVE {metricLabel.toUpperCase()}
          </text>

          {/* threads — each club is a single taut strand */}
          {clubs.map((club, ci) => {
            const color = CHART_COLORS[ci % CHART_COLORS.length];
            // first 10 solid; if topN pushes past 10, the wrapped colors get a dash
            const dash = ci < CHART_COLORS.length ? "" : "6 4";
            const active = hovered === club;
            const dim = hovered !== null && !active;
            return (
              <polyline key={club}
                points={polyline(getSeries(club))}
                fill="none"
                stroke={active ? "var(--gold)" : color}
                strokeWidth={active ? 3.5 : 2}
                strokeDasharray={active ? undefined : dash}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={dim ? 0.22 : 1}
                style={{ cursor: "pointer", transition: "opacity 0.15s, stroke-width 0.12s" }}
                onMouseEnter={() => setHovered(club)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
          {/* knots — the end of each thread, pinned */}
          {clubs.map((club, ci) => {
            const color = CHART_COLORS[ci % CHART_COLORS.length];
            const vals = getSeries(club);
            const lastVal = vals[vals.length - 1];
            const active = hovered === club;
            const dim = hovered !== null && !active;
            return (
              <circle key={club}
                cx={xPos(matchdays.length - 1)} cy={yPos(lastVal)} r={active ? 3 : 2}
                fill={active ? "var(--gold)" : color}
                stroke="var(--ink)" strokeWidth={1}
                opacity={dim ? 0.18 : 1}
                style={{ transition: "opacity 0.15s" }}
                onMouseEnter={() => setHovered(club)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
          {/* spool index — pinned thread legend */}
          {clubs.map((club, ci) => {
            const color = CHART_COLORS[ci % CHART_COLORS.length];
            const dash = ci < CHART_COLORS.length ? "" : "6 4";
            const active = hovered === club;
            const dim = hovered !== null && !active;
            const vals = getSeries(club);
            const lastVal = vals[vals.length - 1];
            const ly = PAD.top + ci * 24 + 10;
            return (
              <g key={club}
                style={{ cursor: "pointer", opacity: dim ? 0.3 : 1, transition: "opacity 0.15s" }}
                onMouseEnter={() => setHovered(club)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* a short stitch of the thread's own color + style */}
                <line x1={W - PAD.right + 16} x2={W - PAD.right + 38}
                  y1={ly} y2={ly}
                  stroke={active ? "var(--gold)" : color}
                  strokeDasharray={active ? undefined : dash}
                  strokeWidth={active ? 3.5 : 2.25} strokeLinecap="round" />
                <text x={W - PAD.right + 46} y={ly + 4}
                  fontSize={12} fontFamily="var(--font-sans)"
                  fontWeight={active ? 700 : 500}
                  fill={active ? "var(--gold)" : "var(--bone-60)"}>
                  {club.length > 18 ? club.slice(0, 17) + "…" : club}
                  <tspan fontFamily="var(--font-mono)" fill="var(--slate)"> {lastVal}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goalkeeper table
// ---------------------------------------------------------------------------

type GkSort = keyof Player | "goals_conceded_per_90" | "save_pct";

function GkTable({ players, meta }: { players: Player[]; meta: WcMeta | null }) {
  const [sort, setSort] = useState<GkSort>("saves");
  const [fNat, setFNat]     = useState<Set<string>>(new Set());
  const [fClub, setFClub]   = useState<Set<string>>(new Set());
  const [fLeague, setFLeague] = useState<Set<string>>(new Set());

  const { widths, startResize, autoFit } = useColumnResize({
    rank: 48, name: 170, club: 150, nat: 120, age: 56,
    mp: 50, mins: 64, sv: 60, sf: 64, gc: 60, cs: 60, svpct: 76, gcper90: 84,
    yc: 50, rc: 50,
  });

  const gks = useMemo(() => players.filter((p) => p.position === "Goalkeeper"), [players]);

  const filtered = useMemo(() => {
    let r = gks;
    if (fNat.size)    r = r.filter((p) => fNat.has(p.nationality));
    if (fClub.size)   r = r.filter((p) => fClub.has(p.club));
    if (fLeague.size) r = r.filter((p) => p.league && fLeague.has(p.league));
    return r;
  }, [gks, fNat, fClub, fLeague]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const av = ((a as unknown as Record<string, unknown>)[sort as string] as number) ?? -1;
      const bv = ((b as unknown as Record<string, unknown>)[sort as string] as number) ?? -1;
      return bv - av;
    }),
    [filtered, sort]);

  const natOptions    = meta?.nationalities ?? distinct(gks.map((p) => p.nationality)).sort();
  const clubOptions   = meta?.clubs ?? distinct(gks.map((p) => p.club)).sort();
  const leagueOptions = meta?.leagues ?? distinct(gks.map((p) => p.league).filter(Boolean) as string[]).sort();

  const numCols: { key: string; label: string; col: GkSort; title?: string; accent?: boolean }[] = [
    { key: "mp",      label: "MP",      col: "matches_played",      title: "Matches played" },
    { key: "mins",    label: "Mins",    col: "minutes_played" },
    { key: "sv",      label: "Saves",   col: "saves",               accent: true },
    { key: "sf",      label: "Shots F", col: "shots_faced",         title: "Shots faced (on target)" },
    { key: "gc",      label: "GC",      col: "goals_conceded",      title: "Goals conceded" },
    { key: "cs",      label: "CS",      col: "clean_sheets",        title: "Clean sheets (played ≥60 min, 0 goals conceded)", accent: true },
    { key: "svpct",   label: "Save %",  col: "save_pct",            title: "Save percentage", accent: true },
    { key: "gcper90", label: "GC/90",   col: "goals_conceded_per_90", title: "Goals conceded per 90 — lower is better" },
    { key: "yc",      label: "YC",      col: "yellow_cards",        title: "Yellow cards" },
    { key: "rc",      label: "RC",      col: "red_cards",           title: "Red cards" },
  ];

  return (
    <div>
      <FilterBar filters={[
        { label: "Nationality", options: natOptions,    selected: fNat,    onChange: setFNat },
        { label: "Club",        options: clubOptions,   selected: fClub,   onChange: setFClub },
        { label: "League",      options: leagueOptions, selected: fLeague, onChange: setFLeague },
      ]} />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col style={{ width: widths.rank }} />
            <col style={{ width: widths.name }} />
            <col style={{ width: widths.club }} />
            <col style={{ width: widths.nat }} />
            <col style={{ width: widths.age }} />
            {numCols.map((c) => <col key={c.key} style={{ width: widths[c.key] }} />)}
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th className={styles.thResizable}>
                <SortTh label="Player" active={sort === "name"} onSort={() => setSort("name" as GkSort)} />
                <span className={styles.resizeHandle} onPointerDown={startResize("name")} onDoubleClick={autoFit("name", 1)} />
              </th>
              <th className={styles.thResizable}>
                <SortTh label="Club" active={false} onSort={() => {}} title="Hover for league" />
                <span className={styles.resizeHandle} onPointerDown={startResize("club")} onDoubleClick={autoFit("club", 2)} />
              </th>
              <th className={styles.thResizable}>
                <SortTh label="Nat." active={sort === "nationality"} onSort={() => setSort("nationality" as GkSort)} />
                <span className={styles.resizeHandle} onPointerDown={startResize("nat")} onDoubleClick={autoFit("nat", 3)} />
              </th>
              <th className={styles.thResizable}>
                <SortTh label="Age" active={sort === "age"} onSort={() => setSort("age" as GkSort)} />
                <span className={styles.resizeHandle} onPointerDown={startResize("age")} onDoubleClick={autoFit("age", 4)} />
              </th>
              {numCols.map((c, idx) => (
                <th key={c.key} className={styles.thResizable}>
                  <SortTh label={c.label} active={sort === c.col} onSort={() => setSort(c.col)} title={c.title} />
                  <span className={styles.resizeHandle} onPointerDown={startResize(c.key)} onDoubleClick={autoFit(c.key, idx + 5)} />
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
                  <Tooltip text={p.league ?? "League unknown"}>
                    <span className={styles.clubLink}>{p.club}</span>
                  </Tooltip>
                </td>
                <td className={styles.wrap}>{p.nationality}</td>
                <td className={styles.nowrap}>{fmt(p.age)}</td>
                <td className={styles.nowrap}>{p.matches_played}</td>
                <td className={styles.nowrap}>{p.minutes_played}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{p.saves}</td>
                <td className={styles.nowrap}>{p.shots_faced}</td>
                <td className={styles.nowrap}>{p.goals_conceded}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{p.clean_sheets}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`} style={{ color: p.save_pct != null ? "var(--gold)" : undefined }}>
                  {p.save_pct != null ? `${p.save_pct}%` : "—"}
                </td>
                <td className={styles.nowrap}>{fmtDec(p.goals_conceded_per_90)}</td>
                <td className={`${styles.nowrap} ${p.yellow_cards ? styles.cellAmber : ""}`}>{p.yellow_cards}</td>
                <td className={`${styles.nowrap} ${p.red_cards ? styles.cellRed : ""}`}>{p.red_cards}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableMeta}>{sorted.length} goalkeepers</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Astrology table
// ---------------------------------------------------------------------------

function AstroTable({ players }: { players: Player[] }) {
  const [sort, setSort] = useState<string>("ga_per_90");
  const [expanded, setExpanded] = useState<string | null>(null);

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
      const roster = [...group].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));
      return { sign, count, goals, assists, ga, mins, ga_per_90, g_per_player, roster };
    }).filter((r) => r.count > 0);
  }, [players]);

  const sorted = useMemo(() =>
    [...rows].sort((a, b) => ((b as unknown as Record<string, number>)[sort] ?? 0) - ((a as unknown as Record<string, number>)[sort] ?? 0)),
    [rows, sort]);

  const cols: { key: string; label: string; title?: string }[] = [
    { key: "count",        label: "Players" },
    { key: "goals",        label: "Goals" },
    { key: "assists",      label: "Assists" },
    { key: "ga",           label: "G+A" },
    { key: "ga_per_90",    label: "G+A/90", title: "Goal contributions per 90 across all players of this sign" },
    { key: "g_per_player", label: "G/Player", title: "Average goals per player" },
    { key: "mins",         label: "Mins" },
  ];

  const COL_COUNT = 3 + cols.length; // #, sign, expand-caret implicit + stat cols

  return (
    <div>
      <p className={styles.astroIntro}>
        Which star signs are outscoring the zodiac? Ranked by goal contributions per 90 minutes.
        Click a sign to see every player born under it. Pure vibes.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table} style={{ tableLayout: "auto" }}>
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th style={{ width: 180 }}>Sign</th>
              {cols.map((c) => (
                <th key={c.key}>
                  <SortTh label={c.label} active={sort === c.key} onSort={() => setSort(c.key)} title={c.title} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const isOpen = expanded === r.sign;
              return (
                <FragmentRow key={r.sign}>
                  <tr
                    className={styles.astroRow}
                    onClick={() => setExpanded(isOpen ? null : r.sign)}
                  >
                    <td className={styles.rank}>{i + 1}</td>
                    <td className={styles.statCell}>
                      <span className={styles.astroCaret}>{isOpen ? "▾" : "▸"}</span>{" "}
                      <span className={styles.signEmoji} style={{ fontSize: "1.1rem" }}>{SIGN_EMOJI[r.sign]}</span>{" "}
                      {r.sign}
                    </td>
                    <td>{r.count}</td>
                    <td className={styles.statCell}>{r.goals}</td>
                    <td className={styles.statCell}>{r.assists}</td>
                    <td className={styles.statCell}>{r.ga}</td>
                    <td className={`${styles.statCellAccent} ${tierClass(r.ga_per_90)}`}>{r.ga_per_90.toFixed(2)}</td>
                    <td>{r.g_per_player.toFixed(2)}</td>
                    <td>{r.mins}</td>
                  </tr>
                  {isOpen && (
                    <tr className={styles.astroExpandRow}>
                      <td colSpan={COL_COUNT} className={styles.astroExpandCell}>
                        <div className={styles.astroPlayerGrid}>
                          {r.roster.map((p) => (
                            <div key={p.player_id} className={styles.astroPlayerItem}>
                              <span className={styles.astroPlayerName}>{p.name}</span>
                              <span className={styles.astroPlayerMeta}>
                                {p.club} · {p.nationality}
                              </span>
                              <span className={styles.astroPlayerStat}>
                                {p.goals}G {p.assists}A
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper to render two sibling <tr> without an extra DOM wrapper
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
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
          FIFA WORLD CUP 2026 — CLUB PERFORMANCE
          <span className={styles.eyebrowRight}>
            <a
              href="https://github.com/pseudo-r/Public-ESPN-API"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.eyebrowLink}
            >
              DATA: PUBLIC ESPN API
            </a>
            ·
            <a
              href="https://claude.com/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.eyebrowLink}
            >
              BUILT WITH CLAUDE
            </a>
          </span>
        </div>
        <h1 className={styles.title}>
          <span className={styles.titleLight}>Club </span>
          <span className={styles.titleAccent}>Dashboard</span>
        </h1>
        <p className={styles.subtitle}>
          <span className={styles.subtitleText}>
            Which domestic clubs are showing out most at the World Cup — every player&apos;s
            tournament output, cut and sorted by the club they go home to.
          </span>
          {updatedStr && (
            <span className={styles.updatedBadge}>SYNC {updatedStr}</span>
          )}
        </p>
      </div>

      {/* Stat band — staggered lay-in, count-up numerals */}
      <motion.div className={styles.kpiPrimary} variants={stagger(0.08)} initial="initial" animate="animate">
        <motion.div className={`${styles.kpiCellLg} ${styles.kpiAccent}`} variants={layIn}>
          <StatNumber value={totalGoals} className={styles.cardValueAccent} />
          <div className={styles.cardLabel}>Goals scored</div>
        </motion.div>
        <motion.div className={styles.kpiCellLg} variants={layIn}>
          <StatNumber value={players.length} className={styles.cardValue} />
          <div className={styles.cardLabel}>Players tracked</div>
        </motion.div>
        <motion.div className={styles.kpiCellLg} variants={layIn}>
          <StatNumber value={totalAssists} className={styles.cardValue} />
          <div className={styles.cardLabel}>Assists</div>
        </motion.div>
      </motion.div>
      <div className={styles.kpiSecondary}>
        <div className={styles.kpiCellSm}>
          <StatNumber value={matchesPlayed} className={styles.cardValueSm} />
          <div className={styles.cardLabelSm}>Matches</div>
        </div>
        <div className={styles.kpiCellSm}>
          <StatNumber value={clubs.length} className={styles.cardValueSm} />
          <div className={styles.cardLabelSm}>Clubs</div>
        </div>
        <div className={styles.kpiCellSm}>
          <StatNumber value={numLeagues} className={styles.cardValueSm} />
          <div className={styles.cardLabelSm}>Leagues</div>
        </div>
        <div className={styles.kpiCellSm}>
          <StatNumber value={totalYellow} className={`${styles.cardValueSm} ${styles.valAmber}`} />
          <div className={styles.cardLabelSm}>Yellow</div>
        </div>
        <div className={styles.kpiCellSm}>
          <StatNumber value={totalRed} className={`${styles.cardValueSm} ${styles.valRed}`} />
          <div className={styles.cardLabelSm}>Red</div>
        </div>
      </div>

      {/* Tabs — shared-layout gold underline */}
      <div className={styles.tabs}>
        {([
          ["clubs", "Club Rankings"],
          ["players", "Player Stats"],
          ["chart", "Charts"],
          ["gk", "Goalkeepers"],
          ["astro", "Astrology"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
            {tab === key && (
              <motion.span layoutId="tab-indicator" className={styles.tabUnderline} transition={tension} />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>Loading data…</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className={styles.tabContent}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: drape }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15, ease: "easeIn" } }}
          >
            {tab === "clubs" && <ClubTable clubs={clubs} meta={meta} onDrillDown={handleDrillDown} />}
            {tab === "players" && (
              <PlayerTable
                players={players}
                meta={meta}
                fClub={playerClubFilter}
                setFClub={setPlayerClubFilter}
                onSignClick={() => setTab("astro")}
              />
            )}
            {tab === "chart"   && <TrendChart players={players} />}
            {tab === "gk"      && <GkTable players={players} meta={meta} />}
            {tab === "astro"   && <AstroTable players={players} />}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Colophon */}
      <footer className={styles.colophon}>
        <span>FIFA WORLD CUP 2026 — CLUB SHOWOUT</span>
      </footer>
    </main>
  );
}
