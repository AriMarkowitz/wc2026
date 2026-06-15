"""
Fetch World Cup 2026 player stats from ESPN's public API and write wc2026.json.

Usage:
    python scripts/fetch_data.py               # incremental update (skips already-fetched matches)
    python scripts/fetch_data.py --full        # re-fetch all matches from scratch
"""

import argparse
import json
from datetime import date, timedelta
from pathlib import Path

import api_client
from config import (
    CACHE_FILE,
    DATA_DIR,
    ESPN_ATHLETE_BASE,
    ESPN_BASE,
    PLAYER_CACHE_FILE,
    WC_END_DATE,
    WC_START_DATE,
    WEB_CACHE_FILE,
    WEB_DATA_DIR,
)
from leagues import league_from_slug
from transform import build_output


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json(path: Path):
    if path.exists():
        return json.loads(path.read_text())
    return {}


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"  Wrote {path}")


def date_range(start: str, end: str):
    """Yield YYYYMMDD strings from start to min(end, today)."""
    s = date(int(start[:4]), int(start[4:6]), int(start[6:]))
    e = min(date(int(end[:4]), int(end[4:6]), int(end[6:])), date.today())
    current = s
    while current <= e:
        yield current.strftime("%Y%m%d")
        current += timedelta(days=1)


# ---------------------------------------------------------------------------
# Step 1: Collect all completed WC event IDs
# ---------------------------------------------------------------------------

def fetch_event_ids() -> tuple[list[dict], dict[str, str]]:
    """Return (completed matches, {national_team_id: name}) seen so far at the WC."""
    events = []
    team_ids: dict[str, str] = {}
    for day in date_range(WC_START_DATE, WC_END_DATE):
        data = api_client.get(f"{ESPN_BASE}/scoreboard", {"dates": day})
        for event in data.get("events", []):
            for comp in event.get("competitions", []):
                for c in comp.get("competitors", []):
                    t = c.get("team", {})
                    if t.get("id"):
                        team_ids[t["id"]] = t.get("displayName", "")
            status = event.get("status", {}).get("type", {}).get("state")
            if status == "post":  # completed
                events.append({
                    "id": event["id"],
                    "name": event.get("name", ""),
                    "date": day,
                })
    return events, team_ids


def fetch_all_wc_team_ids() -> dict[str, str]:
    """Return {team_id: name} for ALL 48 teams at the World Cup (not just those
    who have already played)."""
    team_ids: dict[str, str] = {}
    try:
        data = api_client.get(f"{ESPN_BASE}/teams")
        for sport in data.get("sports", []):
            for league in sport.get("leagues", []):
                for entry in league.get("teams", []):
                    t = entry.get("team", {})
                    if t.get("id"):
                        team_ids[t["id"]] = t.get("displayName", "")
    except Exception as e:
        print(f"  Warning: could not fetch WC team list: {e}")
    return team_ids


def fetch_squad(team_id: str) -> list[dict]:
    """Return [{id, dob}] for a national team's WC squad. The roster endpoint's
    `dateOfBirth` is ISO (YYYY-MM-DD) — unambiguous, unlike the athlete
    profile's `displayDOB` which is locale-formatted D/M/YYYY."""
    try:
        data = api_client.get(f"{ESPN_BASE}/teams/{team_id}/roster")
        out = []
        for a in data.get("athletes", []):
            if a.get("id"):
                out.append({"id": str(a["id"]), "dob": a.get("dateOfBirth")})
        return out
    except Exception as e:
        print(f"  Warning: could not fetch squad for team {team_id}: {e}")
        return []


# ---------------------------------------------------------------------------
# Step 2: Fetch per-player stats from match summary
# ---------------------------------------------------------------------------

def parse_match_stats(event_id: str) -> list[dict]:
    """Return a flat list of per-player stat dicts with real minutes played."""
    data = api_client.get(f"{ESPN_BASE}/summary", {"event": event_id})

    # --- Derive real minutes from substitution + red card events ---
    # clock.value is seconds elapsed; we cap at full-time (90+ injury time)
    key_events = data.get("keyEvents", [])

    # Determine actual full-time length (seconds). Default 90 min.
    ft_seconds = 90 * 60
    for e in key_events:
        if e.get("type", {}).get("type") == "fulltime":
            ft_seconds = int(e.get("clock", {}).get("value") or ft_seconds)
            break

    # Build maps: player_id -> subbed_out_seconds, player_id -> subbed_in_seconds
    subbed_out: dict[str, int] = {}   # starter replaced at X seconds
    subbed_in:  dict[str, int] = {}   # sub came on at X seconds
    sent_off:   dict[str, int] = {}   # red card at X seconds (stops playing)

    for e in key_events:
        etype = e.get("type", {}).get("type", "")
        clock_val = int(e.get("clock", {}).get("value") or 0)
        participants = e.get("participants", [])

        if etype == "substitution" and len(participants) >= 2:
            # participants[0] = coming ON, participants[1] = going OFF
            pid_on  = str(participants[0].get("athlete", {}).get("id", ""))
            pid_off = str(participants[1].get("athlete", {}).get("id", ""))
            if pid_on:
                subbed_in[pid_on] = clock_val
            if pid_off:
                subbed_out[pid_off] = clock_val

        elif etype in ("yellowred", "redcard"):
            pid = str((participants[0].get("athlete", {}) if participants else e.get("athlete") or {}).get("id", ""))
            if pid:
                sent_off[pid] = clock_val

    def minutes_played(pid: str, is_starter: bool, is_subbed_in: bool) -> int:
        pid = str(pid)
        if is_subbed_in:
            start = subbed_in.get(pid, 0)
            end   = sent_off.get(pid, ft_seconds)
            return max(1, round((end - start) / 60))
        elif is_starter:
            start = 0
            end   = subbed_out.get(pid, sent_off.get(pid, ft_seconds))
            return max(1, round(end / 60))
        return 0

    # --- Parse player stats ---
    players = []
    for team_roster in data.get("rosters", []):
        for entry in team_roster.get("roster", []):
            athlete = entry.get("athlete", {})
            pid = str(athlete.get("id", ""))
            if not pid:
                continue

            raw_stats = {s["name"]: s.get("value", 0) for s in entry.get("stats", [])}
            if raw_stats.get("appearances", 0) == 0:
                continue

            is_starter    = bool(entry.get("starter", False))
            is_subbed_in  = bool(entry.get("subbedIn", False))
            mins = minutes_played(pid, is_starter, is_subbed_in)

            players.append({
                "player_id": pid,
                "name": athlete.get("displayName", ""),
                "event_id": event_id,
                "minutes": mins,
                "goals": int(raw_stats.get("totalGoals", 0)),
                "assists": int(raw_stats.get("goalAssists", 0)),
                "yellow_cards": int(raw_stats.get("yellowCards", 0)),
                "red_cards": int(raw_stats.get("redCards", 0)),
                "shots_on_target": int(raw_stats.get("shotsOnTarget", 0)),
                "total_shots": int(raw_stats.get("totalShots", 0)),
                "saves": int(raw_stats.get("saves", 0)),
                "fouls_committed": int(raw_stats.get("foulsCommitted", 0)),
            })

    return players


# ---------------------------------------------------------------------------
# Step 3: Fetch athlete profile (club, position, age, nationality, sun sign)
# ---------------------------------------------------------------------------

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


def fetch_athlete_profile(player_id: str, iso_dob: str | None = None) -> dict:
    try:
        data = api_client.get(f"{ESPN_ATHLETE_BASE}/{player_id}")
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
        }
    except Exception as e:
        print(f"  Warning: could not fetch profile for player {player_id}: {e}")
        return {"player_id": player_id}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--full", action="store_true", help="Re-fetch all matches from scratch")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    cache = load_json(Path(CACHE_FILE)) if not args.full else {}
    player_profiles: dict = load_json(Path(PLAYER_CACHE_FILE)) if not args.full else {}
    match_stats: dict = cache.get("match_stats", {})  # {event_id: [player_stat, ...]}
    already_fetched = set(match_stats.keys())

    # squads: {team_id: [{"id": str, "dob": iso_str|None}, ...]}
    squads: dict = cache.get("squads", {})

    # --- Collect all completed match IDs ---
    print("Scanning WC 2026 schedule...")
    all_events, _ = fetch_event_ids()
    print(f"  Total completed matches found: {len(all_events)}")

    # --- Collect ALL 48 WC teams (so we capture full rosters even for teams
    #     that haven't kicked off yet) ---
    team_ids = fetch_all_wc_team_ids()
    print(f"  WC teams found: {len(team_ids)}")

    new_events = [e for e in all_events if e["id"] not in already_fetched]
    print(f"  New matches to fetch: {len(new_events)}")

    # --- Fetch player stats for new matches ---
    for event in new_events:
        eid = event["id"]
        print(f"  Fetching: {event['name']} ({event['date']}, id={eid})")
        stats = parse_match_stats(eid)
        match_stats[eid] = stats

    # --- Fetch full WC squads (every selected player, not just those who have
    #     appeared). Only fetch squads we don't have yet. ---
    new_teams = [tid for tid in team_ids if tid not in squads]
    if new_teams:
        print(f"Fetching squads for {len(new_teams)} national teams...")
        for tid in new_teams:
            members = fetch_squad(tid)
            squads[tid] = members
            print(f"  {team_ids[tid]} → {len(members)} players")

    # --- Build ISO DOB map from squad rosters (authoritative, unambiguous) ---
    dob_map: dict[str, str] = {}
    for members in squads.values():
        for m in members:
            if m.get("dob"):
                dob_map[m["id"]] = m["dob"]

    # --- Determine the full universe of players: anyone who has appeared in a
    #     match PLUS anyone in a fetched WC squad. ---
    appeared_ids = {str(s["player_id"]) for stats in match_stats.values() for s in stats}
    squad_player_ids = {m["id"] for members in squads.values() for m in members}
    all_player_ids = appeared_ids | squad_player_ids

    # --- Fetch profiles for any player missing club data ---
    have_club = {pid for pid, p in player_profiles.items() if p.get("club")}
    missing_profiles = all_player_ids - have_club
    if missing_profiles:
        print(f"Fetching profiles for {len(missing_profiles)} players (new or missing club)...")
        for pid in sorted(missing_profiles):
            profile = fetch_athlete_profile(pid, iso_dob=dob_map.get(pid))
            player_profiles[pid] = profile
            print(f"  {profile.get('name', pid)} → {profile.get('club', '?')}")
        save_json(Path(PLAYER_CACHE_FILE), player_profiles)

    # --- Reconcile DOB + sun sign from the authoritative ISO roster map.
    #     (Earlier caches stored ambiguous D/M vs M/D dates; fix them in place.) ---
    fixed = 0
    for pid, prof in player_profiles.items():
        iso = dob_map.get(pid)
        if iso and prof.get("dob") != iso:
            prof["dob"] = iso
            prof["sun_sign"] = _sun_sign(iso)
            fixed += 1
    if fixed:
        print(f"Reconciled DOB/sun sign for {fixed} players from ISO roster data.")
        save_json(Path(PLAYER_CACHE_FILE), player_profiles)

    # --- Build aggregated output ---
    print("Building aggregated output...")
    from datetime import datetime
    output = build_output(match_stats, player_profiles, squad_player_ids=all_player_ids)
    output["last_updated"] = datetime.utcnow().isoformat() + "Z"
    output["match_stats"] = match_stats
    output["squads"] = squads

    save_json(Path(CACHE_FILE), output)

    # Mirror to web/data/ so Vercel Next.js API routes can read it
    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
    save_json(Path(WEB_CACHE_FILE), output)

    print(f"\nDone.")
    print(f"  Matches cached: {len(match_stats)}")
    print(f"  Players tracked: {len(output.get('players', []))}")
    print(f"  Clubs tracked:   {len(output.get('clubs', []))}")


if __name__ == "__main__":
    main()
