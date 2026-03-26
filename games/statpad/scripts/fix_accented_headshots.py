#!/usr/bin/env python3
"""
fix_accented_headshots.py — Repair Accented-Name Mismatches in headshots.json
===============================================================================
After running fetch_headshots.py you may find players stored as null because
their name in statpad_data.json ("Adrian Gonzalez") doesn't match People.csv
("Adrián González"), or vice versa.

This script:
1. Reads headshots.json and finds every entry where the value is null.
2. Loads People.csv and builds a normalised name → bbrefID map (strips
   diacritics and lowercases both sides when matching).
3. For each null player whose bbrefID is now recovered, scrapes Baseball
   Reference and writes the headshot URL into headshots.json.
4. Prints a summary of recovered vs. still-missing players.

Re-running is safe — only processes null entries and never overwrites
existing URLs.

INSTALL:
    pip install requests beautifulsoup4

RUN:
    python scripts/fix_accented_headshots.py
    python scripts/fix_accented_headshots.py --headshots public/headshots.json --delay 3
"""

import argparse
import csv
import json
import os
import sys
import time
import unicodedata


def normalize(s):
    """Strip diacritics and lowercase — mirrors JS `deburr` in App.jsx."""
    nfd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn").lower().strip()


def load_bbref_maps(lahman_dir):
    """
    Build two mappings from People.csv:
      exact_map[first last]          → bbrefID  (original casing)
      norm_map[normalize(first last)] → bbrefID  (accent/case stripped)
    """
    path = os.path.join(lahman_dir, "People.csv")
    if not os.path.exists(path):
        print(f"ERROR: {path} not found. Pass --lahman <folder>")
        sys.exit(1)

    exact_map = {}
    norm_map  = {}
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            first = (row.get("nameFirst") or "").strip()
            last  = (row.get("nameLast")  or "").strip()
            bbref = (row.get("bbrefID")   or "").strip()
            if not (first and last and bbref):
                continue
            full = f"{first} {last}"
            exact_map[full]           = bbref
            norm_map[normalize(full)] = bbref

    return exact_map, norm_map


def scrape_headshot(session, bbref_id):
    """Return (img_url_or_None, page_url)."""
    from bs4 import BeautifulSoup
    first_letter = bbref_id[0]
    url = f"https://www.baseball-reference.com/players/{first_letter}/{bbref_id}.shtml"

    resp = session.get(url, timeout=15)
    if resp.status_code == 429:
        return "RATE_LIMITED", url
    if resp.status_code != 200:
        return None, url

    soup = BeautifulSoup(resp.text, "html.parser")
    media_div = (
        soup.find("div", class_="media-item multiple") or
        soup.find("div", class_="media-item")
    )
    if media_div:
        img = media_div.find("img")
        if img and img.get("src"):
            return img["src"], url
    return None, url


def save(cache, path):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(
        description="Fix null headshot entries caused by accented-name mismatches"
    )
    parser.add_argument("--headshots", default="public/headshots.json")
    parser.add_argument("--lahman",    default="public/lahman-folder")
    parser.add_argument("--delay",     type=float, default=3.0,
                        help="Seconds between requests (default: 3.0)")
    args = parser.parse_args()

    try:
        import requests
        from bs4 import BeautifulSoup  # noqa: F401
    except ImportError:
        print("ERROR: pip install requests beautifulsoup4")
        sys.exit(1)

    # ── Load headshots.json ───────────────────────────────────────────────────
    if not os.path.exists(args.headshots):
        print(f"ERROR: {args.headshots} not found. Run fetch_headshots.py first.")
        sys.exit(1)
    with open(args.headshots, encoding="utf-8") as f:
        cache = json.load(f)

    null_names = [name for name, url in cache.items() if url is None]
    print(f"Loaded {len(cache):,} entries from {args.headshots}")
    print(f"Found {len(null_names):,} null entries to attempt recovery")

    if not null_names:
        print("Nothing to do — no null entries.")
        return

    # ── Build bbrefID maps from People.csv ───────────────────────────────────
    print(f"\nLoading People.csv...")
    exact_map, norm_map = load_bbref_maps(args.lahman)
    print(f"  {len(exact_map):,} exact entries, {len(norm_map):,} normalised entries")

    # ── Try to recover bbrefIDs via normalised matching ───────────────────────
    recovered = {}   # name → bbrefID
    still_no_id = []

    for name in null_names:
        # exact match first (shouldn't be needed since fetch_headshots already tried)
        bbref = exact_map.get(name) or norm_map.get(normalize(name))
        if bbref:
            recovered[name] = bbref
        else:
            still_no_id.append(name)

    print(f"\nRecovered bbrefIDs : {len(recovered):,}")
    print(f"Still no match     : {len(still_no_id):,}")

    if still_no_id:
        print("\nPlayers still without a bbrefID match:")
        for n in still_no_id[:20]:
            print(f"  {n!r}")
        if len(still_no_id) > 20:
            print(f"  … and {len(still_no_id)-20} more")

    if not recovered:
        print("\nNo new matches found — nothing to scrape.")
        return

    # ── Scrape Baseball Reference for recovered players ───────────────────────
    import requests as req
    session = req.Session()
    session.headers["User-Agent"] = (
        "Mozilla/5.0 (compatible; StatPad headshot fixer; educational use)"
    )

    fetched  = 0
    no_image = 0

    todo = list(recovered.items())
    for i, (name, bbref_id) in enumerate(todo, 1):
        print(f"[{i:3}/{len(todo)}] {name} ({bbref_id}) ...", end=" ", flush=True)

        try:
            result, page_url = scrape_headshot(session, bbref_id)
        except req.RequestException as e:
            print(f"network error: {e} — skipping (retry next run)")
            time.sleep(args.delay)
            continue

        if result == "RATE_LIMITED":
            print("rate limited — pausing 60s then retrying")
            time.sleep(60)
            try:
                result, _ = scrape_headshot(session, bbref_id)
            except req.RequestException:
                result = None

        if result and result != "RATE_LIMITED":
            cache[name] = result
            fetched += 1
            print(f"✓  {result}")
        else:
            # Leave as null — could be retired player page with no photo
            cache[name] = None
            no_image += 1
            print("no image on page")

        save(cache, args.headshots)
        time.sleep(args.delay)

    # ── Summary ───────────────────────────────────────────────────────────────
    total_with = sum(1 for v in cache.values() if v)
    print(f"\n{'='*50}")
    print(f"Newly fetched : {fetched:,}")
    print(f"No image found: {no_image:,}")
    print(f"Still no ID   : {len(still_no_id):,}")
    print(f"Total with images: {total_with:,} / {len(cache):,}")
    print(f"Output: {args.headshots}")


if __name__ == "__main__":
    main()
