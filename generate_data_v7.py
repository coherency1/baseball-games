"""
generate_data_v7.py - MLB Stats API (Official)

INSTALL:  pip install MLB-StatsAPI
RUN:      python generate_data_v7.py
          python generate_data_v7.py --start 2015 --end 2025

Fetches all hitter season stats directly from MLB's official Stats API.
Two methods available:
  endpoint  - fast bulk query using /api/v1/stats (default)
  roster    - per-team roster walk (slower, more reliable for edge cases)

Fixes vs v5/v6:
  - Proper Unicode names (ensure_ascii=False): no more \\xc3\\xa1 garbage
  - Two-phase batSide resolution: bulk stats endpoint + per-player fallback lookup
  - Pagination validated against totalSplits from the API response
  - Team abbreviation normalisation for edge cases (CWS→CHW, WSH→WSN, etc.)
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

# Some abbreviations the API returns differ from our canonical set.
# Normalise them so team lookups always match teams.js.
ABBR_ALIASES = {
    "CWS": "CHW",
    "WSH": "WSN",
    "TBA": "TBR",
    "TBD": "TBR",
    "ANA": "LAA",
    "CAL": "LAA",
    "FLA": "MIA",
    "ATH": "OAK",
    "MON": "WSN",
}

ABBR_TO_TEAM_ID = {v: k for k, v in TEAM_ID_TO_ABBR.items()}

POS_MAP = {
    "Pitcher":           "P",
    "Catcher":           "C",
    "First Base":        "1B",
    "Second Base":       "2B",
    "Third Base":        "3B",
    "Shortstop":         "SS",
    "Left Field":        "OF",
    "Center Field":      "OF",
    "Right Field":       "OF",
    "Outfield":          "OF",
    "Designated Hitter": "DH",
    "Two-Way Player":    "TWP",
    "Infielder":         "IF",
    "Utility":           "UTL",
}

VALID_BATS = {"L", "R", "S"}


def resolve_team(team_dict):
    """Return our canonical team abbreviation from a team object."""
    tid = team_dict.get("id", 0)
    if tid in TEAM_ID_TO_ABBR:
        return TEAM_ID_TO_ABBR[tid]
    abbr = team_dict.get("abbreviation", "???")
    return ABBR_ALIASES.get(abbr, abbr)


def safe_float(v):
    try:
        return round(float(str(v).strip()), 3)
    except Exception:
        return 0.0


def batch_lookup_bat_sides(player_ids, cache, batch_size=200):
    """
    Fetch bat-side for a list of player IDs from the /people endpoint.
    Updates `cache` in-place.  Batches to stay under URL-length limits.
    """
    ids_to_fetch = [pid for pid in player_ids if pid not in cache]
    if not ids_to_fetch:
        return

    print(f"    [bat-side lookup] fetching {len(ids_to_fetch)} player profiles ...", flush=True)
    for i in range(0, len(ids_to_fetch), batch_size):
        batch = ids_to_fetch[i : i + batch_size]
        try:
            raw = statsapi.get("people", {"personIds": ",".join(str(p) for p in batch)})
            for person in raw.get("people", []):
                pid = person.get("id")
                bside = person.get("batSide", {})
                code = bside.get("code") if isinstance(bside, dict) else None
                cache[pid] = code if code in VALID_BATS else "R"
        except Exception as e:
            print(f"    [bat-side lookup] batch failed: {e}")
        time.sleep(0.5)  # gentle rate limit


def get_season_stats_via_endpoint(year, bat_side_cache):
    """
    Bulk stats endpoint with two-phase bat-side resolution:
      Phase 1 – parse batSide from the hydrated player object in each split.
      Phase 2 – for any player whose batSide was absent, do a /people batch lookup.

    Returns a list of raw records (no PA filtering yet).
    """
    records = []
    # Maps record index → player_id for phase-2 resolution
    needs_bat_lookup: list[tuple[int, int]] = []

    offset = 0
    limit = 500
    total_expected = None

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

        stats_block = raw.get("stats", [{}])[0]
        splits = stats_block.get("splits", [])

        # Capture the server-reported total on the first page so we can
        # detect premature termination from a short page that isn't the last.
        if total_expected is None:
            total_expected = stats_block.get("totalSplits")
            if total_expected:
                print(f"(API: {total_expected} splits)", end=" ", flush=True)

        if not splits:
            break

        for split in splits:
            stat   = split.get("stat", {})
            player = split.get("player", {})
            team   = split.get("team", {})

            player_id = player.get("id")
            name      = player.get("fullName", "").strip()
            if not name:
                continue

            team_abbr = resolve_team(team)

            pos_info = player.get("primaryPosition", {})
            pos_name = pos_info.get("name", "Designated Hitter") if isinstance(pos_info, dict) else "Designated Hitter"
            pos = POS_MAP.get(pos_name, "DH")

            # --- Phase 1: read batSide from split-level player object ---
            bat_side_raw = player.get("batSide", {})
            bat_side_code = bat_side_raw.get("code") if isinstance(bat_side_raw, dict) else None

            if bat_side_code in VALID_BATS:
                bat_side = bat_side_code
                if player_id:
                    bat_side_cache[player_id] = bat_side
            elif player_id and player_id in bat_side_cache:
                bat_side = bat_side_cache[player_id]
            else:
                # Mark for phase-2 resolution
                bat_side = None
                if player_id:
                    needs_bat_lookup.append((player_id, len(records)))

            pa = int(stat.get("plateAppearances", 0) or 0)

            records.append({
                "name":   name,
                "team":   team_abbr,
                "year":   year,
                "pos":    pos,
                "bats":   bat_side,           # resolved below if None
                "_pid":   player_id,
                "HR":     int(stat.get("homeRuns",      0) or 0),
                "RBI":    int(stat.get("rbi",            0) or 0),
                "R":      int(stat.get("runs",           0) or 0),
                "H":      int(stat.get("hits",           0) or 0),
                "SB":     int(stat.get("stolenBases",    0) or 0),
                "BB":     int(stat.get("baseOnBalls",    0) or 0),
                "SO":     int(stat.get("strikeOuts",     0) or 0),
                "2B":     int(stat.get("doubles",        0) or 0),
                "3B":     int(stat.get("triples",        0) or 0),
                "PA":     pa,
                "AB":     int(stat.get("atBats",         0) or 0),
                "AVG":    safe_float(stat.get("avg",  ".000")),
                "OBP":    safe_float(stat.get("obp",  ".000")),
                "SLG":    safe_float(stat.get("slg",  ".000")),
                "OPS":    safe_float(stat.get("ops",  ".000")),
                "wRC+":   100,    # not available from MLB API; use FanGraphs for this
                "WAR":    0.0,    # not available from MLB API; use FanGraphs for this
            })

        offset += len(splits)

        # Stop if we have all expected records or this was the last page
        if total_expected and offset >= total_expected:
            break
        if len(splits) < limit:
            break

    # --- Phase 2: batch-resolve missing bat sides ---
    if needs_bat_lookup:
        unique_ids = list({pid for pid, _ in needs_bat_lookup})
        batch_lookup_bat_sides(unique_ids, bat_side_cache)
        for player_id, rec_idx in needs_bat_lookup:
            records[rec_idx]["bats"] = bat_side_cache.get(player_id, "R")

    # Clean up: replace any remaining None bats with "R", drop internal field
    for r in records:
        if r["bats"] not in VALID_BATS:
            r["bats"] = "R"
        r.pop("_pid", None)

    return records


def get_season_stats_via_roster(year, bat_side_cache):
    """
    Alternative: walk each team's full-season roster and fetch per-player stats.
    Slower but may catch players missed by the bulk endpoint.
    """
    records = []

    for team_abbr, team_id in sorted(ABBR_TO_TEAM_ID.items()):
        try:
            roster_data = statsapi.get(
                "team_roster",
                {"teamId": team_id, "season": year, "rosterType": "fullSeason"},
            )
        except Exception:
            try:
                roster_data = statsapi.get("team_roster", {"teamId": team_id, "season": year})
            except Exception as e:
                print(f"    {team_abbr} roster failed: {e}")
                continue

        players = roster_data.get("roster", [])

        for p in players:
            person    = p.get("person", {})
            player_id = person.get("id")
            if not player_id:
                continue

            try:
                pdata = statsapi.player_stat_data(
                    player_id, group="hitting", type="season", sportId=1
                )
            except Exception:
                continue

            if not pdata or not pdata.get("stats"):
                continue

            name     = pdata.get("full_name", "").strip()
            pos_name = pdata.get("primary_position", "DH")
            pos      = POS_MAP.get(pos_name, "DH")

            # Bat side — prefer cache, then player_stat_data, then default
            if player_id in bat_side_cache:
                bat_side = bat_side_cache[player_id]
            else:
                raw_bside = pdata.get("bat_side", "R")
                bat_side  = raw_bside if raw_bside in VALID_BATS else "R"
                bat_side_cache[player_id] = bat_side

            for season_stat in pdata["stats"]:
                if season_stat.get("season") != str(year):
                    continue
                if season_stat.get("group") != "hitting":
                    continue

                s  = season_stat.get("stats", {})
                if not s:
                    continue

                pa = int(s.get("plateAppearances", 0) or 0)

                records.append({
                    "name": name,
                    "team": team_abbr,
                    "year": year,
                    "pos":  pos,
                    "bats": bat_side,
                    "HR":   int(s.get("homeRuns",   0) or 0),
                    "RBI":  int(s.get("rbi",         0) or 0),
                    "R":    int(s.get("runs",         0) or 0),
                    "H":    int(s.get("hits",         0) or 0),
                    "SB":   int(s.get("stolenBases",  0) or 0),
                    "BB":   int(s.get("baseOnBalls",  0) or 0),
                    "SO":   int(s.get("strikeOuts",   0) or 0),
                    "2B":   int(s.get("doubles",      0) or 0),
                    "3B":   int(s.get("triples",      0) or 0),
                    "PA":   pa,
                    "AB":   int(s.get("atBats",       0) or 0),
                    "AVG":  safe_float(s.get("avg",  ".000")),
                    "OBP":  safe_float(s.get("obp",  ".000")),
                    "SLG":  safe_float(s.get("slg",  ".000")),
                    "OPS":  safe_float(s.get("ops",  ".000")),
                    "wRC+": 100,
                    "WAR":  0.0,
                })

    return records


def main():
    p = argparse.ArgumentParser(
        description="StatPad Data Generator v7 - MLB Official Stats API"
    )
    p.add_argument("--start",   type=int, default=2015, help="Start year (default: 2015)")
    p.add_argument("--end",     type=int, default=2025, help="End year (default: 2025)")
    p.add_argument("--min-pa",  type=int, default=50,   help="Minimum plate appearances (default: 50)")
    p.add_argument("--output",  type=str, default="statpad_data", help="Output filename prefix")
    p.add_argument(
        "--method",
        type=str,
        default="endpoint",
        choices=["endpoint", "roster"],
        help=(
            "'endpoint' = fast bulk query (default); "
            "'roster' = per-team roster walk (slower, use if endpoint misses players)"
        ),
    )
    a = p.parse_args()

    print(f"StatPad Data Generator v7")
    print(f"Range: {a.start}-{a.end}, min {a.min_pa} PA, method: {a.method}\n")

    # Shared bat-side cache across all years so we don't re-fetch the same player
    bat_side_cache: dict[int, str] = {}

    all_records: list[dict] = []

    for year in range(a.start, a.end + 1):
        print(f"  {year} ... ", end="", flush=True)

        try:
            if a.method == "endpoint":
                records = get_season_stats_via_endpoint(year, bat_side_cache)
            else:
                records = get_season_stats_via_roster(year, bat_side_cache)
        except Exception as e:
            print(f"FAILED: {e}")
            continue

        print(f"{len(records)} raw", end="")

        if year == a.start and records:
            r0 = records[0]
            print(
                f"\n  [sample] {r0['name']} | {r0['team']} | "
                f"PA={r0['PA']} | HR={r0['HR']} | pos={r0['pos']} | bats={r0['bats']}"
            )

        filtered = [r for r in records if r["PA"] >= a.min_pa]
        print(f" -> {len(filtered)} kept (PA>={a.min_pa})")

        # Warn if bat-side data looks suspicious
        bats_counts: dict = {}
        for r in filtered:
            bats_counts[r["bats"]] = bats_counts.get(r["bats"], 0) + 1
        if bats_counts.get("R", 0) == len(filtered) and len(filtered) > 10:
            print(f"  [WARNING] {year}: ALL {len(filtered)} keepers have bats=R — "
                  f"bat-side data may not have been returned by the API. "
                  f"Try --method roster for this year.")

        all_records.extend(filtered)
        time.sleep(1)   # respect rate limits

    print(f"\nTotal raw records collected: {len(all_records)}")

    if not all_records:
        print("\nNo data retrieved. Troubleshooting:")
        print("  pip install MLB-StatsAPI")
        print("  python -c \"import statsapi; print(statsapi.get('teams', {'sportId':1}))\"")
        sys.exit(1)

    # Compute XBH
    for r in all_records:
        r["XBH"] = r.get("2B", 0) + r.get("3B", 0) + r.get("HR", 0)

    # Summary stats
    teams   = sorted(set(r["team"] for r in all_records))
    players = len(set(r["name"] for r in all_records))
    bats_dist: dict = {}
    for r in all_records:
        bats_dist[r["bats"]] = bats_dist.get(r["bats"], 0) + 1

    print(f"{players} unique players, {len(all_records)} player-seasons, {len(teams)} teams")
    print(f"Bats distribution: {bats_dist}")
    if bats_dist.get("R", 0) == len(all_records):
        print("[WARNING] Entire dataset has bats=R. Bat-side data was not resolved.")
        print("  The game will disable the bats filter until proper data is generated.")
    print(f"Teams: {', '.join(teams)}")

    for t in ["NYY", "NYM", "CHC", "CHW", "LAD", "LAA"]:
        count = len([r for r in all_records if r["team"] == t])
        print(f"  {t}: {count} records {'[OK]' if count > 0 else '[MISSING - check team ID map]'}")

    # Write JSON with proper Unicode (ensure_ascii=False prevents \\xNN garbage in names)
    with open(f"{a.output}.json", "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False)

    with open(f"{a.output}.js", "w", encoding="utf-8") as f:
        f.write(f"// MLB Stats API {a.start}-{a.end} | {len(all_records)} player-seasons\n")
        f.write("const PLAYER_SEASONS = [\n")
        for i, r in enumerate(all_records):
            comma = "," if i < len(all_records) - 1 else ""
            f.write(f"  {json.dumps(r, ensure_ascii=False)}{comma}\n")
        f.write("];\n")

    print(f"\nWritten: {a.output}.json, {a.output}.js")
    print(f"  Names use UTF-8 Unicode (no \\\\xNN sequences)")

    if all_records:
        best = max(all_records, key=lambda r: r["HR"])
        print(f"Top HR: {best['name']} ({best['year']} {best['team']}) — {best['HR']}")

    print(f"\nNext step: cp {a.output}.json public/statpad_data.json")
    print(
        "\nNote: wRC+ and WAR are unavailable from MLB's official API."
        "\n  They default to 100 / 0.0 respectively."
        "\n  To get real wRC+/WAR, use the FanGraphs leaderboard CSV export"
        "\n  (https://www.fangraphs.com/leaders/major-league) and join on"
        "\n  player name + year after generating this file."
    )


if __name__ == "__main__":
    main()
