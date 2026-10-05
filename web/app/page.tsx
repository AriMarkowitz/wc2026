import Link from "next/link";
import styles from "@/components/dashboard.module.css";
import { getMeta } from "@/lib/stores/wc2026";
import { getIntlData } from "@/lib/stores/intl";

// Re-read the data files on each request so a pipeline commit shows up without a rebuild.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [wc, intl] = await Promise.all([getMeta(), getIntlData()]);
  const live = intl.windows.find((w) => w.status === "live");
  const latest = live ?? [...intl.windows].reverse().find((w) => w.matches > 0);

  const sections = [
    {
      href: "/intl",
      eyebrow: live ? `${live.label} · LIVE` : "INTERNATIONAL BREAKS",
      title: "Break Tracker",
      blurb: "Every FIFA window: which clubs' players got minutes for their country, what they produced, and who came back injured.",
      stats: [
        [intl.matches.length, "Matches"],
        [intl.injuries.length, "Injuries"],
        [latest ? latest.label : "—", "Latest window"],
      ],
    },
    {
      href: "/wc2026",
      eyebrow: `WORLD CUP 2026 · ${(wc.stage ?? "").toUpperCase()}`,
      title: "World Cup Club Dashboard",
      blurb: "Which domestic clubs showed out at the World Cup — every player's tournament output, sorted by the club they went home to.",
      stats: [
        [wc.matches_played, "Matches"],
        [wc.total_goals, "Goals"],
        [wc.clubs.length, "Clubs"],
      ],
    },
  ] as const;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          CLUB SHOWOUT — DATA: PUBLIC ESPN API
        </div>
        <h1 className={styles.title}>
          <span className={styles.titleLight}>Club </span>
          <span className={styles.titleAccent}>Showout</span>
        </h1>
        <p className={styles.subtitle}>
          <span className={styles.subtitleText}>
            Domestic clubs, measured by what their players do for their countries.
          </span>
        </p>
      </div>

      {sections.map((s) => (
        <Link key={s.href} href={s.href} style={{ display: "block", textDecoration: "none" }} className={styles.header}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            {s.eyebrow}
            <span className={styles.eyebrowRight}>OPEN →</span>
          </div>
          <h2 className={styles.title} style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)" }}>
            <span className={styles.titleAccent}>{s.title}</span>
          </h2>
          <p className={styles.subtitle}>
            <span className={styles.subtitleText}>{s.blurb}</span>
          </p>
          <div className={styles.kpiSecondary} style={{ padding: 0, border: "none", marginTop: "1rem" }}>
            {s.stats.map(([v, label]) => (
              <div key={label} className={styles.kpiCellSm}>
                <div className={styles.cardValueSm}>{v}</div>
                <div className={styles.cardLabelSm}>{label}</div>
              </div>
            ))}
          </div>
        </Link>
      ))}

      <footer className={styles.colophon}>
        <span>CLUB SHOWOUT · BUILT WITH CLAUDE</span>
      </footer>
    </main>
  );
}
