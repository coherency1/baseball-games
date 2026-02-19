#!/usr/bin/env python3
"""
generate_from_lahman.py — StatPad Data Generator (Lahman-based)
================================================================
Reads locally stored Lahman CSV files and outputs public/statpad_data.json
in the exact format the StatPad game expects. No API calls, no scraping,
no rate limits — just a local CSV → JSON conversion.

INSTALL:
    pip install pandas

RUN:
    python scripts/generate_from_lahman.py --local-dir public/lahman-folder
    python scripts/generate_from_lahman.py --local-dir public/lahman-folder --start 2000
    python scripts/generate_from_lahman.py --local-dir public/lahman-folder --start 1990 --end 2025 --min-pa 100

GET LAHMAN FILES:
    https://sabr.org/lahman-database/  (download the CSV/comma-delimited ZIP)
    Extract and pass the folder with --local-dir.

DATA SOURCES USED:
    People.csv   — playerID → full name, batting hand (L/R/B)
    Batting.csv  — per season/team/stint batting stats
    Fielding.csv — per season/team/stint defensive position (for primary pos)

OUTPUT FIELDS (per record):
    name, team, year, pos, bats,
    HR, RBI, R, H, SB, BB, SO, 2B, 3B, PA, AB,
    AVG, OBP, SLG, OPS, wRC+, WAR, XBH

NOTE:
    wRC+ and WAR are not in the Lahman database. They are written as 100 and 0.0
    respectively (same placeholders as the old API-based generators used).
    The game's engine does not use wRC+ or WAR for puzzle logic — only for display.
"""

import argparse
import json
import os
import sys


# ── Team ID mapping: Lahman teamID → game abbreviation ────────────────────────
# None = franchise no longer active in game (Expos, etc.) — rows are skipped.
LAHMAN_TO_GAME = {
    # AL East
    "NYA": "NYY", "BOS": "BOS", "TOR": "TOR", "BAL": "BAL",
    "TBA": "TBR", "TBD": "TBR",
    # AL Central
    "CHA": "CHW", "MIN": "MIN", "DET": "DET",
    "CLE": "CLE", "CLG": "CLE",   # CLE = Indians era, CLG = Guardians era
    "KCA": "KCR",
    # AL West
    "OAK": "OAK", "ATH": "OAK",
    "SEA": "SEA", "HOU": "HOU", "TEX": "TEX",
    "LAA": "LAA", "ANA": "LAA", "CAL": "LAA",
    # NL East
    "NYN": "NYM", "PHI": "PHI", "ATL": "ATL",
    "MIA": "MIA", "FLO": "MIA",
    "WAS": "WSN", "MON": None,     # Expos — skip
    # NL Central
    "CHN": "CHC", "SLN": "STL", "MIL": "MIL", "CIN": "CIN", "PIT": "PIT",
    # NL West
    "LAN": "LAD", "SFN": "SFG", "SDN": "SDP", "ARI": "ARI", "COL": "COL",
}

# Batting hand: Lahman uses B for switch hitters, game uses S
BATS_NORM = {"L": "L", "R": "R", "B": "S"}

# Outfield sub-positions in Lahman → normalize to OF
OF_SUBS = {"LF", "CF", "RF"}

# Positions the game recognises
VALID_POS = {"C", "1B", "2B", "3B", "SS", "OF", "P", "DH"}


def to_int(v, default=0):
    try:
        return int(round(float(v)))
    except (ValueError, TypeError):
        return default


def to_float(v, places=3, default=0.0):
    try:
        return round(float(v), places)
    except (ValueError, TypeError):
        return default


def main():
    parser = argparse.ArgumentParser(
        description="Convert Lahman CSVs → public/statpad_data.json for StatPad"
    )
    parser.add_argument(
        "--local-dir", required=True, dest="local_dir",
        help="Folder containing People.csv, Batting.csv, Fielding.csv"
    )
    parser.add_argument("--start",  type=int, default=2008,
                        help="First season to include (default: 2008)")
    parser.add_argument("--end",    type=int, default=2025,
                        help="Last season to include (default: 2025)")
    parser.add_argument("--min-pa", type=int, default=50, dest="min_pa",
                        help="Minimum plate appearances to include (default: 50)")
    parser.add_argument("--output", default="public/statpad_data.json",
                        help="Output path (default: public/statpad_data.json)")
    args = parser.parse_args()

    try:
        import pandas as pd
    except ImportError:
        print("ERROR: pip install pandas")
        sys.exit(1)

    local = args.local_dir.rstrip("/")

    def read_csv(name):
        path = os.path.join(local, name)
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Missing: {path}\n"
                f"Download from https://sabr.org/lahman-database/ "
                f"and pass the extracted folder with --local-dir"
            )
        return pd.read_csv(path, low_memory=False)

    print("=" * 60)
    print("StatPad Data Generator — Lahman Edition")
    print(f"  Range : {args.start}–{args.end}")
    print(f"  Min PA: {args.min_pa}")
    print(f"  Output: {args.output}")
    print("=" * 60)

    # ── [1/3] People.csv → name + bats ────────────────────────────────────────
    print("\n[1/3] People.csv...")
    people = read_csv("People.csv")
    name_map  = {}   # playerID → "First Last"
    bats_map  = {}   # playerID → L/R/S
    for _, row in people.iterrows():
        pid   = row["playerID"]
        first = str(row.get("nameFirst") or "").strip()
        last  = str(row.get("nameLast")  or "").strip()
        name_map[pid] = (first + " " + last).strip()
        raw   = str(row.get("bats") or "").strip().upper()
        bats_map[pid] = BATS_NORM.get(raw, "R")
    print(f"  {len(name_map):,} players")

    # ── [2/3] Fielding.csv → primary position per (playerID, yearID, teamID) ──
    # For each player-season-team combo, the position with the most games played
    # is their "primary" position (e.g. a C who played one game at 1B stays C).
    print("\n[2/3] Fielding.csv...")
    fielding = read_csv("Fielding.csv")
    fielding = fielding[
        (fielding["yearID"] >= args.start) & (fielding["yearID"] <= args.end)
    ]

    # pos_best: (playerID, yearID, teamID) → (POS, games)
    pos_best = {}
    for _, row in fielding.iterrows():
        pid    = row["playerID"]
        year   = int(row["yearID"])
        team   = str(row.get("teamID") or "").strip()
        pos    = str(row.get("POS")    or "").strip().upper()
        games  = to_int(row.get("G", 0))

        if pos in OF_SUBS:
            pos = "OF"
        if pos not in VALID_POS:
            continue

        key = (pid, year, team)
        if key not in pos_best or games > pos_best[key][1]:
            pos_best[key] = (pos, games)

    pos_lookup = {k: v[0] for k, v in pos_best.items()}
    print(f"  {len(pos_lookup):,} player-season-team position entries")

    # ── [3/3] Batting.csv → main records ──────────────────────────────────────
    print("\n[3/3] Batting.csv...")
    bat = read_csv("Batting.csv")
    bat = bat[(bat["yearID"] >= args.start) & (bat["yearID"] <= args.end)]
    print(f"  {len(bat):,} batting rows in {args.start}–{args.end}")

    # Fill missing columns with 0
    for col in ["AB", "R", "H", "2B", "3B", "HR", "RBI",
                "SB", "BB", "SO", "HBP", "SF", "SH"]:
        if col in bat.columns:
            bat[col] = bat[col].fillna(0)
        else:
            bat[col] = 0

    records       = []
    skip_team     = 0
    skip_pa       = 0
    skip_no_name  = 0

    for _, row in bat.iterrows():
        pid      = row["playerID"]
        year     = int(row["yearID"])
        lahman_t = str(row.get("teamID") or "").strip()

        # Map to game team abbreviation
        game_team = LAHMAN_TO_GAME.get(lahman_t)
        if game_team is None:
            skip_team += 1
            continue

        name = name_map.get(pid, "")
        if not name:
            skip_no_name += 1
            continue

        # Counting stats
        ab       = to_int(row["AB"])
        h        = to_int(row["H"])
        dbl      = to_int(row["2B"])
        trp      = to_int(row["3B"])
        hr       = to_int(row["HR"])
        rbi      = to_int(row["RBI"])
        runs     = to_int(row["R"])
        sb       = to_int(row["SB"])
        bb       = to_int(row["BB"])
        so       = to_int(row["SO"])
        hbp      = to_int(row["HBP"])
        sac_fly  = to_int(row["SF"])
        sac_hit  = to_int(row["SH"])

        pa = ab + bb + hbp + sac_fly + sac_hit
        if pa < args.min_pa:
            skip_pa += 1
            continue

        # Rate stats
        avg = to_float(h / ab) if ab > 0 else 0.0
        obp_denom = ab + bb + hbp + sac_fly
        obp = to_float((h + bb + hbp) / obp_denom) if obp_denom > 0 else 0.0
        # TB = H + 2B + 2×3B + 3×HR  (= 1B×1 + 2B×2 + 3B×3 + HR×4)
        tb  = h + dbl + 2 * trp + 3 * hr
        slg = to_float(tb / ab) if ab > 0 else 0.0
        ops = to_float(obp + slg)

        # Position: primary from Fielding.csv, fallback to DH
        pos  = pos_lookup.get((pid, year, lahman_t), "DH")
        bats = bats_map.get(pid, "R")

        records.append({
            "name": name,
            "team": game_team,
            "year": year,
            "pos":  pos,
            "bats": bats,
            "HR":   hr,
            "RBI":  rbi,
            "R":    runs,
            "H":    h,
            "SB":   sb,
            "BB":   bb,
            "SO":   so,
            "2B":   dbl,
            "3B":   trp,
            "PA":   pa,
            "AB":   ab,
            "AVG":  avg,
            "OBP":  obp,
            "SLG":  slg,
            "OPS":  ops,
            "wRC+": 100,   # not in Lahman — placeholder
            "WAR":  0.0,   # not in Lahman — placeholder
            "XBH":  dbl + trp + hr,
        })

    # Sort by year then name for stable output
    records.sort(key=lambda r: (r["year"], r["name"]))

    print(f"\n{'─'*40}")
    print(f"  Kept  : {len(records):,} records")
    print(f"  < PA  : {skip_pa:,} skipped (below {args.min_pa} PA)")
    print(f"  Team  : {skip_team:,} skipped (unmapped/inactive franchise)")
    print(f"  Name  : {skip_no_name:,} skipped (not in People.csv)")

    if not records:
        print("\nERROR: No records produced. Check --local-dir and year range.")
        sys.exit(1)

    print(f"\nWriting {args.output}...")
    out_dir = os.path.dirname(args.output)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(records, f)

    kb      = os.path.getsize(args.output) / 1024
    years   = sorted({r["year"] for r in records})
    players = len({r["name"] for r in records})
    teams   = len({r["team"] for r in records})
    top_hr  = max(records, key=lambda r: r["HR"])

    print(f"\nDone!")
    print(f"  {len(records):,} records | {players:,} players | {teams} teams")
    print(f"  Years: {years[0]}–{years[-1]}  |  Size: {kb:.0f} KB")
    print(f"  Top HR: {top_hr['name']} ({top_hr['year']} {top_hr['team']}) — {top_hr['HR']} HR")
    print(f"\nNext step: npm run dev")


if __name__ == "__main__":
    main()
