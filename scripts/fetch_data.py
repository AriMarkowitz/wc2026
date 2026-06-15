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

def fetch_event_ids() -> list[dict]:
    """Return list of {id, name, date} for all completed WC matches so far."""
    events = []
    for day in date_range(WC_START_DATE, WC_END_DATE):
        data = api_client.get(f"{ESPN_BASE}/scoreboard", {"dates": day})
        for event in data.get("events", []):
            status = event.get("status", {}).get("type", {}).get("state")
            if status == "post":  # completed
                events.append({
                    "id": event["id"],
                    "name": event.get("name", ""),
                    "date": day,
                })
    return events


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
# Step 3: Fetch athlete profile (club, position, age, nationality)
# ---------------------------------------------------------------------------

def fetch_athlete_profile(player_id: str) -> dict:
    try:
        data = api_client.get(f"{ESPN_ATHLETE_BASE}/{player_id}")
        athlete = data.get("athlete", {})
        return {
            "player_id": player_id,
            "name": athlete.get("displayName", ""),
            "club": athlete.get("team", {}).get("displayName"),
            "position": athlete.get("position", {}).get("displayName"),
            "age": athlete.get("age"),
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

    # --- Collect all completed match IDs ---
    print("Scanning WC 2026 schedule...")
    all_events = fetch_event_ids()
    print(f"  Total completed matches found: {len(all_events)}")

    new_events = [e for e in all_events if e["id"] not in already_fetched]
    print(f"  New matches to fetch: {len(new_events)}")

    # --- Fetch player stats for new matches ---
    new_player_ids: set[str] = set()
    for event in new_events:
        eid = event["id"]
        print(f"  Fetching: {event['name']} ({event['date']}, id={eid})")
        stats = parse_match_stats(eid)
        match_stats[eid] = stats
        new_player_ids.update(s["player_id"] for s in stats)

    # --- Fetch profiles for any new players not already cached ---
    missing_profiles = new_player_ids - set(player_profiles.keys())
    if missing_profiles:
        print(f"Fetching profiles for {len(missing_profiles)} new players...")
        for pid in sorted(missing_profiles):
            profile = fetch_athlete_profile(pid)
            player_profiles[pid] = profile
            club = profile.get("club", "?")
            print(f"  {profile.get('name', pid)} → {club}")
        save_json(Path(PLAYER_CACHE_FILE), player_profiles)

    # --- Build aggregated output ---
    print("Building aggregated output...")
    from datetime import datetime
    output = build_output(match_stats, player_profiles)
    output["last_updated"] = datetime.utcnow().isoformat() + "Z"
    output["match_stats"] = match_stats

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
