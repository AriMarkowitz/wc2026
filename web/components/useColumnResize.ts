"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Manages per-column widths with drag-to-resize.
 * Returns the current widths map and a handler factory for resize grips.
 */
export function useColumnResize(initial: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(initial);
  const [resizing, setResizing] = useState<string | null>(null);
  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null);

  /**
   * Auto-fit a column to its widest visible cell. Reads rendered cell widths
   * from the table the resize grip lives in, so it works with table-layout:fixed.
   */
  const autoFit = useCallback((key: string, colIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).closest("th");
    const table = th?.closest("table");
    if (!table) return;
    let max = 0;
    // Header content
    const headerInner = th?.querySelector("span, div");
    if (headerInner) max = Math.max(max, (headerInner as HTMLElement).scrollWidth);
    // Body cells in this column
    table.querySelectorAll("tbody tr").forEach((tr) => {
      const cell = tr.children[colIndex] as HTMLElement | undefined;
      if (cell) {
        const child = cell.firstElementChild as HTMLElement | null;
        const w = child ? child.scrollWidth : cell.scrollWidth;
        max = Math.max(max, w);
      }
    });
    const padding = 28; // cell horizontal padding + grip allowance
    setWidths((w) => ({ ...w, [key]: Math.max(48, Math.min(max + padding, 520)) }));
  }, []);

  const startResize = useCallback(
    (key: string) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setWidths((w) => {
        drag.current = { key, startX: e.clientX, startW: w[key] ?? 120 };
        return w;
      });
      setResizing(key);

      const onMove = (ev: PointerEvent) => {
        if (!drag.current) return;
        const { key: k, startX, startW } = drag.current;
        const next = Math.max(48, startW + (ev.clientX - startX));
        setWidths((w) => ({ ...w, [k]: next }));
      };
      const onUp = () => {
        drag.current = null;
        setResizing(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [],
  );

  return { widths, startResize, autoFit, resizing };
}
