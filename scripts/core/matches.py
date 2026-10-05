"""
Per-match parsing of an ESPN soccer `summary` payload — competition-agnostic.
"""

from core import espn


def _decisive_goals(data: dict) -> dict[str, int]:
    """{player_id: decisive_goal_count} for one completed match.

    A goal is *decisive* if removing it would change the result:
      • the go-ahead goal the winner never relinquished — but only in a
        one-goal-margin win, where that single goal is the whole difference
        between a win and a draw; or
      • the final equalizer in a drawn match (turned a loss into a draw).

    Penalties count and credit their taker. Own goals count toward the score
    (they can be the decisive goal) but credit no player — the scorer put it
    into their own net, so no one earns the stat.
    """
    header = data.get("header", {})
    comps = header.get("competitions", [])
    if not comps:
        return {}
    comp = comps[0]
    if comp.get("status", {}).get("type", {}).get("state") != "post":
        return {}  # only completed matches
    competitors = comp.get("competitors", [])
    if len(competitors) != 2:
        return {}
    score = {c["id"]: int(c.get("score") or 0) for c in competitors}
    a, b = list(score.keys())

    goals: list[dict] = []
    for e in data.get("keyEvents", []):
        if not e.get("scoringPlay"):
            continue
        etype = e.get("type", {}).get("type", "")
        is_own = etype.startswith("own-goal")
        is_goal = etype.startswith("goal") or etype.startswith("penalty---scored")
        if not (is_goal or is_own):
            continue
        tid = e.get("team", {}).get("id")  # team credited (benefiting side for own goals)
        if tid not in score:
            continue
        parts = e.get("participants", [])
        pid = "" if is_own else (str(parts[0].get("athlete", {}).get("id", "")) if parts else "")
        goals.append({
            "pid": pid, "tid": tid,
            "period": e.get("period", {}).get("number", 0),
            "clock": e.get("clock", {}).get("value", 0.0),
        })
    goals.sort(key=lambda g: (g["period"], g["clock"]))

    result: dict[str, int] = {}

    def credit(pid: str):
        if pid:  # own goals (blank pid) credit no one
            result[pid] = result.get(pid, 0) + 1

    if score[a] == score[b]:
        # Draw: the last goal is decisive iff it brought the match level.
        if goals:
            last = goals[-1]
            run = {a: 0, b: 0}
            for g in goals[:-1]:
                run[g["tid"]] += 1
            was_behind = run[last["tid"]] == min(run[a], run[b])
            run[last["tid"]] += 1
            if run[a] == run[b] and was_behind:
                credit(last["pid"])
        return result

    # Win: only a one-goal margin has a single decisive (go-ahead-and-held) goal.
    if abs(score[a] - score[b]) != 1:
        return result
    winner = a if score[a] > score[b] else b
    loser = b if winner == a else a
    need = score[loser] + 1  # winner's Nth goal is the one that broke the tie for good
    seen = 0
    for g in goals:
        if g["tid"] == winner:
            seen += 1
            if seen == need:
                credit(g["pid"])
                break
    return result


def parse_match_stats(event_id: str, base: str, data: dict | None = None) -> list[dict]:
    """Return a flat list of per-player stat dicts with real minutes played.

    `base` is the competition's ESPN site API root; pass an already-fetched
    `data` summary to avoid a second request.
    """
    if data is None:
        data = espn.get(f"{base}/summary", {"event": event_id})

    decisive = _decisive_goals(data)

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
                "decisive_goals": int(decisive.get(pid, 0)),
                "assists": int(raw_stats.get("goalAssists", 0)),
                "yellow_cards": int(raw_stats.get("yellowCards", 0)),
                "red_cards": int(raw_stats.get("redCards", 0)),
                "shots_on_target": int(raw_stats.get("shotsOnTarget", 0)),
                "total_shots": int(raw_stats.get("totalShots", 0)),
                "saves": int(raw_stats.get("saves", 0)),
                "fouls_committed": int(raw_stats.get("foulsCommitted", 0)),
                "goals_conceded": int(raw_stats.get("goalsConceded", 0)),
                "shots_faced": int(raw_stats.get("shotsFaced", 0)),
            })

    return players
