import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "International Break Tracker",
  description: "Every FIFA window: which clubs' players got minutes for their country, what they produced, and who came back injured.",
};

export default function IntlLayout({ children }: { children: React.ReactNode }) {
  return children;
}
