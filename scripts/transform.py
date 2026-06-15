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
) -> dict:

    # --- Aggregate per player across all matches ---
    player_agg: dict[str, dict] = {}

    for stats_list in match_stats.values():
        for stat in stats_list:
            pid = str(stat["player_id"])
            if pid not in player_agg:
                player_agg[pid] = _empty_agg(pid, stat)
            _merge_stat(player_agg[pid], stat)

    # --- Attach profile metadata and compute derived fields ---
    players = []
    for pid, agg in player_agg.items():
        profile = player_profiles.get(pid, {})
        mins = agg["minutes"]

        record = {
            "player_id": pid,
            "name": profile.get("name") or agg["name"] or UNKNOWN,
            "club": profile.get("club") or UNKNOWN,
            "nationality": profile.get("nationality") or UNKNOWN,
            "age": profile.get("age"),
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
            "goals_per_90": _per90(agg["goals"], mins),
            "assists_per_90": _per90(agg["assists"], mins),
            "goal_contributions_per_90": _per90(agg["goals"] + agg["assists"], mins),
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
        clubs.append({
            "club": club_name,
            "player_count": len(club_players),
            "total_goals": sum(p["goals"] for p in club_players),
            "total_assists": sum(p["assists"] for p in club_players),
            "total_goal_contributions": total_ga,
            "total_minutes": total_mins,
            "total_yellow_cards": sum(p["yellow_cards"] for p in club_players),
            "total_red_cards": sum(p["red_cards"] for p in club_players),
            "avg_age": round(sum(ages) / len(ages), 1) if ages else None,
            "ga_per_90": _per90(total_ga, total_mins),
            "players": [p["name"] for p in club_players],
        })

    clubs.sort(key=lambda c: (-c["total_goal_contributions"], -c["total_goals"]))

    nationalities = sorted({p["nationality"] for p in players if p["nationality"] != UNKNOWN})
    club_names = sorted({c["club"] for c in clubs})
    positions = [pos for pos in ["Goalkeeper", "Defender", "Midfielder", "Forward"]
                 if any(p["position"] == pos for p in players)]

    return {
        "players": players,
        "clubs": clubs,
        "meta": {
            "nationalities": nationalities,
            "clubs": club_names,
            "positions": positions,
        },
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


def _per90(value: int, minutes: int) -> float | None:
    if not minutes:
        return None
    return round(value / minutes * 90, 2)
