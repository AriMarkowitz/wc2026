"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import styles from "./wc2026.module.css";
import { tension } from "./motion";

// ---------------------------------------------------------------------------
// MetricChart — one reusable horizontal bar chart, driven by a table's own
// numeric-column config. Each table (clubs / players / gk / astrology) already
// declares the columns it can sort by; that same list *is* the metric picker,
// so there is zero duplicated config.
//
// A bar chart of "top-N rows by a single metric" encodes MAGNITUDE of one
// series — so it uses a single hue (gold), not the categorical line palette.
// Rank gives a gentle opacity fade for depth; the leader reads full-strength.
// ---------------------------------------------------------------------------

export interface MetricDef<T> {
  /** stable key, unique within the table */
  key: string;
  /** header shown in the picker + axis caption */
  label: string;
  /** pull the numeric value for a row (null/undefined → treated as missing) */
  value: (row: T) => number | null | undefined;
  /** decimal places for the value label (default 0) */
  dec?: number;
  /** short unit/suffix appended to the value label, e.g. "%" */
  suffix?: string;
  /** lower values are better (min/goal, GC/90) — sorts ascending, flips label */
  lowerBetter?: boolean;
}

interface MetricChartProps<T> {
  rows: T[];
  /** the numeric columns available to chart */
  metrics: MetricDef<T>[];
  /** row -> display name for the y-axis */
  label: (row: T) => string;
  /** row -> stable react key */
  rowKey: (row: T) => string;
  /** initial metric key (defaults to the first metric) */
  defaultMetric?: string;
}

const TOP_N_CHOICES = [10, 15, 20, 30] as const;

export default function MetricChart<T>({
  rows, metrics, label, rowKey, defaultMetric,
}: MetricChartProps<T>) {
  const [metricKey, setMetricKey] = useState(defaultMetric ?? metrics[0]?.key);
  const [topN, setTopN] = useState<number>(15);
  const [hovered, setHovered] = useState<string | null>(null);

  const metric = useMemo(
    () => metrics.find((m) => m.key === metricKey) ?? metrics[0],
    [metrics, metricKey],
  );

  // Rank rows by the chosen metric, drop missing values, take the top N.
  const ranked = useMemo(() => {
    if (!metric) return [];
    const withVals = rows
      .map((r) => ({ row: r, v: metric.value(r) }))
      .filter((x): x is { row: T; v: number } => x.v != null && Number.isFinite(x.v));
    withVals.sort((a, b) => (metric.lowerBetter ? a.v - b.v : b.v - a.v));
    return withVals.slice(0, topN);
  }, [rows, metric, topN]);

  if (!metric) return <div className={styles.loading}>No chartable columns.</div>;

  const maxV = ranked.length ? Math.max(...ranked.map((x) => Math.abs(x.v))) : 0;
  const fmt = (v: number) =>
    `${v.toFixed(metric.dec ?? 0)}${metric.suffix ?? ""}`;

  return (
    <div>
      <div className={styles.chartControls}>
        <div className={styles.metricPickerWrap}>
          <span className={styles.metricPickerLabel}>Metric</span>
          <select
            className={styles.metricSelect}
            value={metric.key}
            onChange={(e) => setMetricKey(e.target.value)}
          >
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.chartToggleGroup}>
          {TOP_N_CHOICES.map((n) => (
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

      {ranked.length === 0 ? (
        <div className={styles.loading}>No data for this metric.</div>
      ) : (
        <div className={styles.barChart}>
          {metric.lowerBetter && (
            <div className={styles.barChartNote}>Lower is better — shortest bar leads.</div>
          )}
          {ranked.map(({ row, v }, i) => {
            const key = rowKey(row);
            const pct = maxV > 0 ? (Math.abs(v) / maxV) * 100 : 0;
            const active = hovered === key;
            const dim = hovered !== null && !active;
            // single-hue depth fade: leader full gold, tail eased toward slate
            const t = ranked.length > 1 ? i / (ranked.length - 1) : 0;
            const barOpacity = 1 - t * 0.55;
            return (
              <div
                key={key}
                className={styles.barRow}
                style={{ opacity: dim ? 0.4 : 1 }}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className={styles.barRank}>{i + 1}</span>
                <span className={styles.barLabel} title={label(row)}>{label(row)}</span>
                <div className={styles.barTrack}>
                  <motion.div
                    className={styles.barFill}
                    style={{
                      background: "var(--gold)",
                      opacity: active ? 1 : barOpacity,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={tension}
                  />
                  <span className={styles.barValue}>{fmt(v)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
