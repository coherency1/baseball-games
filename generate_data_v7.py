"""
generate_data.py - MLB Stats API

INSTALL:  pip install MLB-StatsAPI
RUN:      python generate_data.py
          python generate_data.py --start 2015 --end 2025

  For each team (30 teams) and each year:
    1. GET /api/v1/teams/{teamId}/roster?season={year} -> list of player IDs
    2. get season stats per player via player_stat_data()

"""

import argparse, json, sys, time

try:
    import statsapi
except ImportError:
    print("Install:  pip install MLB-StatsAPI")
    print("  python -m pip install MLB-StatsAPI")
    sys.exit(1)

TEAM_ID_TO_ABBR = {
    108: "LAA",
    109: "ARI",
    110: "BAL",
    111: "BOS",
    112: "CHC",
    113: "CIN",
    114: "CLE",
    115: "COL",
    116: "DET",
    117: "HOU",
    118: "KCR",
    119: "LAD",
    120: "WSN",
    121: "NYM",
    133: "OAK",
    134: "PIT",
    135: "SDP",
    136: "SEA",
    137: "SFG",
    138: "STL",
    139: "TBR",
    140: "TEX",
    141: "TOR",
    142: "MIN",
    143: "PHI",
    144: "ATL",
    145: "CHW",
    146: "MIA",
    147: "NYY",
    158: "MIL",
}

ABBR_TO_TEAM_ID = {v: k for k, v in TEAM_ID_TO_ABBR.items()}

POS_MAP = {
    "Pitcher": "P",
    "Catcher": "C",
    "First Base": "1B",
    "Second Base": "2B",
    "Third Base": "3B",
    "Shortstop": "SS",
    "Left Field": "OF",
    "Center Field": "OF",
    "Right Field": "OF",
    "Outfield": "OF",
    "Designated Hitter": "DH",
    "Two-Way Player": "TWP",
    "Infielder": "IF",
    "Utility": "UTL",
}


def get_season_stats_via_endpoint(year):
    """
    Use the raw stats endpoint to get ALL qualified hitters in one call
    Endpoint: /api/v1/stats?stats=season&group=hitting&season=YYYY&playerPool=ALL&sportId=1
    returns paginated results with all player season batting stats
    """
    records = []
    offset = 0
    limit = 500
    while True:
        try:
            raw = statsapi.get(
                "stats",
                {
                    "stats": "season",
                    "group": "hitting",
                    "season": year,
                    "playerPool": "ALL",
                    "sportId": 1,
                    "limit": limit,
                    "offset": offset,
                    "hydrate": "person,team",
                },
            )
        except Exception as e:
            print(f"  API error at offset {offset}: {e}")
            break

        splits = raw.get("stats", [{}])[0].get("splits", [])
        if not splits:
            break

        for split in splits:
            stat = split.get("stat", {})
            player = split.get("player", {})
            team = split.get("team", {})

            team_id = team.get("id", 0)
            team_abbr = TEAM_ID_TO_ABBR.get(team_id, team.get("abbreviation", "???"))

            name = player.get("fullName", "")
            if not name:
                continue

            person = player
            pos_name = person.get("primaryPosition", {}).get(
                "name", "Designated Hitter"
            )
            pos = POS_MAP.get(pos_name, "DH")
            bat_side = person.get("batSide", {}).get("code", "R")
            pa = stat.get("plateAppearances", 0)

            record = {
                "name": name,
                "team": team_abbr,
                "year": year,
                "pos": pos,
                "bats": bat_side,
                "HR": stat.get("homeRuns", 0),
                "RBI": stat.get("rbi", 0),
                "R": stat.get("runs", 0),
                "H": stat.get("hits", 0),
                "SB": stat.get("stolenBases", 0),
                "BB": stat.get("baseOnBalls", 0),
                "SO": stat.get("strikeOuts", 0),
                "2B": stat.get("doubles", 0),
                "3B": stat.get("triples", 0),
                "PA": pa,
                "AB": stat.get("atBats", 0),
                "AVG": safe_float(stat.get("avg", ".000")),
                "OBP": safe_float(stat.get("obp", ".000")),
                "SLG": safe_float(stat.get("slg", ".000")),
                "OPS": safe_float(stat.get("ops", ".000")),
            }
            records.append(record)

        offset += limit
        if len(splits) < limit:
            break  # no more pages

    return records


def get_season_stats_via_roster(year):
    """
    Alternative: loop through each team's roster and get individual player stats.
    This is slower but gets position and bat side more reliably.
    """
    records = []

    for team_abbr, team_id in sorted(ABBR_TO_TEAM_ID.items()):
        try:
            roster = statsapi.roster(team_id, rosterType="fullSeason", season=year)
        except:
            try:
                roster = statsapi.roster(team_id, season=year)
            except Exception as e:
                print(f"    {team_abbr} roster failed: {e}")
                continue

        try:
            roster_data = statsapi.get(
                "team_roster",
                {"teamId": team_id, "season": year, "rosterType": "fullSeason"},
            )
        except:
            try:
                roster_data = statsapi.get(
                    "team_roster", {"teamId": team_id, "season": year}
                )
            except Exception as e:
                print(f"    {team_abbr} roster data failed: {e}")
                continue

        players = roster_data.get("roster", [])

        for p in players:
            person = p.get("person", {})
            player_id = person.get("id")
            if not player_id:
                continue

            try:
                pdata = statsapi.player_stat_data(
                    player_id, group="hitting", type="season", sportId=1
                )
            except:
                continue

            if not pdata or not pdata.get("stats"):
                continue

            name = pdata.get("full_name", "")
            pos_name = pdata.get("primary_position", "DH")
            pos = POS_MAP.get(pos_name, "DH")
            bat_side = pdata.get("bat_side", "R")

            for season_stat in pdata["stats"]:
                if season_stat.get("season") != str(year):
                    continue
                if season_stat.get("group") != "hitting":
                    continue

                s = season_stat.get("stats", {})
                if not s:
                    continue

                pa = int(s.get("plateAppearances", 0))

                record = {
                    "name": name,
                    "team": team_abbr,
                    "year": year,
                    "pos": pos,
                    "bats": bat_side,
                    "HR": int(s.get("homeRuns", 0)),
                    "RBI": int(s.get("rbi", 0)),
                    "R": int(s.get("runs", 0)),
                    "H": int(s.get("hits", 0)),
                    "SB": int(s.get("stolenBases", 0)),
                    "BB": int(s.get("baseOnBalls", 0)),
                    "SO": int(s.get("strikeOuts", 0)),
                    "2B": int(s.get("doubles", 0)),
                    "3B": int(s.get("triples", 0)),
                    "PA": pa,
                    "AB": int(s.get("atBats", 0)),
                    "AVG": safe_float(s.get("avg", ".000")),
                    "OBP": safe_float(s.get("obp", ".000")),
                    "SLG": safe_float(s.get("slg", ".000")),
                    "OPS": safe_float(s.get("ops", ".000")),
                    "wRC+": 100,
                    "WAR": 0.0,
                }
                records.append(record)

    return records


def safe_float(v):
    try:
        return round(float(str(v).strip()), 3)
    except:
        return 0.0


def main():
    p = argparse.ArgumentParser(
        description="StatPad Data Generator v7 - MLB Official Stats API"
    )
    p.add_argument("--start", type=int, default=2015, help="Start year (default: 2015)")
    p.add_argument("--end", type=int, default=2025, help="End year (default: 2025)")
    p.add_argument(
        "--min-pa", type=int, default=50, help="Minimum plate appearances (default: 50)"
    )
    p.add_argument(
        "--output", type=str, default="statpad_data", help="Output filename prefix"
    )
    p.add_argument(
        "--method",
        type=str,
        default="endpoint",
        choices=["endpoint", "roster"],
        help="'endpoint' = fast bulk query (default), 'roster' = per-team roster walk (slower, more reliable)",
    )
    a = p.parse_args()

    print(f"Range: {a.start}-{a.end}, min {a.min_pa} PA, method: {a.method}")

    all_records = []

    for year in range(a.start, a.end + 1):
        print(f"  {year}...", end=" ", flush=True)

        try:
            if a.method == "endpoint":
                records = get_season_stats_via_endpoint(year)
            else:
                records = get_season_stats_via_roster(year)
        except Exception as e:
            print(f"FAILED: {e}")
            continue

        print(f"{len(records)} raw", end="")

        # Debug
        if year == a.start and records:
            r = records[0]
            print(
                f"\n  [DEBUG] Sample: {r['name']} | {r['team']} | PA={r['PA']} | HR={r['HR']} | pos={r['pos']} | bats={r['bats']}"
            )
        filtered = [r for r in records if r["PA"] >= a.min_pa]
        print(f" -> {len(filtered)} kept")
        all_records.extend(filtered)

        time.sleep(1)  # rate limit

    print(f"\nTotal: {len(all_records)} records")

    if not all_records:
        print("No data retrieved.")
        print("Check: pip install MLB-StatsAPI")
        print(
            "Check: python -c \"import statsapi; print(statsapi.get('teams', {'sportId':1}))\""
        )
        sys.exit(1)

    for r in all_records:
        r["XBH"] = r.get("2B", 0) + r.get("3B", 0) + r.get("HR", 0)

    teams = sorted(set(r["team"] for r in all_records))
    players = len(set(r["name"] for r in all_records))
    print(f"\n{players} unique players across {len(teams)} teams")
    print(f"Teams: {', '.join(teams)}")

    for t in ["NYY", "NYM", "CHC", "CHW", "LAD", "LAA"]:
        count = len([r for r in all_records if r["team"] == t])
        print(f"  {t}: {count} records {'[OK]' if count > 0 else '[MISSING]'}")

    with open(f"{a.output}.json", "w") as f:
        json.dump(all_records, f)

    with open(f"{a.output}.js", "w") as f:
        f.write(
            f"// MLB Stats API {a.start}-{a.end} | {len(all_records)} player-seasons\n"
        )
        f.write("const PLAYER_SEASONS = [\n")
        for i, r in enumerate(all_records):
            comma = "," if i < len(all_records) - 1 else ""
            f.write(f"  {json.dumps(r)}{comma}\n")
        f.write("];\n")

    print(f"\nWritten: {a.output}.json, {a.output}.js")

    best = max(all_records, key=lambda r: r["HR"])
    print(f"Top HR: {best['name']} ({best['year']} {best['team']}) - {best['HR']}")

    print(f"\nTo use: cp {a.output}.json public/statpad_data.json")
    print(f"\nNote: wRC+ and WAR are not available from MLB's API.")
    print(f"They default to 100 and 0.0 respectively.")
    print(f"For wRC+/WAR, you'd need FanGraphs or BREF (both currently broken).")


if __name__ == "__main__":
    main()
