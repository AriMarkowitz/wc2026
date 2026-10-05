from core.paths import DATA_ROOT, WEB_DATA_DIR

# ESPN public API — no key, no auth
ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"

# WC 2026 dates
WC_START_DATE = "20260611"
WC_END_DATE   = "20260718"

# Paths
DATA_DIR          = DATA_ROOT / "wc2026"
CACHE_FILE        = DATA_DIR / "wc2026.json"
PLAYER_CACHE_FILE = DATA_DIR / "player_profiles.json"  # athlete profile cache (club, age, etc.)

# Mirror the output to web/data/ so Vercel's Next.js can fs.readFile it
WEB_CACHE_FILE = WEB_DATA_DIR / "wc2026.json"
