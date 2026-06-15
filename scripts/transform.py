"""
Transforms raw match_stats + player_profiles into the final wc2026.json shape.
Aggregates per-match stats across all matches a player appeared in,
then rolls up player totals to club totals.
"""

from collections import defaultdict

UNKNOWN = "Unknown"


def build_output(
    match_stats: dict,       # {str(event_id): [player_stat_dict, ...]}
    player_profiles: dict,   # {str(player_id): profile_dict}
    squad_player_ids: set[str] | None = None,  # full universe of WC squad players
) -> dict:

    # --- Aggregate per player across all matches ---
    player_agg: dict[str, dict] = {}

    for stats_list in match_stats.values():
        for stat in stats_list:
            pid = str(stat["player_id"])
            if pid not in player_agg:
                player_agg[pid] = _empty_agg(pid, stat)
            _merge_stat(player_agg[pid], stat)

    # --- Include squad players who haven't appeared yet (zero stats) ---
    if squad_player_ids:
        for pid in squad_player_ids:
            pid = str(pid)
            if pid not in player_agg:
                prof = player_profiles.get(pid, {})
                player_agg[pid] = _empty_agg(pid, {"name": prof.get("name")})

    # --- Attach profile metadata and compute derived fields ---
    players = []
    for pid, agg in player_agg.items():
        profile = player_profiles.get(pid, {})
        mins = agg["minutes"]

        record = {
            "player_id": pid,
            "name": profile.get("name") or agg["name"] or UNKNOWN,
            "club": profile.get("club") or UNKNOWN,
            "league": profile.get("league"),
            "nationality": profile.get("nationality") or UNKNOWN,
            "age": profile.get("age"),
            "dob": profile.get("dob"),
            "sun_sign": profile.get("sun_sign"),
            "position": profile.get("position") or UNKNOWN,
            "photo": profile.get("photo"),
            "matches_played": agg["matches_played"],
            "minutes_played": mins,
            "goals": agg["goals"],
            "assists": agg["assists"],
            "yellow_cards": agg["yellow_cards"],
            "red_cards": agg["red_cards"],
            "shots_on_target": agg["shots_on_target"],
            "total_shots": agg["total_shots"],
            "saves": agg["saves"],
            "fouls_committed": agg["fouls_committed"],
            "goals_conceded": agg["goals_conceded"],
            "shots_faced": agg["saves"] + agg["goals_conceded"],  # ESPN shotsFaced is always 0; derive it
            "clean_sheets": agg["clean_sheets"],
            "save_pct": round(agg["saves"] / (agg["saves"] + agg["goals_conceded"]) * 100, 1) if (agg["saves"] + agg["goals_conceded"]) > 0 else None,
            "goals_per_90": _per90(agg["goals"], mins),
            "assists_per_90": _per90(agg["assists"], mins),
            "goal_contributions_per_90": _per90(agg["goals"] + agg["assists"], mins),
            "goals_conceded_per_90": _per90(agg["goals_conceded"], mins),
        }
        players.append(record)

    players.sort(key=lambda p: (-p["goals"], -p["assists"]))

    # --- Roll up to club level ---
    club_buckets: dict[str, list] = defaultdict(list)
    for p in players:
        club_buckets[p["club"]].append(p)

    clubs = []
    for club_name, club_players in club_buckets.items():
        if club_name == UNKNOWN:
            continue
        ages = [p["age"] for p in club_players if p["age"] is not None]
        total_mins = sum(p["minutes_played"] for p in club_players)
        total_ga   = sum(p["goals"] + p["assists"] for p in club_players)
        total_goals   = sum(p["goals"]   for p in club_players)
        total_assists = sum(p["assists"] for p in club_players)
        leagues = [p.get("league") for p in club_players if p.get("league")]
        league = leagues[0] if leagues else None
        clubs.append({
            "club": club_name,
            "league": league,
            "player_count": len(club_players),
            "total_goals": total_goals,
            "total_assists": total_assists,
            "total_goal_contributions": total_ga,
            "total_minutes": total_mins,
            "total_yellow_cards": sum(p["yellow_cards"] for p in club_players),
            "total_red_cards": sum(p["red_cards"] for p in club_players),
            "avg_age": round(sum(ages) / len(ages), 1) if ages else None,
            "goals_per_90": _per90(total_goals, total_mins),
            "assists_per_90": _per90(total_assists, total_mins),
            "ga_per_90": _per90(total_ga, total_mins),
            "players": [p["name"] for p in club_players],
        })

    clubs.sort(key=lambda c: (-c["total_goal_contributions"], -c["total_goals"]))

    # --- Build per-matchday cumulative G+A for clubs ---
    # Collect all match dates in order
    all_dates: list[str] = sorted({
        row.get("match_date", "")
        for stats_list in match_stats.values()
        for row in stats_list
        if row.get("match_date")
    })

    # Map player_id -> club (from profiles)
    pid_to_club = {pid: p.get("club", UNKNOWN) for pid, p in player_profiles.items()}

    # Per club, per date: goals and assists separately
    club_date_goals:   dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    club_date_assists: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for stats_list in match_stats.values():
        for row in stats_list:
            d = row.get("match_date")
            if not d:
                continue
            pid = str(row.get("player_id", ""))
            club = pid_to_club.get(pid, UNKNOWN)
            if club == UNKNOWN:
                continue
            club_date_goals[club][d]   += row.get("goals") or 0
            club_date_assists[club][d] += row.get("assists") or 0

    # Cumulative running totals for top 20 clubs (frontend picks top-N from these)
    top_clubs = [c["club"] for c in clubs[:20]]
    club_timeseries: dict[str, dict[str, list[int]]] = {}
    for club in top_clubs:
        g_run = a_run = 0
        g_series: list[int] = []
        a_series: list[int] = []
        for d in all_dates:
            g_run += club_date_goals[club].get(d, 0)
            a_run += club_date_assists[club].get(d, 0)
            g_series.append(g_run)
            a_series.append(a_run)
        club_timeseries[club] = {
            "goals": g_series,
            "assists": a_series,
            "ga": [g + a for g, a in zip(g_series, a_series)],
        }

    nationalities = sorted({p["nationality"] for p in players if p["nationality"] != UNKNOWN})
    club_names = sorted({c["club"] for c in clubs})
    leagues = sorted({p["league"] for p in players if p.get("league")})
    positions = [pos for pos in ["Goalkeeper", "Defender", "Midfielder", "Forward"]
                 if any(p["position"] == pos for p in players)]
    sun_signs = [s for s in ["Aries","Taurus","Gemini","Cancer","Leo","Virgo",
                              "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"]
                 if any(p.get("sun_sign") == s for p in players)]

    return {
        "players": players,
        "clubs": clubs,
        "meta": {
            "nationalities": nationalities,
            "clubs": club_names,
            "leagues": leagues,
            "positions": positions,
            "sun_signs": sun_signs,
            "matchdays": all_dates,
        },
        "club_timeseries": club_timeseries,
    }


def _empty_agg(pid: str, first_stat: dict) -> dict:
    return {
        "player_id": pid,
        "name": first_stat.get("name"),
        "matches_played": 0,
        "minutes": 0,
        "goals": 0,
        "assists": 0,
        "yellow_cards": 0,
        "red_cards": 0,
        "shots_on_target": 0,
        "total_shots": 0,
        "saves": 0,
        "fouls_committed": 0,
        "goals_conceded": 0,
        "shots_faced": 0,
        "clean_sheets": 0,
    }


def _merge_stat(agg: dict, stat: dict):
    agg["matches_played"] += 1
    agg["minutes"] += stat.get("minutes") or 0
    agg["goals"] += stat.get("goals") or 0
    agg["assists"] += stat.get("assists") or 0
    agg["yellow_cards"] += stat.get("yellow_cards") or 0
    agg["red_cards"] += stat.get("red_cards") or 0
    agg["shots_on_target"] += stat.get("shots_on_target") or 0
    agg["total_shots"] += stat.get("total_shots") or 0
    agg["saves"] += stat.get("saves") or 0
    agg["fouls_committed"] += stat.get("fouls_committed") or 0
    gc = stat.get("goals_conceded") or 0
    agg["goals_conceded"] += gc
    agg["shots_faced"] += stat.get("shots_faced") or 0
    if gc == 0 and (stat.get("minutes") or 0) >= 60:
        agg["clean_sheets"] += 1


def _per90(value: int, minutes: int) -> float | None:
    if not minutes:
        return None
    return round(value / minutes * 90, 2)
