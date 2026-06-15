"use client";

import { useRef, useState } from "react";
import styles from "./wc2026.module.css";

/**
 * Instant tooltip that renders its bubble as `position: fixed` so it is never
 * clipped by table cell `overflow: hidden` / `overflow-x: auto`.
 */
export default function Tooltip({
  text, children, className,
}: {
  text: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  function show() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: r.left, y: r.top });
  }

  return (
    <span
      ref={ref}
      className={`${styles.tip} ${className ?? ""}`}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <span
          className={styles.tipFixed}
          role="tooltip"
          style={{ left: pos.x, top: pos.y - 8 }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
