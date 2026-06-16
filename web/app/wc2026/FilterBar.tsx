"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./wc2026.module.css";

export interface FilterSpec {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  renderOption?: (value: string) => React.ReactNode;
}

function FilterChip({ spec }: { spec: FilterSpec }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = spec.selected.size > 0;
  const filtered = query
    ? spec.options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : spec.options;

  function toggle(value: string) {
    const next = new Set(spec.selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    spec.onChange(next);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className={`${styles.filterChip} ${active ? styles.filterChipActive : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        {spec.label}
        {active && <span className={styles.filterChipCount}>{spec.selected.size}</span>}
        <span className={styles.filterChipCaret}>▾</span>
      </button>

      {open && (
        <div className={styles.popover} style={{ left: 0 }}>
          {spec.options.length > 8 && (
            <input
              className={styles.popoverSearch}
              placeholder={`Search ${spec.label.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          )}
          <div className={styles.popoverList}>
            {filtered.map((opt) => {
              const isSel = spec.selected.has(opt);
              return (
                <div
                  key={opt}
                  className={`${styles.popoverItem} ${isSel ? styles.popoverItemActive : ""}`}
                  onClick={() => toggle(opt)}
                >
                  <span className={styles.popoverCheck}>{isSel ? "✓" : ""}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {spec.renderOption ? spec.renderOption(opt) : opt}
                  </span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className={styles.popoverItem} style={{ cursor: "default", color: "var(--text-3)" }}>
                No matches
              </div>
            )}
          </div>
          {active && (
            <div className={styles.popoverFooter}>
              <button className={styles.popoverClear} onClick={() => spec.onChange(new Set())}>
                Clear ({spec.selected.size})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({ filters }: { filters: FilterSpec[] }) {
  const anyActive = filters.some((f) => f.selected.size > 0);
  return (
    <div className={styles.filterBar2}>
      <span className={styles.filterBarLabel}>Cut by</span>
      {filters.map((f) => <FilterChip key={f.label} spec={f} />)}
      {anyActive && (
        <button
          className={styles.clearBtn}
          onClick={() => filters.forEach((f) => f.onChange(new Set()))}
        >
          Clear all
        </button>
      )}
    </div>
  );
}
