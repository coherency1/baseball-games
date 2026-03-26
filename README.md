# Baseball Games

Monorepo for all Coherency baseball games. Each game lives in `games/` with its own stack and dependencies. One GitHub Pages deploy serves everything.

**Live at:** [coherency.lol/baseball](https://coherency.lol/baseball/)

## Games

| Game | Description | Stack | Status |
|------|------------|-------|--------|
| [StatPad](games/statpad/) | Baseball trivia puzzle — pick player-seasons matching category filters | React 18, Vite, JS | Live |
| [Deadeye](games/deadeye/) | Daily baseball darts — guess MLB player seasons to count down to zero | React 19, Vite, TS, Tailwind | Live |

## Development

```bash
# Run a specific game
npm run dev:statpad
npm run dev:deadeye

# Build all games
npm run build

# Build one game
npm run build:statpad
npm run build:deadeye
```

Each game runs on its own Vite dev server. Builds output to `dist/[game-name]/`.

## Adding a New Game

1. Create `games/[name]/` with its own `package.json`, `vite.config`, and source
2. Set vite config: `base: '/baseball/[name]/'` and `build.outDir: '../../dist/[name]'`
3. Add build scripts to root `package.json`
4. Add build step to `.github/workflows/deploy.yml`
5. Add Vercel rewrite in the [website repo](https://github.com/coherency1/website):
   ```json
   { "source": "/baseball/[name]/:path*", "destination": "https://coherency1.github.io/baseball-games/[name]/:path*" }
   ```

## Deploy

Push to `main` → GitHub Actions builds all games → deploys combined `dist/` to GitHub Pages → Vercel rewrites serve each game at `coherency.lol/baseball/[name]/`.

## Architecture

```
coherency.lol/baseball/           → Baseball Hub (hosted in website repo)
coherency.lol/baseball/statpad/   → Vercel rewrite → GH Pages → dist/statpad/
coherency.lol/baseball/deadeye/   → Vercel rewrite → GH Pages → dist/deadeye/
```
