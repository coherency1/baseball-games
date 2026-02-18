#!/usr/bin/env python3
"""
generate_leaderboards.py - All-Time MLB Leaderboard Data Generator
====================================================================
Generates public/leaderboard_data.json for the Pinpoint Challenge game.

Uses the SABR Lahman Baseball Database (https://sabr.org/lahman-database/).
WAR is fetched from Baseball Reference via pybaseball.bwar_bat() with a
graceful fallback if that fails.

INSTALL:
    pip install pandas requests pybaseball

RUN:
    python scripts/generate_leaderboards.py --local-dir ~/Downloads/lahman
    python scripts/generate_leaderboards.py --local-dir ~/Downloads/lahman --end 2025 --top 150

DATA SOURCES:
- Lahman Batting.csv  (HR, RBI, H, BB, R, SB, 2B, 3B, AB, HBP, SF, SH)
- Lahman Pitching.csv (IPouts, SO, BB, W, SV, CG, SHO)
- Lahman People.csv   (playerID → "First Last" name)
- bwar_bat()          → Baseball Reference WAR CSV (career WAR, optional)

CATEGORIES (16 total):
  Batting counting: HR, RBI, H, BB, R, SB, 2B, 3B  — no minimum
  Batting rate:     WAR                              — no minimum
  Pitching counting: SO, BB, W, SV, CG, SHO         — no minimum
  Pitching rate:    K/9                              — 1000+ IP minimum
"""

import argparse
import json
import sys
from datetime import date


def build_name_map(people_df):
    """Build playerID -> 'First Last' from Lahman People.csv."""
    people_df = people_df.copy()
    first = people_df["nameFirst"].fillna("").str.strip()
    last  = people_df["nameLast"].fillna("").str.strip()
    people_df["fullName"] = (first + " " + last).str.strip()
    return people_df.set_index("playerID")["fullName"].to_dict()


def aggregate_lahman_batting(bat_df, name_map):
    """
    Group Lahman Batting.csv by playerID, sum counting stats.
    PA = AB + BB + HBP + SF + SH  (standard approximation).
    Returns dict: "First Last" -> {PA, HR, RBI, H, BB, R, SB, 2B, 3B}
    """
    import pandas as pd

    agg_cols = ["AB", "HR", "RBI", "H", "BB", "HBP", "SF", "SH", "R", "SB", "2B", "3B"]
    # Fill NaN with 0 before summing (older seasons may lack some columns)
    for col in agg_cols:
        if col not in bat_df.columns:
            bat_df[col] = 0
        bat_df[col] = bat_df[col].fillna(0)

    career = bat_df.groupby("playerID")[agg_cols].sum()
    career["PA"] = career["AB"] + career["BB"] + career["HBP"] + career["SF"] + career["SH"]

    result = {}
    for pid, row in career.iterrows():
        name = name_map.get(pid, "")
        if not name or not name.strip():
            continue
        result[name] = {
            "PA":  int(row["PA"]),
            "HR":  int(row["HR"]),
            "RBI": int(row["RBI"]),
            "H":   int(row["H"]),
            "BB":  int(row["BB"]),
            "R":   int(row["R"]),
            "SB":  int(row["SB"]),
            "2B":  int(row["2B"]),
            "3B":  int(row["3B"]),
        }
    return result


def aggregate_lahman_pitching(pit_df, name_map):
    """
    Group Lahman Pitching.csv by playerID, sum counting stats.
    Lahman stores IPouts (outs recorded), so IP = IPouts / 3 exactly.
    K/9 = (SO / IP) * 9, computed after aggregation.
    Returns dict: "First Last" -> {IP, SO, BB, K/9, W, SV, CG, SHO}
    """
    pit_df = pit_df.copy()
    for col in ["IPouts", "SO", "BB", "W", "SV", "CG", "SHO"]:
        if col not in pit_df.columns:
            pit_df[col] = 0
        pit_df[col] = pit_df[col].fillna(0)

    career = pit_df.groupby("playerID")[["IPouts", "SO", "BB", "W", "SV", "CG", "SHO"]].sum()
    career["IP"] = career["IPouts"] / 3.0
    career["K/9"] = (career["SO"] / career["IP"] * 9).where(career["IP"] > 0, 0.0)

    result = {}
    for pid, row in career.iterrows():
        name = name_map.get(pid, "")
        if not name or not name.strip():
            continue
        result[name] = {
            "IP":  round(row["IP"], 1),
            "SO":  int(row["SO"]),
            "BB":  int(row["BB"]),
            "K/9": round(row["K/9"], 2),
            "W":   int(row["W"]),
            "SV":  int(row["SV"]),
            "CG":  int(row["CG"]),
            "SHO": int(row["SHO"]),
        }
    return result


def aggregate_bwar(war_df):
    """
    Group bwar_bat() DataFrame by name_common, sum WAR.
    Returns dict: "First Last" -> {WAR}
    """
    career = war_df.groupby("name_common")["WAR"].sum()
    return {
        name: {"WAR": round(float(war), 1)}
        for name, war in career.items()
        if isinstance(name, str) and name.strip()
    }


def build_top_n(careers, stat_key, min_key=None, min_val=0, top_n=150):
    """
    Filter careers by optional minimum, sort descending by stat_key, return top_n.
    Returns list of {"rank": int, "name": str, "value": numeric}
    """
    qualified = [
        (name, stats)
        for name, stats in careers.items()
        if (min_key is None or stats.get(min_key, 0) >= min_val)
        and stats.get(stat_key) is not None
    ]
    sorted_q = sorted(qualified, key=lambda x: x[1].get(stat_key, 0), reverse=True)
    top = sorted_q[:top_n]

    result = []
    for rank, (name, stats) in enumerate(top, start=1):
        val = stats[stat_key]
        if isinstance(val, float):
            val = round(val, 1)
        result.append({"rank": rank, "name": name, "value": val})
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Generate leaderboard_data.json for Pinpoint Challenge (Lahman-based)"
    )
    parser.add_argument("--output", default="public/leaderboard_data.json")
    parser.add_argument("--start",  type=int, default=1871,
                        help="First season to include (default: 1871)")
    parser.add_argument("--end",    type=int, default=2025,
                        help="Last season to include (default: 2025)")
    parser.add_argument("--top",    type=int, default=150,
                        help="Players per category (default: 150)")
    parser.add_argument("--local-dir", default=None, dest="local_dir",
                        help="Path to a directory containing People.csv, Batting.csv, "
                             "Pitching.csv (skips all downloads). Get these files from "
                             "https://sabr.org/lahman-database/")
    args = parser.parse_args()

    try:
        import pandas as pd
    except ImportError:
        print("ERROR: Run:  pip install pandas")
        sys.exit(1)

    era_label = f"All-Time ({args.start}–{args.end})"

    print("=" * 60)
    print("Pinpoint Challenge — Leaderboard Data Generator (Lahman)")
    print(f"Range: {args.start}-{args.end}  |  Top {args.top} per category")
    print("=" * 60)

    # ── Load Lahman CSVs ───────────────────────────────────────────
    # The Chadwick Bureau GitHub repo (pybaseball's source) has been taken
    # down. Use --local-dir to supply CSVs downloaded from sabr.org/lahman-database/
    if args.local_dir:
        import os
        local = args.local_dir.rstrip("/")
        print(f"\n[1/4] Reading Lahman CSVs from local dir: {local}")
        def _read_local(name):
            path = os.path.join(local, name)
            if not os.path.exists(path):
                raise FileNotFoundError(
                    f"Missing {path}\n"
                    f"Download the Lahman database from:\n"
                    f"  https://sabr.org/lahman-database/\n"
                    f"(choose the CSV/comma-delimited version) then extract it and "
                    f"pass the extracted folder with --local-dir"
                )
            return pd.read_csv(path, low_memory=False)

        people_df = _read_local("People.csv")
        name_map  = build_name_map(people_df)
        print(f"  {len(name_map)} players in name map")

        print("\n[2/4] Parsing Batting.csv...")
        bat_df = _read_local("Batting.csv")

        print("\n[3/4] Parsing Pitching.csv...")
        pit_df = _read_local("Pitching.csv")

    else:
        # Try downloading Sean Lahman's official ZIP (no GitHub dependency)
        try:
            import requests
            from zipfile import ZipFile
            from io import BytesIO
        except ImportError:
            print("ERROR: Run:  pip install requests")
            sys.exit(1)

        LAHMAN_URLS = [
            # SABR now hosts the Lahman database (https://sabr.org/lahman-database/)
            "https://sabr.org/wp-content/uploads/lahman/lahmansbaseballdb.zip",
            # Fallback: old seanlahman.com location (may no longer be maintained)
            "https://www.seanlahman.com/files/database/lahmansbaseballdb.zip",
        ]
        print("\n[1/4] Downloading Lahman database from sabr.org...")
        zip_data = None
        for url in LAHMAN_URLS:
            try:
                print(f"  Trying {url}")
                r = requests.get(url, timeout=90,
                                 headers={"User-Agent": "Mozilla/5.0"})
                r.raise_for_status()
                zip_data = ZipFile(BytesIO(r.content))
                print(f"  Downloaded {len(r.content)//1024} KB")
                break
            except Exception as e:
                print(f"  Failed: {e}")

        if zip_data is None:
            print("\n" + "="*60)
            print("DOWNLOAD FAILED — manual setup required:")
            print("  1. Go to https://sabr.org/lahman-database/")
            print("  2. Download the CSV (comma-delimited) ZIP")
            print("  3. Extract it to a folder, e.g. ~/Downloads/lahman/")
            print("  4. Re-run with:")
            print("       python scripts/generate_leaderboards.py \\")
            print("         --local-dir ~/Downloads/lahman --end 2025 --top 150")
            print("="*60)
            sys.exit(1)

        # Find which names the ZIP uses (varies by version)
        names = zip_data.namelist()
        def _find_csv(candidates):
            for c in candidates:
                matches = [n for n in names if n.lower().endswith(c.lower())]
                if matches:
                    return matches[0]
            raise KeyError(f"Could not find {candidates[0]} in ZIP. Files: {names[:10]}")

        def _read_zip(candidates):
            path = _find_csv(candidates)
            with zip_data.open(path) as f:
                return pd.read_csv(f, low_memory=False)

        print("\n[1/4] Parsing People.csv...")
        people_df = _read_zip(["People.csv", "Master.csv"])
        name_map  = build_name_map(people_df)
        print(f"  {len(name_map)} players in name map")

        print("\n[2/4] Parsing Batting.csv...")
        bat_df = _read_zip(["Batting.csv"])

        print("\n[3/4] Parsing Pitching.csv...")
        pit_df = _read_zip(["Pitching.csv"])

    # ── Filter by year range ───────────────────────────────────────
    bat_df = bat_df[(bat_df["yearID"] >= args.start) & (bat_df["yearID"] <= args.end)]
    print(f"  {len(bat_df)} batting rows ({bat_df['yearID'].nunique()} seasons)")
    bat = aggregate_lahman_batting(bat_df, name_map)
    print(f"  {len(bat)} unique batters")

    pit_df = pit_df[(pit_df["yearID"] >= args.start) & (pit_df["yearID"] <= args.end)]
    print(f"  {len(pit_df)} pitching rows ({pit_df['yearID'].nunique()} seasons)")
    pit = aggregate_lahman_pitching(pit_df, name_map)
    print(f"  {len(pit)} unique pitchers")

    # ── WAR (Baseball Reference via pybaseball) ────────────────────
    print("\n[4/4] Loading WAR from Baseball Reference (pybaseball.bwar_bat)...")
    try:
        from pybaseball.league_batting_stats import bwar_bat
        war_df = bwar_bat()
        # bwar_bat column is 'year_ID' (not 'yearID')
        year_col = "year_ID" if "year_ID" in war_df.columns else "yearID"
        war_df = war_df[(war_df[year_col] >= args.start) & (war_df[year_col] <= args.end)]
        print(f"  {len(war_df)} WAR rows")
        war = aggregate_bwar(war_df)
        print(f"  {len(war)} unique players with WAR data")
        war_ok = True
    except Exception as e:
        print(f"  WARNING: bwar_bat() failed ({e}) — skipping WAR category")
        war = {}
        war_ok = False

    # ── Category definitions ──────────────────────────────────────
    BATTING_CATS = [
        dict(id="all_time_hr",      label="Home Run Leaders",        stat="HR",  min_key=None, min_val=0, minimum=None, statLabel="HR",  statType="batting"),
        dict(id="all_time_rbi",     label="RBI Leaders",             stat="RBI", min_key=None, min_val=0, minimum=None, statLabel="RBI", statType="batting"),
        dict(id="all_time_hits",    label="Hits Leaders",            stat="H",   min_key=None, min_val=0, minimum=None, statLabel="H",   statType="batting"),
        dict(id="all_time_bb_bat",  label="Walks Leaders (Batters)", stat="BB",  min_key=None, min_val=0, minimum=None, statLabel="BB",  statType="batting"),
        dict(id="all_time_runs",    label="Runs Scored Leaders",     stat="R",   min_key=None, min_val=0, minimum=None, statLabel="R",   statType="batting"),
        dict(id="all_time_sb",      label="Stolen Base Leaders",     stat="SB",  min_key=None, min_val=0, minimum=None, statLabel="SB",  statType="batting"),
        dict(id="all_time_2b",      label="Doubles Leaders",         stat="2B",  min_key=None, min_val=0, minimum=None, statLabel="2B",  statType="batting"),
        dict(id="all_time_3b",      label="Triples Leaders",         stat="3B",  min_key=None, min_val=0, minimum=None, statLabel="3B",  statType="batting"),
    ]

    WAR_CATS = [
        # bwar_bat() is position-players only, so no minimum needed
        dict(id="all_time_war_bat", label="WAR Leaders (Batters)", stat="WAR", min_key=None, min_val=0, minimum=None, statLabel="WAR", statType="batting"),
    ] if war_ok else []

    PITCHING_CATS = [
        dict(id="all_time_so_pitch", label="Strikeout Leaders (Pitchers)", stat="SO",  min_key=None,  min_val=0,    minimum=None,       statLabel="SO",  statType="pitching"),
        dict(id="all_time_bb_pitch", label="Walks Allowed Leaders",        stat="BB",  min_key=None,  min_val=0,    minimum=None,       statLabel="BB",  statType="pitching"),
        dict(id="all_time_k9",       label="K/9 Leaders (Pitchers)",       stat="K/9", min_key="IP",  min_val=1000, minimum="1000+ IP", statLabel="K/9", statType="pitching"),
        dict(id="all_time_wins",     label="Win Leaders (Pitchers)",       stat="W",   min_key=None,  min_val=0,    minimum=None,       statLabel="W",   statType="pitching"),
        dict(id="all_time_sv",       label="Save Leaders (Pitchers)",      stat="SV",  min_key=None,  min_val=0,    minimum=None,       statLabel="SV",  statType="pitching"),
        dict(id="all_time_cg",       label="Complete Game Leaders",        stat="CG",  min_key=None,  min_val=0,    minimum=None,       statLabel="CG",  statType="pitching"),
        dict(id="all_time_sho",      label="Shutout Leaders (Pitchers)",   stat="SHO", min_key=None,  min_val=0,    minimum=None,       statLabel="SHO", statType="pitching"),
    ]

    # ── Build output ──────────────────────────────────────────────
    print("\nBuilding categories...")
    categories_out = []

    for cat, careers in (
        [(c, bat) for c in BATTING_CATS] +
        [(c, war) for c in WAR_CATS] +
        [(c, pit) for c in PITCHING_CATS]
    ):
        print(f"  {cat['id']}...", end=" ", flush=True)
        players = build_top_n(careers, cat["stat"], cat["min_key"], cat["min_val"], args.top)
        if players:
            print(f"{len(players)} players | #1: {players[0]['name']} ({players[0]['value']})")
        else:
            print("WARNING: 0 players returned!")
        categories_out.append({
            "id":        cat["id"],
            "label":     cat["label"],
            "era":       era_label,
            "stat":      cat["stat"],
            "statLabel": cat["statLabel"],
            "statType":  cat["statType"],
            "minimum":   cat["minimum"],
            "players":   players,
        })

    # ── Write file ────────────────────────────────────────────────
    output = {
        "generated":  str(date.today()),
        "top_n":      args.top,
        "era":        era_label,
        "categories": categories_out,
    }

    print(f"\nWriting to {args.output}...")
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    import os
    size_kb = os.path.getsize(args.output) / 1024
    print(f"Done! {len(categories_out)} categories written ({size_kb:.1f} KB)")
    print(f"\nSanity check:")
    print(f"  python -c \"import json; d=json.load(open('{args.output}')); [print(c['id'], '#1:', c['players'][0]['name'], c['players'][0]['value']) for c in d['categories'] if c['players']]\"")
    print(f"\nNext step: npm run dev")


if __name__ == "__main__":
    main()
