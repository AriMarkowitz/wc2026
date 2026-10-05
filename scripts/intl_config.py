"""
International-break configuration — kept separate from the World Cup config so
the two pipelines never touch each other's data.

WINDOWS follow the FIFA International Match Calendar 2026–2030 (from 2026 the
September and October windows are merged into one four-match window). Check the
dates against FIFA's published calendar before each season, and append new
windows here. Windows that haven't started yet are skipped automatically.
"""

from config import DATA_DIR, PROJECT_ROOT

ESPN_SOCCER = "https://site.api.espn.com/apis/site/v2/sports/soccer"

# id, label, start (YYYYMMDD), end (YYYYMMDD) — inclusive
WINDOWS = [
    {"id": "2026-09", "label": "Sep/Oct 2026", "start": "20260921", "end": "20261006"},
    {"id": "2026-11", "label": "Nov 2026",     "start": "20261109", "end": "20261117"},
    {"id": "2027-03", "label": "Mar 2027",     "start": "20270322", "end": "20270330"},
    {"id": "2027-06", "label": "Jun 2027",     "start": "20270531", "end": "20270608"},
    {"id": "2027-09", "label": "Sep/Oct 2027", "start": "20270920", "end": "20271005"},
    {"id": "2027-11", "label": "Nov 2027",     "start": "20271108", "end": "20271116"},
]

# ESPN league slugs scanned during each window. Any slug ESPN doesn't serve
# (or that has no matches yet) is skipped with a warning.
COMPETITIONS = {
    "fifa.friendly":           "International Friendly",
    "uefa.nations":            "UEFA Nations League",
    "uefa.euroq":              "Euro Qualifying",
    "fifa.worldq.uefa":        "WC Qualifying — UEFA",
    "fifa.worldq.conmebol":    "WC Qualifying — CONMEBOL",
    "fifa.worldq.concacaf":    "WC Qualifying — CONCACAF",
    "fifa.worldq.caf":         "WC Qualifying — CAF",
    "fifa.worldq.afc":         "WC Qualifying — AFC",
    "fifa.worldq.ofc":         "WC Qualifying — OFC",
    "concacaf.nations.league": "CONCACAF Nations League",
    "caf.nations_qual":        "AFCON Qualifying",
    "afc.asian.cup_qual":      "Asian Cup Qualifying",
}

# Refetch a player's club profile after this many days (transfers, injuries).
PROFILE_TTL_DAYS = 14

INTL_DATA_DIR       = DATA_DIR / "intl"
INTL_CACHE_FILE     = INTL_DATA_DIR / "intl.json"
INTL_PROFILE_FILE   = INTL_DATA_DIR / "player_profiles.json"
# Hand-recorded injuries (camp withdrawals, training knocks, club-confirmed
# diagnoses) that never show up in match data. See the file for the format.
INTL_MANUAL_INJURIES = INTL_DATA_DIR / "injuries_manual.json"

WEB_INTL_FILE = PROJECT_ROOT / "web" / "data" / "intl.json"
