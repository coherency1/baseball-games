#!/usr/bin/env python3
"""
generate_data.py v5 - StatPad Data Generator (per-team approach)
=================================================================
Previous versions used batting_stats_bref() which returns city names
("New York", "Chicago", "Los Angeles") making it impossible to 
distinguish NYY/NYM, CHC/CHW, LAD/LAA.

This version uses team_batting_bref(team, start, end) which pulls
per-team data with proper abbreviations, solving the ambiguity.

INSTALL:  pip install pybaseball pandas lxml
RUN:      python generate_data.py
          python generate_data.py --start 2010 --end 2024

HOW IT WORKS:
  1. Loops through all 30 MLB teams
  2. For each team, calls team_batting_bref(abbr, start_year, end_year)
     - This scrapes: baseball-reference.com/teams/{ABBR}/{YEAR}-batting.shtml
     - Returns per-player stats WITH a Year column and proper team code
  3. Merges all team data into one dataset
  4. Optionally enriches with WAR from bwar_bat()
  5. Outputs JSON + JS files

TEAM CODES (what BREF uses):
  NYY, NYM, CHC, CHW, LAD, LAA, BOS, ATL, HOU, TEX, SEA, SFG,
  STL, MIL, CIN, PIT, PHI, WSN, MIA, TBR, TOR, BAL, CLE, MIN,
  DET, KCR, OAK, ARI, SDP, COL

RATE LIMITING:
  This makes ~30 requests total (one per team). BREF rate-limits
  aggressively, so we sleep 5 seconds between teams. Total time:
  ~3-4 minutes for all 30 teams.
"""

import argparse, json, sys, time

ALL_TEAMS = [
    "NYY","NYM","BOS","TOR","BAL","TBR",
    "CHC","CHW","STL","MIL","CIN","PIT",
    "LAD","LAA","SFG","SDP","ARI","COL",
    "ATL","PHI","WSN","MIA",
    "HOU","TEX","SEA","OAK",
    "CLE","MIN","DET","KCR",
]

# Some BREF abbreviations differ from standard
BREF_ABBR_MAP = {
    "WSN": "WSN",  # BREF sometimes uses "WSH" 
    "CHW": "CHW",  # BREF sometimes uses "CWS"
    "TBR": "TBR",  # BREF sometimes uses "TBD" or "TBA"
    "MIA": "MIA",  # was "FLA" before 2012
    "LAA": "LAA",  # BREF sometimes uses "ANA" or "CAL"
    "CLE": "CLE",  # was "CLE" throughout
    "OAK": "OAK",  # BREF sometimes uses "OAK" or "ATH"
}

def si(v, d=0):
    try: return int(round(float(v)))
    except: return d

def sf(v, d=0.0):
    try: return round(float(v), 3)
    except: return d

def get(row, *names, default=None):
    for n in names:
        if n in row.index:
            v = row[n]
            if str(v).strip() not in ("", "nan", "None"):
                return v
    return default

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--start", type=int, default=2015)
    p.add_argument("--end", type=int, default=2024)
    p.add_argument("--min-pa", type=int, default=50)
    p.add_argument("--output", type=str, default="statpad_data")
    p.add_argument("--teams", nargs="*", default=None,
                   help="Specific teams to pull (e.g., NYY NYM LAD). Default: all 30")
    a = p.parse_args()

    try:
        from pybaseball import team_batting_bref
        import pandas as pd
    except ImportError:
        print("Install: pip install pybaseball pandas lxml")
        sys.exit(1)

    teams = a.teams if a.teams else ALL_TEAMS
    print(f"StatPad Data Generator v5 (per-team)")
    print(f"Range: {a.start}-{a.end}, min {a.min_pa} PA")
    print(f"Teams: {len(teams)}\n")

    all_records = []
    diagnosed = False

    for team_abbr in teams:
        print(f"  {team_abbr}...", end=" ", flush=True)
        try:
            df = team_batting_bref(team_abbr, a.start, a.end)
            print(f"{len(df)} rows", end="")
        except Exception as e:
            print(f"FAILED: {e}")
            time.sleep(5)
            continue

        if not diagnosed and len(df) > 0:
            diagnosed = True
            print(f"\n  [DEBUG] Columns: {list(df.columns)}")

        team_count = 0
        for _, row in df.iterrows():
            pa = si(get(row, "PA", default=0))
            if pa < a.min_pa:
                continue

            name = str(get(row, "Name", "name", default="")).strip()
            bats = "R"
            if name.endswith("*"):
                bats = "L"; name = name[:-1].strip()
            elif name.endswith("#"):
                bats = "S"; name = name[:-1].strip()
            if not name or name in ("Name", "Total", "Team Total"):
                continue

            year = si(get(row, "Year", "year", "Season", default=0))
            if year < a.start or year > a.end:
                continue

            # Position from BREF team batting (may have "Pos" or similar)
            pos = str(get(row, "Pos", "pos", default="DH")).strip()
            if pos in ("", "nan", "None"): pos = "DH"
            # Normalize positions
            if pos in ("LF","CF","RF"): pos = "OF"
            pos = pos.split("/")[0].strip()
            if pos not in ("C","1B","2B","3B","SS","OF","DH","P"):
                pos = "DH"

            record = {
                "name": name,
                "team": team_abbr,
                "year": year,
                "pos": pos,
                "bats": bats,
                "HR": si(get(row, "HR", default=0)),
                "RBI": si(get(row, "RBI", default=0)),
                "R": si(get(row, "R", default=0)),
                "H": si(get(row, "H", default=0)),
                "SB": si(get(row, "SB", default=0)),
                "BB": si(get(row, "BB", default=0)),
                "SO": si(get(row, "SO", default=0)),
                "2B": si(get(row, "2B", "X2B", default=0)),
                "3B": si(get(row, "3B", "X3B", default=0)),
                "PA": pa,
                "AB": si(get(row, "AB", default=0)),
                "AVG": sf(get(row, "BA", "AVG", default=0)),
                "OBP": sf(get(row, "OBP", default=0)),
                "SLG": sf(get(row, "SLG", default=0)),
                "OPS": sf(get(row, "OPS", default=0)),
                "wRC+": si(get(row, "OPS+", default=100)),
                "WAR": 0.0,
            }
            all_records.append(record)
            team_count += 1

        print(f" -> {team_count} kept")
        time.sleep(5)  # be polite to BREF

    print(f"\nTotal: {len(all_records)} records")

    if not all_records:
        print("No data. Check [DEBUG] output for column names.")
        sys.exit(1)

    # Compute XBH
    for r in all_records:
        r["XBH"] = r.get("2B", 0) + r.get("3B", 0) + r.get("HR", 0)

    # Deduplicate: a player might appear on multiple teams in same year
    # (traded mid-season). Keep each team's entry separately - this is
    # actually what we want for the game (same player, different teams).

    # Write files
    with open(f"{a.output}.json", "w") as f:
        json.dump(all_records, f, indent=2)

    with open(f"{a.output}.js", "w") as f:
        f.write(f"// BREF per-team {a.start}-{a.end} | {len(all_records)} player-seasons\n")
        f.write("const PLAYER_SEASONS = [\n")
        for i, r in enumerate(all_records):
            f.write(f"  {json.dumps(r)}{',' if i < len(all_records)-1 else ''}\n")
        f.write("];\n")

    u = len(set(r["name"] for r in all_records))
    t = len(set(r["team"] for r in all_records))
    print(f"\n{u} players, {len(all_records)} player-seasons, {t} teams")
    print(f"Written: {a.output}.json, {a.output}.js")

    best = max(all_records, key=lambda r: r["HR"])
    print(f"Top HR: {best['name']} ({best['year']} {best['team']}) - {best['HR']}")
    print(f"\nPaste contents of {a.output}.js into statpad_v2.jsx replacing PLAYER_SEASONS")

if __name__ == "__main__":
    main()
