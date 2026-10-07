"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { IntlAppearance, IntlData, IntlInjury, IntlRace, InjuryKind } from "@/types/intl";
import ClubRaceChart from "@/components/ClubRaceChart";
// Shared design system — see components/.
import styles from "@/components/dashboard.module.css";
import FilterBar from "@/components/FilterBar";
import { drape, tension } from "@/components/motion";

type Tab = "clubs" | "players" | "race" | "injuries" | "matches";

const KIND_LABEL: Record<InjuryKind, string> = {
  forced_off: "Forced off",
  treated: "Treated on pitch",
  withdrawn: "Withdrew from camp",
  training: "Training injury",
  listed: "Listed injured",
};

const autoTable = { tableLayout: "auto" as const };

function useSort<T>(rows: T[], initial: keyof T) {
  const [key, setKey] = useState<keyof T>(initial);
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const av = a[key], bv = b[key];
        if (typeof av === "number" && typeof bv === "number") return bv - av;
        return String(av ?? "").localeCompare(String(bv ?? ""));
      }),
    [rows, key],
  );
  function Th({ k, label }: { k: keyof T; label: string }) {
    return (
      <th
        className={`${styles.sortTh} ${key === k ? styles.sortThActive : ""}`}
        onClick={() => setKey(k)}
      >
        {label}
        {key === k && <span className={styles.sortArrow}> ▼</span>}
      </th>
    );
  }
  return { sorted, Th };
}

// ---------------------------------------------------------------------------
// Club rollup — who sent the most players, minutes, and who came back hurt
// ---------------------------------------------------------------------------

const per90 = (v: number, mins: number) => (mins > 0 ? Math.round((v / mins) * 90 * 100) / 100 : null);

interface ClubRow {
  club: string;
  league: string;
  players: number;
  minutes: number;
  goals: number;
  assists: number;
  ga: number;
  ga90: number | null;
  shots: number;
  sot: number;
  yc: number;
  rc: number;
  injuries: number;
  injured_names: string;
}

function rollupClubs(apps: IntlAppearance[], injuries: IntlInjury[]): ClubRow[] {
  const map = new Map<string, ClubRow & { ids: Set<string> }>();
  const row = (club: string, league: string | null) => {
    if (!map.has(club))
      map.set(club, {
        club, league: league ?? "—", players: 0, minutes: 0, goals: 0, assists: 0, ga: 0, ga90: null,
        shots: 0, sot: 0, yc: 0, rc: 0, injuries: 0, injured_names: "", ids: new Set(),
      });
    return map.get(club)!;
  };
  for (const a of apps) {
    if (a.club === "Unknown") continue;
    const r = row(a.club, a.league);
    r.ids.add(a.player_id);
    r.minutes += a.minutes;
    r.goals += a.goals;
    r.assists += a.assists;
    r.shots += a.total_shots ?? 0;
    r.sot += a.shots_on_target ?? 0;
    r.yc += a.yellow_cards;
    r.rc += a.red_cards;
  }
  for (const i of injuries) {
    if (i.club === "Unknown") continue;
    const r = row(i.club, i.league);
    r.injuries += 1;
    r.injured_names = r.injured_names ? `${r.injured_names}, ${i.name}` : i.name;
  }
  return [...map.values()].map(({ ids, ...r }) => ({
    ...r, players: ids.size, ga: r.goals + r.assists, ga90: per90(r.goals + r.assists, r.minutes),
  }));
}

function ClubLink({ club, onClick }: { club: string; onClick: (club: string) => void }) {
  return (
    <button className={styles.clubLink} onClick={() => onClick(club)} title={`Show ${club}'s players`}>
      {club}
    </button>
  );
}

function ClubTable({ rows, onClub }: { rows: ClubRow[]; onClub: (club: string) => void }) {
  const { sorted, Th } = useSort(rows, "ga");
  return (
    <>
      <div className={styles.tableMeta}>{sorted.length} clubs</div>
      <div className={styles.tableWrap}>
        <table className={styles.table} style={autoTable}>
          <thead>
            <tr>
              <th>#</th>
              <Th k="club" label="Club" />
              <Th k="players" label="Called up" />
              <Th k="minutes" label="Min" />
              <Th k="goals" label="G" />
              <Th k="assists" label="A" />
              <Th k="ga" label="G+A" />
              <Th k="ga90" label="G+A/90" />
              <Th k="shots" label="Shots" />
              <Th k="sot" label="SOT" />
              <Th k="yc" label="YC" />
              <Th k="rc" label="RC" />
              <Th k="injuries" label="Injuries" />
              <th>Injured</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={c.club}>
                <td className={styles.rank}>{i + 1}</td>
                <td className={styles.nowrap}>
                  <ClubLink club={c.club} onClick={onClub} /> <span className={styles.leagueBadge}>{c.league}</span>
                </td>
                <td className={styles.statCell}>{c.players}</td>
                <td>{c.minutes}</td>
                <td>{c.goals}</td>
                <td>{c.assists}</td>
                <td className={styles.statCell}>{c.ga}</td>
                <td>{c.ga90?.toFixed(2) ?? "—"}</td>
                <td>{c.shots}</td>
                <td>{c.sot}</td>
                <td className={c.yc ? styles.cellAmber : ""}>{c.yc}</td>
                <td className={c.rc ? styles.cellRed : ""}>{c.rc}</td>
                <td className={c.injuries ? styles.cellRed : ""}>{c.injuries || "—"}</td>
                <td className={styles.wrap}>{c.injured_names || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type PlayerRow = IntlAppearance & { ga: number; ga90: number | null; shot_pct: number | null };

function PlayerTable({ apps, onClub }: { apps: IntlAppearance[]; onClub: (club: string) => void }) {
  const rows = useMemo<PlayerRow[]>(
    () =>
      apps.map((a) => ({
        ...a,
        ga: a.goals + a.assists,
        ga90: per90(a.goals + a.assists, a.minutes),
        shot_pct: a.total_shots ? Math.round(((a.shots_on_target ?? 0) / a.total_shots) * 100) : null,
      })),
    [apps],
  );
  const { sorted, Th } = useSort(rows, "ga");
  return (
    <>
      <div className={styles.tableMeta}>{sorted.length} player-windows</div>
      <div className={styles.tableWrap}>
        <table className={styles.table} style={autoTable}>
          <thead>
            <tr>
              <th>#</th>
              <Th k="name" label="Player" />
              <Th k="club" label="Club" />
              <Th k="nationality" label="Nation" />
              <Th k="window" label="Window" />
              <Th k="matches" label="MP" />
              <Th k="starts" label="GS" />
              <Th k="minutes" label="Min" />
              <Th k="goals" label="G" />
              <Th k="assists" label="A" />
              <Th k="ga" label="G+A" />
              <Th k="ga90" label="G+A/90" />
              <Th k="total_shots" label="Shots" />
              <Th k="shots_on_target" label="SOT" />
              <Th k="shot_pct" label="SoT%" />
              <Th k="fouls_committed" label="Fouls" />
              <Th k="yellow_cards" label="YC" />
              <Th k="red_cards" label="RC" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={`${p.player_id}-${p.window}`}>
                <td className={styles.rank}>{i + 1}</td>
                <td className={styles.nowrap}>
                  {p.name}
                  {p.injured && <span className={styles.cellRed} title="Injury recorded this window"> ✚</span>}
                </td>
                <td className={styles.nowrap}><ClubLink club={p.club} onClick={onClub} /></td>
                <td className={styles.nowrap}>{p.nationality}</td>
                <td className={styles.nowrap}>{p.window}</td>
                <td>{p.matches}</td>
                <td>{p.starts ?? "—"}</td>
                <td>{p.minutes}</td>
                <td>{p.goals}</td>
                <td>{p.assists}</td>
                <td className={styles.statCell}>{p.ga}</td>
                <td>{p.ga90?.toFixed(2) ?? "—"}</td>
                <td>{p.total_shots ?? "—"}</td>
                <td>{p.shots_on_target ?? "—"}</td>
                <td>{p.shot_pct == null ? "—" : `${p.shot_pct}%`}</td>
                <td>{p.fouls_committed ?? "—"}</td>
                <td className={p.yellow_cards ? styles.cellAmber : ""}>{p.yellow_cards}</td>
                <td className={p.red_cards ? styles.cellRed : ""}>{p.red_cards}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function InjuryTable({ rows }: { rows: IntlInjury[] }) {
  if (!rows.length) return <div className={styles.loading}>No injuries recorded for this selection.</div>;
  return (
    <>
      <div className={styles.tableMeta}>{rows.length} injuries</div>
      <div className={styles.tableWrap}>
        <table className={styles.table} style={autoTable}>
          <thead>
            <tr>
              <th>Date</th><th>Player</th><th>Club</th><th>Nation</th><th>What happened</th>
              <th>Injury / status</th><th>Match</th><th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.player_id ?? r.name}-${r.window}-${i}`}>
                <td className={styles.nowrap}>{r.date ?? r.window}</td>
                <td className={`${styles.nowrap} ${styles.statCell}`}>{r.name}</td>
                <td className={styles.nowrap}>{r.club}</td>
                <td className={styles.nowrap}>{r.nationality ?? "—"}</td>
                <td className={`${styles.nowrap} ${r.kind === "forced_off" || r.kind === "withdrawn" ? styles.cellRed : ""}`}>
                  {KIND_LABEL[r.kind] ?? r.kind}
                  {r.minute ? ` · ${r.minute}` : ""}
                </td>
                <td className={styles.wrap}>{[r.injury, r.status].filter(Boolean).join(" · ") || "—"}</td>
                <td className={styles.wrap}>{r.match ? `${r.match}${r.competition ? ` (${r.competition})` : ""}` : "—"}</td>
                <td className={styles.nowrap}>
                  {r.source_url ? (
                    <a className={styles.eyebrowLink} href={r.source_url} target="_blank" rel="noopener noreferrer">{r.source}</a>
                  ) : r.source}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MatchTable({ rows }: { rows: IntlData["matches"] }) {
  return (
    <>
      <div className={styles.tableMeta}>{rows.length} matches</div>
      <div className={styles.tableWrap}>
        <table className={styles.table} style={autoTable}>
          <thead><tr><th>Date</th><th>Match</th><th>Competition</th><th>Window</th></tr></thead>
          <tbody>
            {[...rows].reverse().map((m) => (
              <tr key={m.id}>
                <td className={styles.nowrap}>{`${m.date.slice(0, 4)}-${m.date.slice(4, 6)}-${m.date.slice(6)}`}</td>
                <td className={`${styles.nowrap} ${styles.statCell}`}>{m.name}</td>
                <td className={styles.nowrap}>{m.competition}</td>
                <td className={styles.nowrap}>{m.window}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntlPage() {
  const [data, setData] = useState<(Omit<IntlData, "timeseries"> & { selected: string; race: IntlRace | null }) | null>(null);
  const [tab, setTab] = useState<Tab>("clubs");
  // "" until the API tells us the latest window; each window loads on demand
  const [win, setWin] = useState<string>("");
  const [fClub, setFClub] = useState<Set<string>>(new Set());
  const [fLeague, setFLeague] = useState<Set<string>>(new Set());
  const [fNat, setFNat] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data && data.selected === win) return;
    fetch(`/api/v1/intl${win ? `?window=${win}` : ""}`).then((r) => r.json()).then((j) => {
      setData(j.response);
      if (!win) setWin(j.response.selected);
    });
  }, [win]); // eslint-disable-line react-hooks/exhaustive-deps

  const inScope = <T extends { window: string; club: string; league: string | null; nationality: string | null }>(r: T) =>
    (win === "all" || r.window === win) &&
    (!fClub.size || fClub.has(r.club)) &&
    (!fLeague.size || fLeague.has(r.league ?? "")) &&
    (!fNat.size || fNat.has(r.nationality ?? ""));

  const apps = useMemo(() => (data?.appearances ?? []).filter(inScope), [data, win, fClub, fLeague, fNat]); // eslint-disable-line react-hooks/exhaustive-deps
  const injuries = useMemo(() => (data?.injuries ?? []).filter(inScope), [data, win, fClub, fLeague, fNat]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = useMemo(() => (data?.matches ?? []).filter((m) => win === "all" || m.window === win), [data, win]);
  const clubs = useMemo(() => rollupClubs(apps, injuries), [apps, injuries]);

  // Club name → Players tab filtered to that club
  function showClub(club: string) {
    setFClub(new Set([club]));
    setTab("players");
  }

  const opts = (f: (a: IntlAppearance) => string | null) =>
    Array.from(new Set((data?.appearances ?? []).map(f).filter((v): v is string => !!v && v !== "Unknown"))).sort();

  const updatedStr = data?.last_updated
    ? new Date(data.last_updated).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : "";
  const live = data?.windows.find((w) => w.status === "live");
  const kpis: [number, string][] = [
    [new Set(apps.map((a) => a.player_id)).size, "Players used"],
    [apps.reduce((s, a) => s + a.minutes, 0), "Minutes"],
    [injuries.length, "Injuries"],
    [matches.length, "Matches"],
    [clubs.filter((c) => c.players > 0).length, "Clubs"],
  ];

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          INTERNATIONAL BREAKS — CLUB EXPOSURE
          <span className={styles.eyebrowRight}>
            <Link href="/wc2026" className={styles.eyebrowLink}>WORLD CUP 2026 →</Link>
          </span>
        </div>
        <h1 className={styles.title}>
          <span className={styles.titleLight}>Break </span>
          <span className={styles.titleAccent}>Tracker</span>
        </h1>
        <p className={styles.subtitle}>
          <span className={styles.subtitleText}>
            Every FIFA window: which clubs&apos; players got minutes for their country, what they
            produced, and who came back injured.
          </span>
          {live && <span className={styles.stageBadge}>◉ {live.label.toUpperCase()} · LIVE</span>}
          {updatedStr && <span className={styles.updatedBadge}>SYNC {updatedStr}</span>}
        </p>
      </div>

      <div className={styles.kpiSecondary}>
        {kpis.map(([v, label]) => (
          <div key={label} className={styles.kpiCellSm}>
            <div className={`${styles.cardValueSm} ${label === "Injuries" ? styles.valRed : ""}`}>{v}</div>
            <div className={styles.cardLabelSm}>{label}</div>
          </div>
        ))}
      </div>

      <div className={styles.tabs}>
        {([["clubs", "Clubs"], ["players", "Players"], ["race", "Race"], ["injuries", "Injuries"], ["matches", "Matches"]] as [Tab, string][]).map(
          ([key, label]) => (
            <button key={key} className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`} onClick={() => setTab(key)}>
              {label}
              {tab === key && <motion.span layoutId="intl-tab" className={styles.tabUnderline} transition={tension} />}
            </button>
          ),
        )}
      </div>

      {!data ? (
        <div className={styles.loading}>Loading data…</div>
      ) : (
        <div className={styles.tabContent}>
          <div className={styles.tableFilters} style={{ flexDirection: "column", alignItems: "flex-start" }}>
            <div className={styles.chartToggleGroup}>
              {[{ id: "all", label: "All windows", matches: 1 }, ...data.windows]
                .filter((w) => w.matches > 0)
                .map((w) => (
                  <button
                    key={w.id}
                    className={`${styles.chartToggle} ${win === w.id ? styles.chartToggleActive : ""}`}
                    onClick={() => setWin(w.id)}
                  >
                    {w.label}
                  </button>
                ))}
            </div>
            <FilterBar
              filters={[
                { label: "League", options: opts((a) => a.league), selected: fLeague, onChange: setFLeague },
                { label: "Club", options: opts((a) => a.club), selected: fClub, onChange: setFClub },
                { label: "Nation", options: opts((a) => a.nationality), selected: fNat, onChange: setFNat },
              ]}
            />
          </div>
          {!data.windows.some((w) => w.matches > 0) ? (
            <div className={styles.loading}>No international-break data yet — run scripts/fetch_intl.py.</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: drape }}>
                {tab === "clubs" && <ClubTable rows={clubs} onClub={showClub} />}
                {tab === "players" && <PlayerTable apps={apps} onClub={showClub} />}
                {tab === "race" && (
                  <ClubRaceChart
                    matchdays={data.race?.matchdays ?? []}
                    series={data.race?.series ?? {}}
                    title="Break"
                  />
                )}
                {tab === "injuries" && <InjuryTable rows={injuries} />}
                {tab === "matches" && <MatchTable rows={matches} />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      <footer className={styles.colophon}>
        <span>INTERNATIONAL BREAKS — CLUB SHOWOUT · DATA: PUBLIC ESPN API</span>
      </footer>
    </main>
  );
}
