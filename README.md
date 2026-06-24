# FIFA World Cup 2026 — Club Dashboard

**Live at [clubshowout.vercel.app/wc2026](https://clubshowout.vercel.app/wc2026)**

Which domestic clubs are showing out most at the World Cup? Every player's tournament output — goals, assists, minutes, cards — cut and sorted by the club they go home to.

![Club Dashboard](dashboard-screenshot.png)

## What it tracks

- **89 goals · 1,246 players · 62 assists** across all WC 2026 matches
- Club rankings by goals, G+A, G/90, A/90, and G+A/90
- Player stats leaderboard
- Goalkeeper stats
- Charts & astrology tab
- Filter by club or league

## Data

Sourced from ESPN's public API. A GitHub Actions workflow fetches fresh stats ~30 minutes after each match ends (150 min after kickoff) and commits the updated JSON to the repo, which triggers a Vercel redeploy.

## Stack

- **Data pipeline:** Python, ESPN public API
- **Frontend:** Next.js, deployed on Vercel
- **Automation:** GitHub Actions (cron per kickoff slot)
