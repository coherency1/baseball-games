# Deadeye

Daily baseball darts. Given a target score and stat category, guess MLB player seasons to count down to exactly zero.

**Live at:** [coherency.lol/baseball/deadeye](https://coherency.lol/baseball/deadeye/)

Part of the [baseball-games](../../README.md) monorepo.

**Built with**: React 19 + Vite + TypeScript + Tailwind CSS
**Data**: [Lahman Baseball Database](http://www.seanlahman.com/baseball-archive/statistics/)

---

## Gameplay

Each day a new challenge is revealed:

> **1998 MLB · Home Runs — Target: 290**

You search for player seasons from that year. Each dart you throw subtracts that player's stat from your running total. Goal: reach exactly 0 (or as close as possible).

- **Bullseye 🎯** — exact 0
- **Bust 💥** — went negative (Hard mode only: game over)
- **Stand** — lock in your score at any time

### Dart quality
| Emoji | Meaning |
|-------|---------|
| 🎯 | Bullseye — exactly 0 remaining |
| 🟢 | Great — reduced score by >50% |
| 🟡 | Good — reduced score by 25–50% |
| 🔴 | Small — reduced by <25% |

### Game modes
- **Easy**: Going negative is allowed; distance from 0 is your final score
- **Hard**: Going negative = bust, game over

---

## Getting Started

### Prerequisites
- Node.js 18+
- [Lahman Baseball Database CSVs](http://www.seanlahman.com/baseball-archive/statistics/) in `~/Downloads/lahman-folder/`

### Setup

```bash
npm install

# Generate player data from Lahman CSVs (run once, or after updating CSVs)
npm run build:data

# Start dev server
npm run dev
```

If your Lahman folder is in a different location:
```bash
LAHMAN_DIR=/path/to/lahman-folder npm run build:data
```

### Build for production
```bash
npm run build
npm run preview
```

---

## Project Structure

```
src/
├── components/
│   ├── GameBoard.tsx      # Main game orchestrator
│   ├── Header.tsx         # Title + challenge info + mode toggle
│   ├── ScoreDisplay.tsx   # Large countdown score + progress bar
│   ├── DartRow.tsx        # Individual guess row (color-coded)
│   ├── PlayerSearch.tsx   # Two-step: name autocomplete → season picker
│   └── ShareModal.tsx     # Results sharing
├── lib/
│   ├── gameEngine.ts      # Scoring, bust detection, dart quality
│   ├── dailyChallenge.ts  # Date-seeded challenge generation
│   ├── playerSearch.ts    # Fuse.js fuzzy search
│   └── shareText.ts       # Emoji share string generator
├── data/
│   └── teams.ts           # MLB team metadata + Lahman team mapping
└── types/
    └── game.ts            # TypeScript interfaces

scripts/
└── build-data.ts          # Lahman CSVs → public/data/players.json

public/
└── data/
    └── players.json       # Pre-compiled player data (committed to git)
```

---

## Daily Challenges

Challenges are seeded by the current date using `seedrandom` — everyone gets the same puzzle each day. The target is the sum of the top 5 player-seasons for that year/stat combination.

**Stat categories**: HR, RBI, H, SB, BB, R, XBH (batting) · W, SV, K (pitching)

**Restrictions** (rotate every few days):
- All-Star seasons only
- Hall of Famers only

---

## Roadmap

- [ ] NBA support (Phase 2 — via BALLDONTLIE API with server-side cache)
- [ ] Global leaderboard (Supabase)
- [ ] Streak tracking
- [ ] Literal dartboard UI variant
- [ ] Historical challenge archive
