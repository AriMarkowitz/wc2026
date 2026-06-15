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
  const handlers = useRef<{ move?: (e: PointerEvent) => void; up?: () => void }>({});

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
      handlers.current = { move: onMove, up: onUp };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [],
  );

  return { widths, startResize, resizing };
}
