# StatPad

Baseball trivia puzzle. Pick player-seasons that match category filters to maximize your score across 5 rows.

**Live at:** [coherency.lol/baseball/statpad](https://coherency.lol/baseball/statpad/)

Part of the [baseball-games](../../README.md) monorepo.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Data

The app loads player data from `public/statpad_data.json`. The included dataset has ~7,000 player-seasons (2008-2025) across 24 MLB teams.

### Get Full 30-Team Data

The included dataset is missing NYY, NYM, CHC, CHW, LAD, LAA due to Baseball Reference's ambiguous city names. To get all 30 teams:

```bash
pip install pybaseball pandas lxml
python scripts/generate_data_v5.py --start 2008 --end 2025
cp statpad_data.json public/statpad_data.json
```

This pulls per-team data from Baseball Reference (~4 minutes, 30 requests with rate limiting).

## Project Structure

```
src/
  App.jsx      - Main game component, data loading, UI
  engine.js    - Puzzle generation, validation, scoring, percentiles
  teams.js     - MLB team metadata, ESPN logo URLs, divisions
  main.jsx     - React entry point
public/
  statpad_data.json  - Player season data (swap to update)
scripts/
  generate_data_v5.py - Data generator (per-team BREF scraper)
```

## How the Puzzle Works

- 5 rows per game, each with 3 category columns:
  - Column 1: Team, Division, League, or All MLB
  - Column 2: Year range or exact year
  - Column 3: Position, batting hand, or stat threshold
- Anti-double-jeopardy: no overlapping categories between rows
- Scoring stat randomly selected (HR, RBI, Hits, Runs, SB, etc.)
- Percentile tiers: Bronze (50-70), Silver (70-90), Gold (90-95), Platinum (95-100)

## Swapping Data

Replace `public/statpad_data.json` with any JSON array of objects matching this schema:

```json
{
  "name": "Aaron Judge",
  "team": "NYY",
  "year": 2022,
  "pos": "OF",
  "bats": "R",
  "HR": 62, "RBI": 131, "R": 133, "H": 177,
  "SB": 16, "BB": 111, "SO": 175,
  "2B": 28, "3B": 0, "PA": 696, "AB": 570,
  "AVG": 0.311, "OBP": 0.425, "SLG": 0.686, "OPS": 1.111,
  "wRC+": 211, "WAR": 11.4
}
```

Team abbreviations must match the keys in `src/teams.js`.
