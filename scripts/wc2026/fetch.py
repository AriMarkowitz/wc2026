"""
Fetch World Cup 2026 player stats from ESPN's public API and write wc2026.json.

Usage:
    python scripts/fetch_wc2026.py               # incremental update (skips already-fetched matches)
    python scripts/fetch_wc2026.py --full        # re-fetch all matches from scratch
"""

import argparse
from pathlib import Path

from core import espn
from core.paths import WEB_DATA_DIR
from core.io import date_range, load_json, save_json
from core.matches import _decisive_goals, backfill_started, parse_match_stats
from core.profiles import _sun_sign, fetch_athlete_profile
from wc2026.config import (
    CACHE_FILE,
    DATA_DIR,
    ESPN_BASE,
    PLAYER_CACHE_FILE,
    WC_END_DATE,
    WC_START_DATE,
    WEB_CACHE_FILE,
)
from wc2026.transform import build_output


# ---------------------------------------------------------------------------
# Step 1: Collect all completed WC event IDs
# ---------------------------------------------------------------------------

# Human label + rank for each round, for the "current stage" badge. ESPN's
# season.slug varies ("3rd-place", "third-place-match", "semifinals", …), so
# match on keywords rather than exact strings. Rank >= 1 = knockout round
# (a loss there = elimination).
_ROUND_KEYWORDS = [  # checked in order — "third" before "final", "semi"/"quarter" before "final"
    (("third", "3rd"), "Third-place Playoff", 5),
    (("semi",), "Semifinals", 4),
    (("quarter",), "Quarterfinals", 3),
    (("round-of-16", "round-of-sixteen"), "Round of 16", 2),
    (("round-of-32",), "Round of 32", 1),
    (("final",), "Final", 6),
]


def round_info(slug: str) -> tuple[str, int]:
    """(label, rank) for an ESPN season slug; unknown slugs are group stage."""
    slug = (slug or "").lower()
    for keys, label, rank in _ROUND_KEYWORDS:
        if any(k in slug for k in keys):
            return label, rank
    return "Group Stage", 0


def fetch_event_ids() -> tuple[list[dict], dict[str, str], dict]:
    """Return (completed matches, {team_id: name}, tournament_status).

    tournament_status carries the knockout picture used for the "players
    remaining" feature and the current-stage badge:
      {
        "stage": "Round of 16",                # furthest round reached
        "eliminated_nations": [...],           # by player-facing nationality
        "alive_nations": [...],
        "teams_alive": 8,
      }
    Elimination rule (validated to reproduce the exact 48→32→…→1 bracket):
      • a team is out if it LOST a knockout tie (winner flag reflects penalties);
      • a team that played in the group stage but never reached the Round of 32
        (i.e. never appears in a knockout match) is out on group-stage exit.
    """
    events = []
    team_ids: dict[str, str] = {}

    all_teams: set[str] = set()        # every team that played a match (by name)
    ko_participants: set[str] = set()  # teams that appeared in any knockout match
    ko_losers: set[str] = set()        # teams that lost a knockout tie
    furthest = 0                       # highest round rank seen among completed matches
    furthest_label = "Group Stage"

    for day in date_range(WC_START_DATE, WC_END_DATE):
        data = espn.get(f"{ESPN_BASE}/scoreboard", {"dates": day})
        for event in data.get("events", []):
            slug = event.get("season", {}).get("slug", "")
            for comp in event.get("competitions", []):
                for c in comp.get("competitors", []):
                    t = c.get("team", {})
                    if t.get("id"):
                        team_ids[t["id"]] = t.get("displayName", "")
            status = event.get("status", {}).get("type", {}).get("state")
            if status != "post":  # only completed matches
                continue
            events.append({
                "id": event["id"],
                "name": event.get("name", ""),
                "date": day,
            })
            # --- tournament progression bookkeeping ---
            label, rank = round_info(slug)
            if rank > furthest:
                furthest, furthest_label = rank, label
            is_ko = rank >= 1
            for comp in event.get("competitions", []):
                for c in comp.get("competitors", []):
                    name = c.get("team", {}).get("displayName")
                    if not name:
                        continue
                    all_teams.add(name)
                    if is_ko:
                        ko_participants.add(name)
                        if c.get("winner") is False:
                            ko_losers.add(name)

    # Group-stage casualties: played but never reached the knockouts. Only prune
    # this way once knockouts actually exist (otherwise mid-group everyone's in).
    group_out = (all_teams - ko_participants) if ko_participants else set()
    eliminated_teams = ko_losers | group_out
    alive_teams = all_teams - eliminated_teams

    # Map ESPN team displayNames → the nationality strings players carry.
    def to_nat(name: str) -> str:
        return TEAM_TO_NATIONALITY.get(name, name)

    status = {
        "stage": furthest_label,
        "eliminated_nations": sorted({to_nat(t) for t in eliminated_teams}),
        "alive_nations": sorted({to_nat(t) for t in alive_teams}),
        "teams_alive": len(alive_teams),
    }
    return events, team_ids, status


# A few ESPN team displayNames differ from the `citizenship` string players
# carry in their athlete profile. Normalize the known cases so elimination maps
# cleanly onto player nationality.
TEAM_TO_NATIONALITY = {
    "Bosnia-Herzegovina": "Bosnia and Herzegovina",
    "Cape Verde": "Cape Verde Islands",
    "United States": "USA",
}


def fetch_all_wc_team_ids() -> dict[str, str]:
    """Return {team_id: name} for ALL 48 teams at the World Cup (not just those
    who have already played)."""
    team_ids: dict[str, str] = {}
    try:
        data = espn.get(f"{ESPN_BASE}/teams")
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
        data = espn.get(f"{ESPN_BASE}/teams/{team_id}/roster")
        out = []
        for a in data.get("athletes", []):
            if a.get("id"):
                out.append({"id": str(a["id"]), "dob": a.get("dateOfBirth")})
        return out
    except Exception as e:
        print(f"  Warning: could not fetch squad for team {team_id}: {e}")
        return []


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

    # --- Collect all completed match IDs + tournament progression ---
    print("Scanning WC 2026 schedule...")
    all_events, _, tournament = fetch_event_ids()
    print(f"  Total completed matches found: {len(all_events)}")
    print(f"  Stage: {tournament['stage']} — {tournament['teams_alive']} teams still alive")

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
        stats = parse_match_stats(eid, ESPN_BASE)
        # Attach match date to each row so transform can build time series
        for row in stats:
            row["match_date"] = event["date"]
        match_stats[eid] = stats

    # --- Backfill decisive_goals into already-cached matches that predate the
    #     field. Only re-hits /summary (cheap) for the goal events; leaves all
    #     other cached stats untouched. ---
    stale = [eid for eid, rows in match_stats.items()
             if eid not in {e["id"] for e in new_events}
             and rows and "decisive_goals" not in rows[0]]
    if stale:
        print(f"Backfilling decisive goals for {len(stale)} cached matches...")
        for eid in stale:
            try:
                data = espn.get(f"{ESPN_BASE}/summary", {"event": eid})
                decisive = _decisive_goals(data)
            except Exception as e:
                print(f"  Warning: could not backfill {eid}: {e}")
                decisive = {}
            for row in match_stats[eid]:
                row["decisive_goals"] = int(decisive.get(str(row.get("player_id", "")), 0))

    # --- Backfill the `started` flag into cached matches that predate it. ---
    no_starts = [eid for eid, rows in match_stats.items() if rows and "started" not in rows[0]]
    if no_starts:
        print(f"Backfilling starts for {len(no_starts)} cached matches...")
        for eid in no_starts:
            try:
                backfill_started(match_stats[eid], espn.get(f"{ESPN_BASE}/summary", {"event": eid}))
            except Exception as e:
                print(f"  Warning: could not backfill starts for {eid}: {e}")

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

    # --- Build date map for all events (including already-cached ones) ---
    event_dates = {e["id"]: e["date"] for e in all_events}
    # Backfill match_date into cached rows that predate the field
    for eid, rows in match_stats.items():
        d = event_dates.get(eid)
        if d:
            for row in rows:
                if "match_date" not in row:
                    row["match_date"] = d

    # --- Build aggregated output ---
    print("Building aggregated output...")
    output = build_output(match_stats, player_profiles, squad_player_ids=all_player_ids,
                          tournament=tournament)
    output["match_stats"] = match_stats
    output["squads"] = squads

    save_json(Path(CACHE_FILE), output)

    # Mirror to web/data/ so Vercel Next.js API routes can read it
    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
    save_json(Path(WEB_CACHE_FILE), output)

    print("\nDone.")
    print(f"  Matches cached: {len(match_stats)}")
    print(f"  Players tracked: {len(output.get('players', []))}")
    print(f"  Clubs tracked:   {len(output.get('clubs', []))}")


if __name__ == "__main__":
    main()
