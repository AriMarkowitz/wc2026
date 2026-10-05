"""
ESPN athlete profiles: club, league, position, age, nationality, sun sign,
injury status — competition-agnostic.
"""

from core import espn
from core.leagues import league_from_slug

ESPN_ATHLETE_BASE = "https://site.api.espn.com/apis/common/v3/sports/soccer/athletes"


_SIGNS = [
    (1, 20, "Capricorn"), (2, 19, "Aquarius"), (3, 20, "Pisces"),
    (4, 20, "Aries"),     (5, 21, "Taurus"),   (6, 21, "Gemini"),
    (7, 22, "Cancer"),    (8, 23, "Leo"),       (9, 23, "Virgo"),
    (10, 23, "Libra"),    (11, 22, "Scorpio"),  (12, 22, "Sagittarius"),
    (12, 31, "Capricorn"),
]

def _parse_dob(dob_str: str | None) -> tuple[int, int] | None:
    """Return (month, day) from an ISO date 'YYYY-MM-DD...'. Only ISO is accepted
    because ESPN's locale 'D/M/YYYY' vs 'M/D/YYYY' is ambiguous and unreliable."""
    if not dob_str:
        return None
    try:
        # ISO: 2001-07-03T07:00Z  → year-month-day
        date_part = dob_str.split("T")[0]
        y, m, d = date_part.split("-")
        return int(m), int(d)
    except Exception:
        return None


def _sun_sign(dob_str: str | None) -> str | None:
    parsed = _parse_dob(dob_str)
    if not parsed:
        return None
    month, day = parsed
    for end_month, end_day, sign in _SIGNS:
        if month < end_month or (month == end_month and day <= end_day):
            return sign
    return None


def _injury_status(athlete: dict) -> dict | None:
    """Latest listed injury on an ESPN athlete profile, if any. ESPN only
    populates `injuries` for some leagues, so this is best-effort."""
    injuries = athlete.get("injuries") or []
    if not injuries:
        return None
    inj = injuries[0]
    details = inj.get("details") or {}
    return {
        "status": inj.get("status") or (inj.get("type") or {}).get("description"),
        "date": inj.get("date"),
        "type": details.get("type") or details.get("location"),
        "return_date": details.get("returnDate"),
    }


def fetch_athlete_profile(player_id: str, iso_dob: str | None = None) -> dict:
    try:
        data = espn.get(f"{ESPN_ATHLETE_BASE}/{player_id}")
        athlete = data.get("athlete", {})
        team = athlete.get("team", {})
        club = team.get("displayName")
        # Derive a clean, stable league name from the team slug (e.g. "eng.arsenal").
        # ESPN's groups[].name is unreliable ("Grand Final", "2026", "Promotion Final").
        league = league_from_slug(team.get("slug"), club)
        # Prefer the unambiguous ISO DOB from the squad roster. Fall back to the
        # profile's ISO dateOfBirth; never trust the ambiguous displayDOB.
        dob_iso = iso_dob or athlete.get("dateOfBirth")
        sun_sign = _sun_sign(dob_iso)
        return {
            "player_id": player_id,
            "name": athlete.get("displayName", ""),
            "club": club,
            "league": league,
            "position": athlete.get("position", {}).get("displayName"),
            "age": athlete.get("age"),
            "dob": dob_iso,
            "sun_sign": sun_sign,
            "nationality": athlete.get("citizenship"),
            "photo": None,
            "injury_status": _injury_status(athlete),
        }
    except Exception as e:
        print(f"  Warning: could not fetch profile for player {player_id}: {e}")
        return {"player_id": player_id}
