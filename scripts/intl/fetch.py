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
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from core import espn
from core.io import load_json, save_json
from core.matches import backfill_started, parse_match_stats
from core.profiles import fetch_athlete_profile
from intl.config import (
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
                data = espn.get(f"{ESPN_SOCCER}/{slug}/scoreboard", {"dates": day})
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
    if dead and dead == set(COMPETITIONS):
        raise SystemExit("ESPN refused every competition — likely blocked (see errors above). "
                         "Not writing data.")
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

def refresh_profiles(pids: set[str], current: set[str], profiles: dict, force: bool) -> dict:
    """Fetch profiles we don't have yet. Re-fetch an existing profile (club,
    injury status) only for players in the current window — `current` — once
    it's older than PROFILE_TTL_DAYS, so past windows cost no requests."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=PROFILE_TTL_DAYS)).isoformat()
    stale = sorted(pid for pid in pids
                   if force or pid not in profiles
                   or (pid in current and profiles[pid].get("fetched_at", "") < cutoff))
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

_SUM_FIELDS = ("goals", "assists", "yellow_cards", "red_cards",
               "total_shots", "shots_on_target", "fouls_committed")


def _club_race(dates: list[str], clubs: dict, top: int = 20) -> dict:
    """{matchdays, series: {club: {goals, assists, ga}}} — running totals per
    match date for the `top` clubs by final G+A (same shape as the WC race)."""
    totals = {c: sum(g + a for g, a in by_date.values()) for c, by_date in clubs.items()}
    series = {}
    for club in sorted(totals, key=lambda c: -totals[c])[:top]:
        g = a = 0
        gs, as_ = [], []
        for d in dates:
            dg, da = clubs[club].get(d, (0, 0))
            g, a = g + dg, a + da
            gs.append(g)
            as_.append(a)
        series[club] = {"goals": gs, "assists": as_, "ga": [x + y for x, y in zip(gs, as_)]}
    return {"matchdays": dates, "series": series}


def build_output(events: dict, match_stats: dict, match_injuries: dict,
                 profiles: dict, manual: list[dict]) -> dict:
    # ESPN lists the national team as the "club" for players it has no club
    # for (mostly smaller nations); treat those as unknown rather than a club.
    national_teams = {t for ev in events.values() for t in ev.get("teams", [])}

    def prof(pid):
        p = profiles.get(str(pid), {})
        if p.get("club") in national_teams:
            return {**p, "club": None, "league": None}
        return p

    # player × window aggregates
    pw: dict[tuple[str, str], dict] = {}
    for eid, rows in match_stats.items():
        ev = events.get(eid)
        if not ev:
            continue
        for r in rows:
            key = (str(r["player_id"]), ev["window"])
            agg = pw.setdefault(key, {
                "player_id": key[0], "window": key[1], "matches": 0, "starts": 0, "minutes": 0,
                **{f: 0 for f in _SUM_FIELDS}, "competitions": set(),
            })
            agg["matches"] += 1
            agg["starts"] += r.get("started") or 0
            agg["minutes"] += r.get("minutes") or 0
            for f in _SUM_FIELDS:
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
    appearances.sort(key=lambda a: (-(a["goals"] + a["assists"]), -a["minutes"], a["name"]))

    # Club race: cumulative goals/assists per match date, per window and overall
    daily: dict[str, dict[str, dict[str, list[int]]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0, 0])))
    for eid, rows in match_stats.items():
        ev = events.get(eid)
        if not ev:
            continue
        for r in rows:
            club = prof(r["player_id"]).get("club")
            if not club or not (r.get("goals") or r.get("assists")):
                continue
            for scope in (ev["window"], "all"):
                cell = daily[scope][club][ev["date"]]
                cell[0] += r.get("goals") or 0
                cell[1] += r.get("assists") or 0
    dates_by_scope = defaultdict(set)
    for ev in events.values():
        dates_by_scope[ev["window"]].add(ev["date"])
        dates_by_scope["all"].add(ev["date"])
    timeseries = {scope: _club_race(sorted(dates_by_scope[scope]), clubs)
                  for scope, clubs in daily.items()}

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
        "timeseries": timeseries,
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

    # A window that had already finished when we last scanned it can't gain
    # matches, so it's never rescanned.
    done: set[str] = set() if args.full else set(cache.get("scanned_complete", []))
    for w in WINDOWS:
        status = window_status(w)
        if status == "upcoming" or w["id"] in done:
            continue
        print(f"Scanning window {w['label']}...")
        for ev in scan_window(w):
            events[ev["id"]] = ev
        if status == "complete":
            done.add(w["id"])

    new = [e for e in events.values() if e["id"] not in match_stats]
    print(f"  {len(events)} completed matches, {len(new)} new")
    for ev in new:
        print(f"  Fetching: {ev['name']} ({ev['competition']}, {ev['date']})")
        try:
            data = espn.get(f"{ESPN_SOCCER}/{ev['slug']}/summary", {"event": ev["id"]})
        except Exception as e:
            print(f"    Warning: {e}")
            continue
        match_stats[ev["id"]] = parse_match_stats(ev["id"], f"{ESPN_SOCCER}/{ev['slug']}", data=data)
        match_injuries[ev["id"]] = parse_match_injuries(data)

    # Backfill the `started` flag into cached matches that predate it.
    no_starts = [eid for eid, rows in match_stats.items()
                 if rows and "started" not in rows[0] and eid in events]
    if no_starts:
        print(f"Backfilling starts for {len(no_starts)} cached matches...")
    for eid in no_starts:
        ev = events[eid]
        try:
            backfill_started(match_stats[eid], espn.get(f"{ESPN_SOCCER}/{ev['slug']}/summary", {"event": eid}))
        except Exception as e:
            print(f"    Warning: could not backfill starts for {eid}: {e}")

    pids = {str(r["player_id"]) for rows in match_stats.values() for r in rows}
    manual = load_json(INTL_MANUAL_INJURIES, {}).get("injuries", [])
    pids |= {str(m["player_id"]) for m in manual if m.get("player_id")}
    active = [w["id"] for w in WINDOWS if window_status(w) != "upcoming"]
    current = {str(r["player_id"]) for eid, rows in match_stats.items()
               if active and events.get(eid, {}).get("window") == active[-1] for r in rows}
    profiles = refresh_profiles(pids, current, profiles, args.full)
    save_json(INTL_PROFILE_FILE, profiles)

    output = build_output(events, match_stats, match_injuries, profiles, manual)
    web_output = dict(output)
    output["match_stats"] = match_stats
    output["match_injuries"] = match_injuries
    output["scanned_complete"] = sorted(done)
    save_json(INTL_CACHE_FILE, output)
    save_json(WEB_INTL_FILE, web_output, compact=True)  # web copy omits raw per-match rows

    print(f"\nDone. {len(output['appearances'])} player-window rows, "
          f"{len(output['injuries'])} injuries recorded.")


if __name__ == "__main__":
    main()
