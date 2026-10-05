import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WC 2026 Club Dashboard",
  description: "Which domestic clubs are showing out most at the World Cup — player output cut and sorted by club.",
};

export default function Wc2026Layout({ children }: { children: React.ReactNode }) {
  return children;
}
