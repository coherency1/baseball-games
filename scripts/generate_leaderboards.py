#!/usr/bin/env python3
"""
generate_leaderboards.py - All-Time MLB Leaderboard Data Generator
====================================================================
Generates public/leaderboard_data.json for the Pinpoint Challenge game.

Uses pybaseball to pull career-aggregated batting and pitching totals
from FanGraphs (via batting_stats / pitching_stats with qual=0).

INSTALL:
    pip install pybaseball pandas

RUN:
    python scripts/generate_leaderboards.py
    python scripts/generate_leaderboards.py --output public/leaderboard_data.json --top 150

OUTPUT FORMAT:
    {
      "generated": "2026-02-18",
      "categories": [
        {
          "id": "all_time_hr",
          "label": "Home Run Leaders",
          "era": "All-Time",
          "stat": "HR",
          "statLabel": "HR",
          "statType": "batting",
          "minimum": null,
          "players": [
            {"rank": 1, "name": "Barry Bonds", "value": 762},
            ...
          ]
        }
      ]
    }

NOTES:
- Counting stats (HR, RBI, H, BB, SO, pitching BB) have NO minimum —
  career totals self-select for significant players.
- Rate stats (wRC+, WAR, K/9) use PA/IP minimums to avoid small-sample noise.
- pybaseball.batting_stats(1871, 2025, qual=0) returns SEASON-level rows;
  we GROUP BY player name and SUM counting stats, use PA/IP-weighted
  averages for rate stats.
- Enable pybaseball's cache (stored in ~/.pybaseball/) to avoid re-fetching.
"""

import argparse
import json
import sys
from datetime import date


def si(v, d=0):
    """Safe int conversion."""
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return d


def sf(v, d=0.0, decimals=2):
    """Safe float conversion."""
    try:
        return round(float(v), decimals)
    except (TypeError, ValueError):
        return d


def normalize_name(name):
    """Strip trailing asterisk/hash symbols (BREF artifacts), preserve accents."""
    if not isinstance(name, str):
        return str(name)
    name = name.strip()
    while name and name[-1] in ("*", "#"):
        name = name[:-1].strip()
    return name


def col_name(df, *candidates):
    """Return the first candidate column name that exists in df, or None."""
    for c in candidates:
        if c in df.columns:
            return c
    return None


def fetch_with_retry(fn, start, end, max_retries=3):
    """Call fn(start, end, qual=0) with exponential backoff on failure."""
    import time
    for attempt in range(max_retries):
        try:
            return fn(start, end, qual=0)
        except Exception as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt  # 1s, 2s, 4s
                print(f"    retry {attempt+1}/{max_retries-1} after {wait}s ({e})", flush=True)
                time.sleep(wait)
            else:
                raise


def load_in_chunks(fn, label, start_year, end_year, chunk_size=15):
    """
    Pull data from FanGraphs in year-range chunks to avoid HTTP 524 timeouts.
    Each chunk covers `chunk_size` seasons. Results are concatenated into one DataFrame.
    """
    import pandas as pd

    chunks = []
    year = start_year
    total_chunks = ((end_year - start_year) // chunk_size) + 1

    while year <= end_year:
        chunk_end = min(year + chunk_size - 1, end_year)
        pct = int(100 * (year - start_year) / max(1, end_year - start_year))
        print(f"  [{pct:3d}%] {label} {year}-{chunk_end}...", end=" ", flush=True)
        try:
            chunk_df = fetch_with_retry(fn, year, chunk_end)
            print(f"{len(chunk_df)} rows", flush=True)
            chunks.append(chunk_df)
        except Exception as e:
            print(f"SKIP (error: {e})", flush=True)
        year = chunk_end + 1

    if not chunks:
        raise RuntimeError(f"All chunks failed for {label}")

    df = pd.concat(chunks, ignore_index=True)
    print(f"  Total: {len(df)} rows across {df['Season'].nunique()} seasons")
    return df


def load_batting(start_year, end_year, chunk_size=15):
    from pybaseball import batting_stats
    print(f"  Fetching batting stats {start_year}-{end_year} in {chunk_size}-year chunks...", flush=True)
    return load_in_chunks(batting_stats, "batting", start_year, end_year, chunk_size)


def load_pitching(start_year, end_year, chunk_size=15):
    from pybaseball import pitching_stats
    print(f"  Fetching pitching stats {start_year}-{end_year} in {chunk_size}-year chunks...", flush=True)
    return load_in_chunks(pitching_stats, "pitching", start_year, end_year, chunk_size)


def aggregate_batting(df):
    """
    Aggregate season rows into career totals per player.
    Counting stats are summed; rate stats (wRC+, WAR) are PA-weighted.
    Returns dict: name -> {PA, HR, RBI, H, BB, WAR, wRC+}
    """
    df = df.copy()
    df["Name"] = df["Name"].apply(normalize_name)

    pa_col  = col_name(df, "PA")
    hr_col  = col_name(df, "HR")
    rbi_col = col_name(df, "RBI")
    h_col   = col_name(df, "H")
    bb_col  = col_name(df, "BB")
    war_col = col_name(df, "WAR", "fWAR", "Batting WAR")
    wrc_col = col_name(df, "wRC+", "wRC")

    careers = {}
    for _, row in df.iterrows():
        name = row["Name"]
        if not name:
            continue

        pa  = si(row[pa_col])  if pa_col  else 0
        hr  = si(row[hr_col])  if hr_col  else 0
        rbi = si(row[rbi_col]) if rbi_col else 0
        h   = si(row[h_col])   if h_col   else 0
        bb  = si(row[bb_col])  if bb_col  else 0
        war = sf(row[war_col], decimals=1) if war_col else 0.0
        wrc_raw = sf(row[wrc_col], d=100.0, decimals=1) if wrc_col else 100.0

        if name not in careers:
            careers[name] = {
                "PA": 0, "HR": 0, "RBI": 0, "H": 0, "BB": 0,
                "WAR": 0.0, "_wrc_num": 0.0,
            }
        c = careers[name]
        c["PA"]      += pa
        c["HR"]      += hr
        c["RBI"]     += rbi
        c["H"]       += h
        c["BB"]      += bb
        c["WAR"]     += war
        c["_wrc_num"] += wrc_raw * pa

    for c in careers.values():
        c["wRC+"] = round(c["_wrc_num"] / c["PA"], 1) if c["PA"] > 0 else 100.0
        del c["_wrc_num"]
        c["WAR"] = round(c["WAR"], 1)

    return careers


def aggregate_pitching(df):
    """
    Aggregate pitching season rows into career totals per player.
    IP is in FanGraphs notation (200.1 = 200⅓ innings); converted to true decimal.
    Returns dict: name -> {IP, SO, BB, K/9}
    """
    df = df.copy()
    df["Name"] = df["Name"].apply(normalize_name)

    ip_col = col_name(df, "IP")
    so_col = col_name(df, "SO", "K")
    bb_col = col_name(df, "BB")
    k9_col = col_name(df, "K/9", "K9")

    careers = {}
    for _, row in df.iterrows():
        name = row["Name"]
        if not name:
            continue

        # Convert FanGraphs IP notation to true decimal innings
        ip_raw  = sf(row[ip_col], decimals=1) if ip_col else 0.0
        ip_int  = int(ip_raw)
        ip_frac = round(ip_raw - ip_int, 1)
        ip_true = ip_int + (ip_frac / 0.3) if ip_frac > 0 else float(ip_int)

        so  = si(row[so_col]) if so_col else 0
        bb  = si(row[bb_col]) if bb_col else 0
        k9  = sf(row[k9_col], decimals=2) if k9_col else 0.0

        if name not in careers:
            careers[name] = {"IP": 0.0, "SO": 0, "BB": 0, "_k9_num": 0.0}
        c = careers[name]
        c["IP"]      += ip_true
        c["SO"]      += so
        c["BB"]      += bb
        c["_k9_num"] += k9 * ip_true

    for c in careers.values():
        c["K/9"] = round(c["_k9_num"] / c["IP"], 2) if c["IP"] > 0 else 0.0
        del c["_k9_num"]
        c["IP"] = round(c["IP"], 1)

    return careers


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
        description="Generate leaderboard_data.json for Pinpoint Challenge"
    )
    parser.add_argument("--output", default="public/leaderboard_data.json")
    parser.add_argument("--start",  type=int, default=1871)
    parser.add_argument("--end",    type=int, default=2025)
    parser.add_argument("--top",    type=int, default=150,
                        help="Players per category (default: 150)")
    parser.add_argument("--chunk",  type=int, default=15,
                        help="Years per FanGraphs request (default: 15, reduce if timeouts persist)")
    args = parser.parse_args()

    try:
        import pybaseball
        import pandas as pd
    except ImportError:
        print("ERROR: Run:  pip install pybaseball pandas")
        sys.exit(1)

    pybaseball.cache.enable()

    print("=" * 60)
    print("Pinpoint Challenge — Leaderboard Data Generator")
    print(f"Range: {args.start}-{args.end}  |  Top {args.top} per category  |  Chunk size: {args.chunk}yr")
    print("=" * 60)

    # ── Batting ───────────────────────────────────────────────────
    print("\n[1/2] Loading batting data...")
    bat_df = load_batting(args.start, args.end, chunk_size=args.chunk)
    print("  Aggregating career batting totals...")
    bat = aggregate_batting(bat_df)
    print(f"  {len(bat)} unique batters")

    # ── Pitching ──────────────────────────────────────────────────
    print("\n[2/2] Loading pitching data...")
    pit_df = load_pitching(args.start, args.end, chunk_size=args.chunk)
    print("  Aggregating career pitching totals...")
    pit = aggregate_pitching(pit_df)
    print(f"  {len(pit)} unique pitchers")

    # ── Category definitions ──────────────────────────────────────
    BATTING_CATS = [
        # Counting stats — no minimum (career totals self-select)
        dict(id="all_time_hr",      label="Home Run Leaders",        stat="HR",   min_key=None, min_val=0,    minimum=None,      statLabel="HR",   statType="batting"),
        dict(id="all_time_rbi",     label="RBI Leaders",             stat="RBI",  min_key=None, min_val=0,    minimum=None,      statLabel="RBI",  statType="batting"),
        dict(id="all_time_hits",    label="Hits Leaders",            stat="H",    min_key=None, min_val=0,    minimum=None,      statLabel="H",    statType="batting"),
        dict(id="all_time_bb_bat",  label="Walks Leaders (Batters)", stat="BB",   min_key=None, min_val=0,    minimum=None,      statLabel="BB",   statType="batting"),
        # Rate stats — minimums required
        dict(id="all_time_war_bat", label="WAR Leaders (Batters)",   stat="WAR",  min_key="PA", min_val=1000, minimum="1000+ PA", statLabel="WAR",  statType="batting"),
        dict(id="all_time_wrcplus", label="wRC+ Leaders",            stat="wRC+", min_key="PA", min_val=3000, minimum="3000+ PA", statLabel="wRC+", statType="batting"),
    ]

    PITCHING_CATS = [
        # Counting stats — no minimum
        dict(id="all_time_so_pitch", label="Strikeout Leaders (Pitchers)", stat="SO", min_key=None, min_val=0,    minimum=None,       statLabel="SO",  statType="pitching"),
        dict(id="all_time_bb_pitch", label="Walks Allowed Leaders",        stat="BB", min_key=None, min_val=0,    minimum=None,       statLabel="BB",  statType="pitching"),
        # Rate stat — minimum required
        dict(id="all_time_k9",       label="K/9 Leaders (Pitchers)",       stat="K/9",min_key="IP", min_val=1000, minimum="1000+ IP", statLabel="K/9", statType="pitching"),
    ]

    # ── Build output ──────────────────────────────────────────────
    print("\nBuilding categories...")
    categories_out = []

    for cat in BATTING_CATS:
        print(f"  {cat['id']}...", end=" ", flush=True)
        players = build_top_n(bat, cat["stat"], cat["min_key"], cat["min_val"], args.top)
        if players:
            print(f"{len(players)} | #1: {players[0]['name']} ({players[0]['value']})")
        else:
            print("WARNING: 0 players returned!")
        categories_out.append({
            "id":        cat["id"],
            "label":     cat["label"],
            "era":       "All-Time",
            "stat":      cat["stat"],
            "statLabel": cat["statLabel"],
            "statType":  cat["statType"],
            "minimum":   cat["minimum"],
            "players":   players,
        })

    for cat in PITCHING_CATS:
        print(f"  {cat['id']}...", end=" ", flush=True)
        players = build_top_n(pit, cat["stat"], cat["min_key"], cat["min_val"], args.top)
        if players:
            print(f"{len(players)} | #1: {players[0]['name']} ({players[0]['value']})")
        else:
            print("WARNING: 0 players returned!")
        categories_out.append({
            "id":        cat["id"],
            "label":     cat["label"],
            "era":       "All-Time",
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
        "categories": categories_out,
    }

    print(f"\nWriting to {args.output}...")
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    import os
    size_kb = os.path.getsize(args.output) / 1024
    print(f"Done! {len(categories_out)} categories written ({size_kb:.1f} KB)")
    print("\nNext step: npm run dev")


if __name__ == "__main__":
    main()
