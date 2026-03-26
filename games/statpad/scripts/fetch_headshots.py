#!/usr/bin/env python3
"""
fetch_headshots.py — Baseball Reference Headshot Scraper
========================================================
Reads player names from public/statpad_data.json, resolves each name
to a Baseball Reference ID via public/lahman-folder/People.csv, then
scrapes each player's Baseball Reference page for headshot image URLs.

Results are saved to public/headshots.json as {"Player Name": "https://..."}.
Re-running is safe — already-fetched players are skipped (resumable).

INSTALL:
    pip install requests beautifulsoup4

RUN:
    python scripts/fetch_headshots.py
    python scripts/fetch_headshots.py --statpad public/statpad_data.json
    python scripts/fetch_headshots.py --delay 4   # slower, safer rate limit
    python scripts/fetch_headshots.py --player "Jim Abbott"  # single player test
"""

import argparse
import csv
import json
import os
import sys
import time


def load_people(lahman_dir):
    """Build {'First Last': 'bbrefid01'} from People.csv."""
    path = os.path.join(lahman_dir, "People.csv")
    if not os.path.exists(path):
        print(f"ERROR: {path} not found. Pass --lahman <folder>")
        sys.exit(1)
    mapping = {}
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            first = (row.get("nameFirst") or "").strip()
            last  = (row.get("nameLast")  or "").strip()
            bbref = (row.get("bbrefID")   or "").strip()
            if first and last and bbref:
                mapping[f"{first} {last}"] = bbref
    return mapping


def scrape_headshot(session, bbref_id):
    """
    Fetch a player's Baseball Reference page and return their headshot URL,
    or None if no image is found.
    """
    first_letter = bbref_id[0]
    url = f"https://www.baseball-reference.com/players/{first_letter}/{bbref_id}.shtml"

    resp = session.get(url, timeout=15)
    if resp.status_code == 429:
        return "RATE_LIMITED", url
    if resp.status_code != 200:
        return None, url

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(resp.text, "html.parser")

    # Try 'media-item multiple' first (players with multiple photos),
    # then fall back to any 'media-item' div (single photo pages).
    media_div = (
        soup.find("div", class_="media-item multiple") or
        soup.find("div", class_="media-item")
    )
    if media_div:
        img = media_div.find("img")
        if img and img.get("src"):
            return img["src"], url

    return None, url


def main():
    parser = argparse.ArgumentParser(
        description="Fetch player headshots from Baseball Reference"
    )
    parser.add_argument("--statpad", default="public/statpad_data.json",
                        help="Path to statpad_data.json (default: public/statpad_data.json)")
    parser.add_argument("--lahman",  default="public/lahman-folder",
                        help="Folder containing People.csv (default: public/lahman-folder)")
    parser.add_argument("--output",  default="public/headshots.json",
                        help="Output JSON file (default: public/headshots.json)")
    parser.add_argument("--delay",   type=float, default=3.0,
                        help="Seconds between requests (default: 3.0)")
    parser.add_argument("--player",  default=None,
                        help="Fetch a single player by name and exit (for testing)")
    args = parser.parse_args()

    try:
        import requests
        from bs4 import BeautifulSoup  # noqa: F401 — just verify it's installed
    except ImportError:
        print("ERROR: pip install requests beautifulsoup4")
        sys.exit(1)

    # ── Build name → bbrefID from People.csv ─────────────────────────────────
    print("Loading People.csv...")
    name_to_bbref = load_people(args.lahman)
    print(f"  {len(name_to_bbref):,} name→bbrefID entries loaded")

    # ── Single-player test mode ───────────────────────────────────────────────
    if args.player:
        bbref_id = name_to_bbref.get(args.player)
        if not bbref_id:
            print(f"No bbrefID found for {args.player!r}")
            sys.exit(1)
        import requests as req
        session = req.Session()
        session.headers["User-Agent"] = (
            "Mozilla/5.0 (compatible; StatPad headshot fetcher; educational use)"
        )
        img_url, page_url = scrape_headshot(session, bbref_id)
        print(f"Player  : {args.player}")
        print(f"bbrefID : {bbref_id}")
        print(f"Page    : {page_url}")
        print(f"Headshot: {img_url}")
        return

    # ── Load existing cache (supports resume) ────────────────────────────────
    cache = {}
    if os.path.exists(args.output):
        with open(args.output, encoding="utf-8") as f:
            cache = json.load(f)
        print(f"Loaded {len(cache):,} cached entries from {args.output}")

    # ── Get unique player names from statpad_data.json ────────────────────────
    if not os.path.exists(args.statpad):
        print(f"ERROR: {args.statpad} not found. Run generate_from_lahman.py first.")
        sys.exit(1)
    with open(args.statpad, encoding="utf-8") as f:
        statpad = json.load(f)
    all_names = sorted({r["name"] for r in statpad})
    todo = [n for n in all_names if n not in cache]

    print(f"Players in statpad : {len(all_names):,}")
    print(f"Already cached     : {len(all_names) - len(todo):,}")
    print(f"To fetch           : {len(todo):,}")

    if not todo:
        found = sum(1 for v in cache.values() if v)
        print(f"\nAll players cached — {found:,} with images, "
              f"{len(cache) - found:,} without.")
        return

    # ── Scrape ────────────────────────────────────────────────────────────────
    import requests as req
    session = req.Session()
    session.headers["User-Agent"] = (
        "Mozilla/5.0 (compatible; StatPad headshot fetcher; educational use)"
    )

    fetched = 0
    no_image = 0
    no_id = 0

    for i, name in enumerate(todo, 1):
        bbref_id = name_to_bbref.get(name)
        if not bbref_id:
            print(f"[{i:4}/{len(todo)}] {name!r} — no bbrefID, skipping")
            cache[name] = None
            no_id += 1
            _save(cache, args.output)
            continue

        print(f"[{i:4}/{len(todo)}] {name} ({bbref_id}) ...", end=" ", flush=True)

        try:
            result, page_url = scrape_headshot(session, bbref_id)
        except req.RequestException as e:
            print(f"network error: {e} — will retry next run")
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
            cache[name] = None
            no_image += 1
            print("no image")

        _save(cache, args.output)
        time.sleep(args.delay)

    # ── Summary ───────────────────────────────────────────────────────────────
    found = sum(1 for v in cache.values() if v)
    print(f"\n{'='*50}")
    print(f"Fetched    : {fetched:,} new headshots")
    print(f"No image   : {no_image:,}")
    print(f"No bbrefID : {no_id:,}")
    print(f"Total with images: {found:,} / {len(cache):,}")
    print(f"Output: {args.output}")


def _save(cache, path):
    """Write cache to disk immediately so progress is never lost."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
