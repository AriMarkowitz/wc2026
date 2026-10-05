"""
Fetch international-break match data (friendlies, Nations League, qualifiers)
from ESPN's public API and write data/intl/intl.json (mirrored to web/data/).

Tracks, per FIFA window: every player who featured, the club they returned to,
their output, and recorded injuries:
  • match injuries parsed from ESPN commentary ("… replaces X because of an
    injury", "Delay in match because of an injury X (Nation)")
  • injury status listed on the player's ESPN profile (where ESPN has one)
  • hand-recorded entries from data/intl/injuries_manual.json

Usage:
    python scripts/fetch_intl.py            # incremental
    python scripts/fetch_intl.py --full     # re-fetch every match + profile
"""

import argparse
import json
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import api_client
from fetch_data import fetch_athlete_profile, parse_match_stats
from intl_config import (
    COMPETITIONS,
    ESPN_SOCCER,
    INTL_CACHE_FILE,
    INTL_MANUAL_INJURIES,
    INTL_PROFILE_FILE,
    PROFILE_TTL_DAYS,
    WEB_INTL_FILE,
    WINDOWS,
)

UNKNOWN = "Unknown"


def load_json(path: Path, default):
    return json.loads(path.read_text()) if path.exists() else default


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"  Wrote {path}")


def window_days(w: dict):
    s = datetime.strptime(w["start"], "%Y%m%d").date()
    e = min(datetime.strptime(w["end"], "%Y%m%d").date(), date.today())
    while s <= e:
        yield s.strftime("%Y%m%d")
        s += timedelta(days=1)


def window_status(w: dict) -> str:
    today = date.today().strftime("%Y%m%d")
    if today < w["start"]:
        return "upcoming"
    return "live" if today <= w["end"] else "complete"


# ---------------------------------------------------------------------------
# Schedule scan
# ---------------------------------------------------------------------------

def scan_window(w: dict) -> list[dict]:
    """Completed matches across every configured competition in a window."""
    events, dead = [], set()
    for day in window_days(w):
        for slug, comp_name in COMPETITIONS.items():
            if slug in dead:
                continue
            try:
                data = api_client.get(f"{ESPN_SOCCER}/{slug}/scoreboard", {"dates": day})
            except Exception as e:
                print(f"  Skipping {slug}: {e}")
                dead.add(slug)  # unknown slug — don't retry it every day
                continue
            for ev in data.get("events", []):
                if ev.get("status", {}).get("type", {}).get("state") != "post":
                    continue
                teams = [c.get("team", {}).get("displayName", "")
                         for comp in ev.get("competitions", [])
                         for c in comp.get("competitors", [])]
                events.append({
                    "id": str(ev["id"]),
                    "name": ev.get("name", ""),
                    "date": day,
                    "slug": slug,
                    "competition": comp_name,
                    "window": w["id"],
                    "teams": teams,
                })
    # The same match can be listed under two slugs (e.g. friendly + qualifier)
    return list({e["id"]: e for e in events}.values())


# ---------------------------------------------------------------------------
# Match injuries
# ---------------------------------------------------------------------------

_SUB_INJ = re.compile(r"Substitution, (?P<team>.+?)\. .+? replaces (?P<name>.+?) because of an injury", re.I)
_DELAY_INJ = re.compile(r"Delay in match because of an injury (?P<name>.+?) \((?P<team>.+?)\)", re.I)
_SEVERITY = {"treated": 1, "forced_off": 2}


def _minute(item: dict) -> str | None:
    t = item.get("time") or item.get("clock") or {}
    return t.get("displayValue")


def parse_match_injuries(data: dict) -> list[dict]:
    """[{player_id, name, team, minute, kind}] — one entry per injured player,
    keeping the most severe signal (forced off > treated on pitch)."""
    name_to_id: dict[str, str] = {}
    for roster in data.get("rosters", []):
        for entry in roster.get("roster", []):
            a = entry.get("athlete", {})
            if a.get("id") and a.get("displayName"):
                name_to_id[a["displayName"].strip().lower()] = str(a["id"])

    found: dict[str, dict] = {}
    for item in data.get("commentary", []) or []:
        text = (item.get("text") or "").strip()
        for kind, rx in (("forced_off", _SUB_INJ), ("treated", _DELAY_INJ)):
            m = rx.search(text)
            if not m:
                continue
            name = m.group("name").strip().rstrip(".")
            key = name.lower()
            prev = found.get(key)
            if prev and _SEVERITY[prev["kind"]] >= _SEVERITY[kind]:
                continue
            found[key] = {
                "player_id": name_to_id.get(key),
                "name": name,
                "team": m.group("team").strip(),
                "minute": _minute(item),
                "kind": kind,
            }
    return list(found.values())


# ---------------------------------------------------------------------------
# Profiles (separate cache from the WC — clubs change every transfer window)
# ---------------------------------------------------------------------------

def refresh_profiles(pids: set[str], profiles: dict, force: bool) -> dict:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=PROFILE_TTL_DAYS)).isoformat()
    stale = sorted(pid for pid in pids
                   if force or not profiles.get(pid, {}).get("club")
                   or profiles[pid].get("fetched_at", "") < cutoff)
    if stale:
        print(f"Fetching {len(stale)} player profiles...")
    for pid in stale:
        prof = fetch_athlete_profile(pid)
        prof["fetched_at"] = datetime.now(timezone.utc).isoformat()
        profiles[pid] = prof
    return profiles


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def build_output(events: dict, match_stats: dict, match_injuries: dict,
                 profiles: dict, manual: list[dict]) -> dict:
    def prof(pid):
        return profiles.get(str(pid), {})

    # player × window aggregates
    pw: dict[tuple[str, str], dict] = {}
    for eid, rows in match_stats.items():
        ev = events.get(eid)
        if not ev:
            continue
        for r in rows:
            key = (str(r["player_id"]), ev["window"])
            agg = pw.setdefault(key, {
                "player_id": key[0], "window": key[1], "matches": 0, "minutes": 0,
                "goals": 0, "assists": 0, "yellow_cards": 0, "red_cards": 0,
                "competitions": set(),
            })
            agg["matches"] += 1
            agg["minutes"] += r.get("minutes") or 0
            for f in ("goals", "assists", "yellow_cards", "red_cards"):
                agg[f] += r.get(f) or 0
            agg["competitions"].add(ev["competition"])

    injuries = []
    for eid, items in match_injuries.items():
        ev = events.get(eid)
        if not ev:
            continue
        for inj in items:
            p = prof(inj["player_id"]) if inj.get("player_id") else {}
            injuries.append({
                "player_id": inj.get("player_id"),
                "name": p.get("name") or inj["name"],
                "nationality": p.get("nationality") or inj.get("team"),
                "club": p.get("club") or UNKNOWN,
                "league": p.get("league"),
                "window": ev["window"],
                "date": f"{ev['date'][:4]}-{ev['date'][4:6]}-{ev['date'][6:]}",
                "match": ev["name"],
                "competition": ev["competition"],
                "minute": inj.get("minute"),
                "kind": inj["kind"],
                "injury": None,
                "status": (p.get("injury_status") or {}).get("status"),
                "source": "match",
            })
    for m in manual:
        p = prof(m.get("player_id")) if m.get("player_id") else {}
        injuries.append({
            "player_id": m.get("player_id"),
            "name": m["name"],
            "nationality": m.get("nationality") or p.get("nationality"),
            "club": m.get("club") or p.get("club") or UNKNOWN,
            "league": p.get("league"),
            "window": m["window"],
            "date": m.get("date"),
            "match": m.get("match"),
            "competition": m.get("competition"),
            "minute": None,
            "kind": m.get("kind", "withdrawn"),
            "injury": m.get("injury"),
            "status": m.get("status"),
            "source": "manual",
            "source_url": m.get("source_url"),
            "note": m.get("note"),
        })
    # Players who featured and whose ESPN profile currently lists an injury,
    # with no match/manual record — pin it to their latest window.
    recorded = {str(i["player_id"]) for i in injuries if i.get("player_id")}
    latest_window: dict[str, str] = {}
    for pid, win in pw:
        latest_window[pid] = max(win, latest_window.get(pid, win))
    for pid, win in latest_window.items():
        st = prof(pid).get("injury_status") or {}
        if pid in recorded or not st.get("status"):
            continue
        p = prof(pid)
        injuries.append({
            "player_id": pid, "name": p.get("name") or UNKNOWN,
            "nationality": p.get("nationality"), "club": p.get("club") or UNKNOWN,
            "league": p.get("league"), "window": win, "date": (st.get("date") or "")[:10] or None,
            "match": None, "competition": None, "minute": None, "kind": "listed",
            "injury": st.get("type"), "status": st.get("status"), "source": "profile",
        })
    injuries.sort(key=lambda i: (i.get("date") or ""), reverse=True)

    injured_keys = {(str(i["player_id"]), i["window"]) for i in injuries if i.get("player_id")}
    appearances = []
    for (pid, win), agg in pw.items():
        p = prof(pid)
        appearances.append({
            **agg,
            "competitions": sorted(agg["competitions"]),
            "name": p.get("name") or UNKNOWN,
            "club": p.get("club") or UNKNOWN,
            "league": p.get("league"),
            "nationality": p.get("nationality") or UNKNOWN,
            "position": p.get("position") or UNKNOWN,
            "age": p.get("age"),
            "injured": (pid, win) in injured_keys,
        })
    appearances.sort(key=lambda a: (-a["minutes"], a["name"]))

    match_counts = defaultdict(int)
    for ev in events.values():
        match_counts[ev["window"]] += 1

    return {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "windows": [{**w, "status": window_status(w), "matches": match_counts[w["id"]]}
                    for w in WINDOWS],
        "competitions": sorted({e["competition"] for e in events.values()}),
        "matches": sorted(events.values(), key=lambda e: e["date"]),
        "appearances": appearances,
        "injuries": injuries,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true")
    args = ap.parse_args()

    cache = {} if args.full else load_json(INTL_CACHE_FILE, {})
    match_stats: dict = cache.get("match_stats", {})
    match_injuries: dict = cache.get("match_injuries", {})
    events: dict = {e["id"]: e for e in cache.get("matches", [])}
    profiles: dict = {} if args.full else load_json(INTL_PROFILE_FILE, {})

    for w in WINDOWS:
        if window_status(w) == "upcoming":
            continue
        print(f"Scanning window {w['label']}...")
        for ev in scan_window(w):
            events[ev["id"]] = ev

    new = [e for e in events.values() if e["id"] not in match_stats]
    print(f"  {len(events)} completed matches, {len(new)} new")
    for ev in new:
        print(f"  Fetching: {ev['name']} ({ev['competition']}, {ev['date']})")
        try:
            data = api_client.get(f"{ESPN_SOCCER}/{ev['slug']}/summary", {"event": ev["id"]})
        except Exception as e:
            print(f"    Warning: {e}")
            continue
        match_stats[ev["id"]] = parse_match_stats(ev["id"], data=data)
        match_injuries[ev["id"]] = parse_match_injuries(data)

    pids = {str(r["player_id"]) for rows in match_stats.values() for r in rows}
    manual = load_json(INTL_MANUAL_INJURIES, {}).get("injuries", [])
    pids |= {str(m["player_id"]) for m in manual if m.get("player_id")}
    profiles = refresh_profiles(pids, profiles, args.full)
    save_json(INTL_PROFILE_FILE, profiles)

    output = build_output(events, match_stats, match_injuries, profiles, manual)
    web_output = dict(output)
    output["match_stats"] = match_stats
    output["match_injuries"] = match_injuries
    save_json(INTL_CACHE_FILE, output)
    save_json(WEB_INTL_FILE, web_output)  # web copy omits raw per-match rows

    print(f"\nDone. {len(output['appearances'])} player-window rows, "
          f"{len(output['injuries'])} injuries recorded.")


if __name__ == "__main__":
    main()
