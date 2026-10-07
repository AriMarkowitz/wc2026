"use client";

import { useState } from "react";
import styles from "./dashboard.module.css";

// Race-chart palette — engineered for separation, not just variety. The old
// set packed ten same-lightness pastels (three greens, blue/periwinkle, three
// warm mid-tones) that collided in a static screenshot with no hover to help.
// This set spreads hue widely AND ladders lightness (dark/light/dark…) so any
// two adjacent slots differ in *value*, staying legible in greyscale / CVD.
// Ordered so the top-ranked lines (which run highest and matter most) get the
// most saturated, highest-contrast hues.
export const CHART_COLORS = [
  "#C4943A", // 1 · gold        (warm, dark)
  "#3E6E8E", // 2 · deep teal-blue
  "#C2603D", // 3 · burnt orange
  "#6FA98C", // 4 · sage green  (light)
  "#8B4A6F", // 5 · plum        (dark)
  "#D9B36B", // 6 · wheat       (light)
  "#2E6E5E", // 7 · pine        (dark, distinct from sage)
  "#B58DB0", // 8 · mauve       (light)
  "#4B5A8A", // 9 · indigo      (dark, distinct from teal-blue)
  "#9DAE6B", // 10 · olive
];

export type RaceMetric = "ga" | "goals" | "assists";
export type RaceSeries = Record<string, { goals: number[]; assists: number[]; ga: number[] }>;

/**
 * Cumulative club race: one line per club over `matchdays` (YYYYMMDD), top-N by
 * the selected metric, direct-labelled at the line ends. `controls` renders
 * ahead of the metric / top-N toggles (e.g. a view switch).
 */
export default function ClubRaceChart({
  matchdays, series, title, controls,
}: {
  matchdays: string[];
  series: RaceSeries;
  title?: string;
  controls?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [metric, setMetric] = useState<RaceMetric>("ga");
  const [topN, setTopN] = useState(10);
  type Metric = RaceMetric;

  if (matchdays.length === 0) {
    return (
      <div>
        {controls && <div className={styles.chartControls}>{controls}</div>}
        <div className={styles.loading}>No matchday data yet.</div>
      </div>
    );
  }

  const allClubs = Object.keys(series)
    .sort((a, b) => {
      const av = series[a][metric];
      const bv = series[b][metric];
      return (bv[bv.length - 1] ?? 0) - (av[av.length - 1] ?? 0);
    });
  const clubs = allClubs.slice(0, topN);
  if (clubs.length === 0) return <div className={styles.loading}>No data yet.</div>;

  const getSeries = (club: string) => series[club][metric];

  const W = 1180, H = 560, PAD = { top: 52, right: 232, bottom: 56, left: 56 };
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

  // Direct end-of-line labels replace the side legend: put each club's name at
  // the end of its own strand so the eye never leaves the data. Lines that
  // finish at nearly the same height would overlap, so we lay out the label
  // y-positions greedily (top→bottom) and push each down to clear the previous.
  const LABEL_GAP = 15; // min vertical spacing between stacked labels
  const endLabels = (() => {
    const items = clubs.map((club, ci) => {
      const vals = getSeries(club);
      return { club, ci, lastVal: vals[vals.length - 1], yData: yPos(vals[vals.length - 1]) };
    });
    // sort by natural y (highest line first), then de-collide downward
    const ordered = [...items].sort((a, b) => a.yData - b.yData);
    let prevY = -Infinity;
    for (const it of ordered) {
      const y = Math.max(it.yData, prevY + LABEL_GAP);
      (it as typeof it & { yLabel: number }).yLabel = y;
      prevY = y;
    }
    return ordered as (typeof items[number] & { yLabel: number })[];
  })();

  // x-axis: with a long tournament, labelling every day is noise. Show ~10
  // evenly spaced date ticks; keep a faint notch on the rest.
  const xTickEvery = Math.max(1, Math.ceil(matchdays.length / 10));

  const lastDate = matchdays[matchdays.length - 1];
  const asOf = lastDate
    ? `${lastDate.slice(4, 6)}/${lastDate.slice(6, 8)}/${lastDate.slice(0, 4)}`
    : "";

  return (
    <div>
      <div className={styles.chartControls}>
        {controls}
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
          {/* Baked-in title + as-of date so the screenshot is self-contained */}
          <text x={PAD.left} y={22} fontSize={15} fontFamily="var(--font-serif)"
            fontStyle="italic" fontWeight={600} fill="var(--carbon)">
            {title ?? "Club"} {metricLabel} Race
            <tspan fontFamily="var(--font-sans)" fontStyle="normal" fontWeight={500}
              fontSize={11} fill="var(--slate)"> · Cumulative, top {clubs.length}</tspan>
          </text>
          {asOf && (
            <text x={W - PAD.right} y={22} textAnchor="end" fontSize={10}
              fontFamily="var(--font-mono)" letterSpacing="0.08em" fill="var(--slate)">
              AS OF {asOf}
            </text>
          )}

          {/* draft guide lines — faint chalk on the pattern sheet */}
          {yTicks.map((v, ti) => (
            <line key={ti}
              x1={PAD.left} x2={W - PAD.right}
              y1={yPos(v)} y2={yPos(v)}
              stroke="var(--seam-soft)" strokeWidth={1}
              strokeDasharray={v === 0 ? undefined : "2 4"}
            />
          ))}
          {yTicks.map((v, ti) => (
            <text key={ti} x={PAD.left - 8} y={yPos(v) + 3}
              textAnchor="end" fontSize={9} fontFamily="var(--font-mono)"
              fill="var(--slate)">{v}</text>
          ))}
          {/* x axis — notch every day, label ~every 10th to cut clutter */}
          {matchdays.map((d, i) => {
            const show = i % xTickEvery === 0 || i === matchdays.length - 1;
            return (
              <g key={d}>
                <line x1={xPos(i)} x2={xPos(i)} y1={PAD.top + chartH} y2={PAD.top + chartH + (show ? 5 : 3)}
                  stroke={show ? "var(--slate)" : "var(--seam)"} strokeWidth={1} />
                {show && (
                  <text
                    x={xPos(i)} y={H - PAD.bottom + 16}
                    textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)"
                    fill="var(--slate)"
                  >
                    {`${d.slice(4, 6)}.${d.slice(6, 8)}`}
                  </text>
                )}
              </g>
            );
          })}
          {/* y axis caption */}
          <text
            x={PAD.left - 34} y={PAD.top + chartH / 2}
            textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)"
            letterSpacing="0.1em" fill="var(--slate)"
            transform={`rotate(-90,${PAD.left - 34},${PAD.top + chartH / 2})`}
          >
            CUMULATIVE {metricLabel.toUpperCase()}
          </text>

          {/* threads — each club is a single taut strand. Leaders (top 3) run
              slightly heavier so the eye reads the race order first. */}
          {clubs.map((club, ci) => {
            const color = CHART_COLORS[ci % CHART_COLORS.length];
            const dash = ci < CHART_COLORS.length ? "" : "6 4";
            const active = hovered === club;
            const dim = hovered !== null && !active;
            const base = ci < 3 ? 2.75 : 2;
            return (
              <polyline key={club}
                points={polyline(getSeries(club))}
                fill="none"
                stroke={active ? "var(--gold)" : color}
                strokeWidth={active ? 3.75 : base}
                strokeDasharray={active ? undefined : dash}
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
                cx={xPos(matchdays.length - 1)} cy={yPos(lastVal)} r={active ? 3.5 : 2.5}
                fill={active ? "var(--gold)" : color}
                stroke="var(--calico)" strokeWidth={1.25}
                opacity={dim ? 0.18 : 1}
                style={{ transition: "opacity 0.15s" }}
                onMouseEnter={() => setHovered(club)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
          {/* direct end-of-line labels — replace the side legend. A short
              connector runs from the line's true end up/down to the de-collided
              label so it stays legible even when lines finish close together. */}
          {endLabels.map(({ club, ci, lastVal, yData, yLabel }) => {
            const color = CHART_COLORS[ci % CHART_COLORS.length];
            const active = hovered === club;
            const dim = hovered !== null && !active;
            const x0 = xPos(matchdays.length - 1);
            const xText = W - PAD.right + 12;
            return (
              <g key={club}
                style={{ cursor: "pointer", opacity: dim ? 0.28 : 1, transition: "opacity 0.15s" }}
                onMouseEnter={() => setHovered(club)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* elbow connector from knot to label row */}
                <path
                  d={`M${x0},${yData} L${xText - 6},${yLabel}`}
                  fill="none"
                  stroke={active ? "var(--gold)" : color}
                  strokeWidth={1}
                  opacity={0.5}
                />
                <text x={xText} y={yLabel + 3.5}
                  fontSize={12} fontFamily="var(--font-sans)"
                  fontWeight={active ? 700 : ci < 3 ? 600 : 500}
                  fill={active ? "var(--gold)" : color}>
                  {club.length > 17 ? club.slice(0, 16) + "…" : club}
                  <tspan fontFamily="var(--font-mono)" fontWeight={500} fill="var(--slate)"> {lastVal}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
