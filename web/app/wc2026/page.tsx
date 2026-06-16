"use client";

import { useEffect, useMemo, useState } from "react";
import type { Club, Player, WcMeta } from "@/types/wc";
import styles from "./wc2026.module.css";
import FilterBar from "./FilterBar";
import Tooltip from "./Tooltip";
import { useColumnResize } from "./useColumnResize";

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
              <tr key={c.club}>
                <td className={styles.rank}>{i + 1}</td>
                <td className={styles.wrap}>
                  <Tooltip text={c.league ? `${c.league}` : "League unknown"}>
                    <button className={styles.clubLink} onClick={() => onDrillDown(c.club)}>
                      {c.club}
                    </button>
                  </Tooltip>
                </td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.player_count}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.total_goals}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.total_assists}</td>
                <td className={`${styles.statCell} ${styles.nowrap}`}>{c.total_goal_contributions}</td>
                <td className={styles.nowrap}>{fmtDec(c.goals_per_90)}</td>
                <td className={styles.nowrap}>{fmtDec(c.assists_per_90)}</td>
                <td className={`${styles.statCellAccent} ${styles.nowrap}`}>{fmtDec(c.ga_per_90)}</td>
                <td className={styles.nowrap}>{c.total_minutes}</td>
                <td className={`${styles.nowrap} ${c.total_yellow_cards ? styles.cellAmber : ""}`}>{c.total_yellow_cards}</td>
                <td className={`${styles.nowrap} ${c.total_red_cards ? styles.cellRed : ""}`}>{c.total_red_cards}</td>
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

// Embroidery-floss spool: muted threads laid on calico. The active thread
// pulls taut in tailor's red (--thread) via hover, so these stay restrained.
const CHART_COLORS = [
  "#54534D", "#8A887F", "#3E5C76", "#7A6A53", "#9C7B4E",
  "#5E6B5A", "#A2918C", "#6B5D6E", "#4F6F6A", "#8C6F5A",
];

type Metric = "ga" | "goals" | "assists";

function TrendChart() {
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

  if (!data || data.matchdays.length === 0) {
    return <div className={styles.loading}>No matchday data yet.</div>;
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

  const W = 900, H = 380, PAD = { top: 20, right: 160, bottom: 48, left: 48 };
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
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block" }}>
          {/* draft guide lines — faint chalk on the pattern sheet */}
          {yTicks.map((v) => (
            <line key={v}
              x1={PAD.left} x2={W - PAD.right}
              y1={yPos(v)} y2={yPos(v)}
              stroke="var(--rule-soft)" strokeWidth={1}
              strokeDasharray={v === 0 ? undefined : "2 4"}
            />
          ))}
          {yTicks.map((v) => (
            <text key={v} x={PAD.left - 8} y={yPos(v) + 3}
              textAnchor="end" fontSize={9} fontFamily="var(--font-mono)"
              fill="var(--carbon-3)">{v}</text>
          ))}
          {/* x axis — matchday marks, like seam notches */}
          {matchdays.map((d, i) => (
            <g key={d}>
              <line x1={xPos(i)} x2={xPos(i)} y1={PAD.top + chartH} y2={PAD.top + chartH + 4}
                stroke="var(--carbon-3)" strokeWidth={1} />
              <text
                x={xPos(i)} y={H - PAD.bottom + 16}
                textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)"
                fill="var(--carbon-3)"
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
            letterSpacing="0.1em" fill="var(--carbon-3)"
            transform={`rotate(-90,${PAD.left - 34},${PAD.top + chartH / 2})`}
          >
            CUMULATIVE {metricLabel.toUpperCase()}
          </text>

          {/* threads — each club is a single taut strand */}
          {clubs.map((club, ci) => {
            const color = CHART_COLORS[ci % CHART_COLORS.length];
            const active = hovered === club;
            const dim = hovered !== null && !active;
            return (
              <polyline key={club}
                points={polyline(getSeries(club))}
                fill="none"
                stroke={active ? "var(--thread)" : color}
                strokeWidth={active ? 2.25 : 1.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={dim ? 0.18 : 1}
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
                fill={active ? "var(--thread)" : color}
                stroke="var(--calico)" strokeWidth={1}
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
            const active = hovered === club;
            const dim = hovered !== null && !active;
            const vals = getSeries(club);
            const lastVal = vals[vals.length - 1];
            const ly = PAD.top + ci * 20 + 8;
            return (
              <g key={club}
                style={{ cursor: "pointer", opacity: dim ? 0.3 : 1, transition: "opacity 0.15s" }}
                onMouseEnter={() => setHovered(club)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* a short stitch of the thread's own color */}
                <line x1={W - PAD.right + 14} x2={W - PAD.right + 30}
                  y1={ly} y2={ly}
                  stroke={active ? "var(--thread)" : color}
                  strokeWidth={active ? 2.25 : 1.5} strokeLinecap="round" />
                <text x={W - PAD.right + 36} y={ly + 3.5}
                  fontSize={10} fontFamily="var(--font-sans)"
                  fontWeight={active ? 700 : 500}
                  fill={active ? "var(--thread)" : "var(--carbon-2)"}>
                  {club.length > 17 ? club.slice(0, 16) + "…" : club}
                  <tspan fontFamily="var(--font-mono)" fill="var(--carbon-3)"> {lastVal}</tspan>
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
                <td className={`${styles.statCellAccent} ${styles.nowrap}`}>{p.saves}</td>
                <td className={styles.nowrap}>{p.shots_faced}</td>
                <td className={styles.nowrap}>{p.goals_conceded}</td>
                <td className={`${styles.statCellAccent} ${styles.nowrap}`}>{p.clean_sheets}</td>
                <td className={`${styles.statCellAccent} ${styles.nowrap}`}>
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
                    <td className={styles.statCellAccent}>{r.ga_per_90.toFixed(2)}</td>
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
        <a
          className={styles.dataCredit}
          href="https://www.espn.com/soccer/league/_/name/fifa.world"
          target="_blank"
          rel="noopener noreferrer"
        >
          Data: ESPN
        </a>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          FIFA WORLD CUP 2026 · {matchesPlayed} MATCHES · {clubs.length} CLUBS · {numLeagues} LEAGUES
        </div>
        <h1 className={styles.title}>Club Dashboard</h1>
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

      {/* KPI telemetry — primary signals dominate, ancillary readouts compressed */}
      <div className={styles.kpiPrimary}>
        <div className={`${styles.kpiCellLg} ${styles.kpiAccent}`}>
          <div className={styles.kpiRef}>Tournament total</div>
          <div className={styles.cardValueAccent}>{totalGoals}</div>
          <div className={styles.cardLabel}>Goals scored</div>
        </div>
        <div className={styles.kpiCellLg}>
          <div className={styles.kpiRef}>Across all WC squads</div>
          <div className={styles.cardValue}>{players.length}</div>
          <div className={styles.cardLabel}>Players tracked</div>
        </div>
        <div className={styles.kpiCellLg}>
          <div className={styles.kpiRef}>Tournament total</div>
          <div className={styles.cardValue}>{totalAssists}</div>
          <div className={styles.cardLabel}>Assists</div>
        </div>
      </div>
      <div className={styles.kpiSecondary}>
        <div className={styles.kpiCellSm}>
          <div className={styles.cardValueSm}>{matchesPlayed}</div>
          <div className={styles.cardLabelSm}>Matches</div>
        </div>
        <div className={styles.kpiCellSm}>
          <div className={styles.cardValueSm}>{clubs.length}</div>
          <div className={styles.cardLabelSm}>Clubs</div>
        </div>
        <div className={styles.kpiCellSm}>
          <div className={styles.cardValueSm}>{numLeagues}</div>
          <div className={styles.cardLabelSm}>Leagues</div>
        </div>
        <div className={styles.kpiCellSm}>
          <div className={`${styles.cardValueSm} ${styles.valAmber}`}>{totalYellow}</div>
          <div className={styles.cardLabelSm}>Yellow</div>
        </div>
        <div className={styles.kpiCellSm}>
          <div className={`${styles.cardValueSm} ${styles.valRed}`}>{totalRed}</div>
          <div className={styles.cardLabelSm}>Red</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "clubs" ? styles.tabActive : ""}`} onClick={() => setTab("clubs")}>
          <span className={styles.tabTag}>[ CLB ]</span> Club Rankings
        </button>
        <button className={`${styles.tab} ${tab === "players" ? styles.tabActive : ""}`} onClick={() => setTab("players")}>
          <span className={styles.tabTag}>[ PLR ]</span> Player Stats
        </button>
        <button className={`${styles.tab} ${tab === "chart" ? styles.tabActive : ""}`} onClick={() => setTab("chart")}>
          <span className={styles.tabTag}>[ TRN ]</span> Trends
        </button>
        <button className={`${styles.tab} ${tab === "gk" ? styles.tabActive : ""}`} onClick={() => setTab("gk")}>
          <span className={styles.tabTag}>[ GK ]</span> Goalkeepers
        </button>
        <button className={`${styles.tab} ${tab === "astro" ? styles.tabActive : ""}`} onClick={() => setTab("astro")}>
          <span className={styles.tabTag}>[ AST ]</span> Astrology
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
          {tab === "chart"   && <TrendChart />}
          {tab === "gk"      && <GkTable players={players} meta={meta} />}
          {tab === "astro"   && <AstroTable players={players} />}
        </div>
      )}
    </main>
  );
}
