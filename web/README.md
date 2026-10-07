# web

Next.js app for Club Showout — see the [root README](../README.md) for what it shows and how
the data gets here.

```bash
npm install
npm run dev    # http://localhost:3000  (/, /wc2026, /intl)
```

- `app/wc2026/`, `app/intl/` — one dashboard per competition
- `app/api/v1/` — JSON routes over `data/*.json` (written by `scripts/` at the repo root)
- `components/` — shared tables, charts, filters and `dashboard.module.css`
- `lib/stores/` — one data reader per competition
