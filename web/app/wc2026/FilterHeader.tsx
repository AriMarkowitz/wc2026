"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./wc2026.module.css";

interface FilterHeaderProps {
  label: string;
  /** All distinct option values for this column */
  options: string[];
  /** Currently selected values (empty = no filter) */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Sort handling */
  sortActive: boolean;
  onSort: () => void;
  /** Optional label renderer (e.g. add emoji) */
  renderOption?: (value: string) => React.ReactNode;
  title?: string;
}

export default function FilterHeader({
  label, options, selected, onChange, sortActive, onSort, renderOption, title,
}: FilterHeaderProps) {
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

  const active = selected.size > 0;
  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  return (
    <div className={styles.thInner} ref={ref} style={{ position: "relative" }}>
      <span
        className={`${styles.thLabel} ${sortActive ? styles.sortThActive : ""}`}
        onClick={onSort}
        title={title}
      >
        {label}{sortActive && <span className={styles.sortArrow}> ▼</span>}
      </span>
      <button
        className={`${styles.funnelBtn} ${active ? styles.funnelBtnActive : ""}`}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title={`Filter by ${label}`}
        aria-label={`Filter by ${label}`}
      >
        {active ? "▣" : "▽"}
      </button>

      {open && (
        <div className={styles.popover} onClick={(e) => e.stopPropagation()}>
          {options.length > 8 && (
            <input
              className={styles.popoverSearch}
              placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          )}
          <div className={styles.popoverList}>
            {filtered.map((opt) => {
              const isSel = selected.has(opt);
              return (
                <div
                  key={opt}
                  className={`${styles.popoverItem} ${isSel ? styles.popoverItemActive : ""}`}
                  onClick={() => toggle(opt)}
                >
                  <span className={styles.popoverCheck}>{isSel ? "✓" : ""}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {renderOption ? renderOption(opt) : opt}
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
              <button className={styles.popoverClear} onClick={() => onChange(new Set())}>
                Clear ({selected.size})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
