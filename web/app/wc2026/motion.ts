"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue, useSpring, useReducedMotion, animate } from "framer-motion";

// ── Textile springs ─────────────────────────────────────────────────────────
// DRAPE — heavy fabric settling: panels opening, tab content entering.
export const drape = { type: "spring", mass: 1.2, stiffness: 60, damping: 18 } as const;
// TENSION — thread pulled taut: data updates, sort reorder, number changes.
export const tension = { type: "spring", stiffness: 260, damping: 28 } as const;
// GATHER — fabric folded/pleated: rows filtering out, collapsing.
export const gather = { type: "spring", stiffness: 200, damping: 24 } as const;

// ── Load sequence variants — laying the pattern onto the table ──────────────
export const layIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: drape },
};

export const stagger = (delay = 0.06) => ({
  animate: { transition: { staggerChildren: delay } },
});

// ── Counter pull — count from previous value to new, not from zero ──────────
export function useCountUp(value: number) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      ...tension,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return display;
}

export { useMotionValue, useSpring, useReducedMotion };
