// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Daily Challenge Generator
// Date-seeded: all players get the same puzzle each day.
// Target generated via validated non-trivial algorithm with ghost path.
// ─────────────────────────────────────────────────────────────────────────────

// @ts-ignore - seedrandom has no bundled types but @types/seedrandom is installed
import seedrandom from 'seedrandom';
import type { PlayerSeason, DailyChallenge, ChallengeConfig, Restriction, StatKey, GhostStep } from '../types/game';
import { getStatValue, getDartLimit, getStatDensity } from './gameEngine';

// Epoch: day 1 of Deadeye challenges
const EPOCH_DATE = '2026-03-01';

// DEV: force a specific challenge for testing. Set to null for production seeding.
export const DEV_OVERRIDE: ChallengeConfig | null = { seasonStart: 2010, seasonEnd: 2025, statKey: 'K', statLabel: 'Strikeouts (Pitching)' };

// Curated list of interesting year/stat combinations spanning different eras.
// W (Wins) removed from rotation per planning doc.
export const CHALLENGE_CONFIGS: ChallengeConfig[] = [
  // Recent seasons
  { season: 2025, statKey: 'HR',  statLabel: 'Home Runs' },
  { season: 2025, statKey: 'SB',  statLabel: 'Stolen Bases' },
  { season: 2025, statKey: 'RBI', statLabel: 'RBI' },
  { season: 2025, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' },
  { season: 2024, statKey: 'HR',  statLabel: 'Home Runs' },
  { season: 2024, statKey: 'SB',  statLabel: 'Stolen Bases' },
  { season: 2024, statKey: 'RBI', statLabel: 'RBI' },
  { season: 2024, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' },
  { season: 2023, statKey: 'HR',  statLabel: 'Home Runs' },
  { season: 2023, statKey: 'SB',  statLabel: 'Stolen Bases' },
  { season: 2022, statKey: 'HR',  statLabel: 'Home Runs' },
  // Home Run eras
  { season: 1998, statKey: 'HR',  statLabel: 'Home Runs' },
  { season: 2001, statKey: 'HR',  statLabel: 'Home Runs' },
  { season: 1961, statKey: 'HR',  statLabel: 'Home Runs' },
  { season: 1927, statKey: 'HR',  statLabel: 'Home Runs' },
  { season: 2019, statKey: 'HR',  statLabel: 'Home Runs' },
  { season: 1956, statKey: 'HR',  statLabel: 'Home Runs' },
  { season: 2017, statKey: 'HR',  statLabel: 'Home Runs' },
  // Stolen Base eras
  { season: 1985, statKey: 'SB',  statLabel: 'Stolen Bases' },
  { season: 1980, statKey: 'SB',  statLabel: 'Stolen Bases' },
  { season: 1962, statKey: 'SB',  statLabel: 'Stolen Bases' },
  { season: 2023, statKey: 'SB',  statLabel: 'Stolen Bases' },
  // Hits
  { season: 1980, statKey: 'H',   statLabel: 'Hits' },
  { season: 2004, statKey: 'H',   statLabel: 'Hits' },
  { season: 1930, statKey: 'H',   statLabel: 'Hits' },
  // RBI
  { season: 1930, statKey: 'RBI', statLabel: 'RBI' },
  { season: 1998, statKey: 'RBI', statLabel: 'RBI' },
  { season: 2006, statKey: 'RBI', statLabel: 'RBI' },
  // Runs
  { season: 1936, statKey: 'R',   statLabel: 'Runs' },
  { season: 1999, statKey: 'R',   statLabel: 'Runs' },
  // Walks
  { season: 2002, statKey: 'BB',  statLabel: 'Walks' },
  { season: 1996, statKey: 'BB',  statLabel: 'Walks' },
  // Extra Base Hits
  { season: 2000, statKey: 'XBH', statLabel: 'Extra Base Hits' },
  { season: 1930, statKey: 'XBH', statLabel: 'Extra Base Hits' },
  // Pitching — Strikeouts
  { season: 2002, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' },
  { season: 1965, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' },
  { season: 1973, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' },
  { season: 2014, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' },
  // Saves
  { season: 2008, statKey: 'SV',  statLabel: 'Saves' },
  { season: 1990, statKey: 'SV',  statLabel: 'Saves' },
  // Threshold categories — broad year range, pool filtered to threshold
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'AVG', statLabel: 'Batting Average (\u00d71000)', threshold: 300 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'OPS', statLabel: 'OPS (\u00d71000)', threshold: 1000 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'OBP', statLabel: 'On-Base % (\u00d71000)', threshold: 400 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'HR', statLabel: '40+ HR Seasons', threshold: 40 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'RBI', statLabel: '100+ RBI Seasons', threshold: 100 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'H', statLabel: '200+ Hit Seasons', threshold: 200 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'SB', statLabel: '50+ SB Seasons', threshold: 50 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'SV', statLabel: '40+ Save Seasons', threshold: 40 },
];

// Restriction rotation: every 5th challenge gets a restriction (if solvable)
const RESTRICTION_ROTATION: Array<Omit<Restriction, 'label'> | null> = [
  null, null, null, null,
  { type: 'allstar' },        // every 5th
  null, null, null, null,
  { type: 'hof' },            // every 10th
];

const RESTRICTION_LABELS: Record<string, string> = {
  allstar: 'All-Star seasons only',
  hof: 'Hall of Famers only',
  ws_winner: 'World Series champions only',
  award: 'Award winners only',
};

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

function filterByStat(players: PlayerSeason[], statKey: StatKey, season: number): PlayerSeason[] {
  return players.filter(p => p.yearID === season && getStatValue(p, statKey) > 0);
}

function filterByRestriction(players: PlayerSeason[], restriction: Restriction): PlayerSeason[] {
  switch (restriction.type) {
    case 'hof':      return players.filter(p => p.isHOF);
    case 'allstar':  return players.filter(p => p.isAllStar);
    case 'ws_winner': return players.filter(p => p.wonWorldSeries);
    case 'award':    return players.filter(p => restriction.value && p.awards.includes(restriction.value));
    default:         return players;
  }
}

// ── Deduplicate pool by playerID, keeping best stat value per player ──────────
interface DeduplicatedPlayer {
  playerID: string;
  season: PlayerSeason;
  statValue: number;
}

function deduplicatePool(pool: PlayerSeason[], statKey: StatKey): DeduplicatedPlayer[] {
  const map = new Map<string, DeduplicatedPlayer>();
  for (const s of pool) {
    const val = getStatValue(s, statKey);
    const existing = map.get(s.playerID);
    if (!existing || val > existing.statValue) {
      map.set(s.playerID, { playerID: s.playerID, season: s, statValue: val });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.statValue - a.statValue);
}

// ── Target generation: validated non-trivial target ───────────────────────────

/**
 * Check if a target can be reached using distinct players from the pool
 * within a given dart limit. Returns the number of distinct paths found
 * (stops counting after finding `needed` paths).
 */
function countPaths(
  target: number,
  candidates: DeduplicatedPlayer[],
  dartLimit: number,
  needed: number,
): number {
  let pathsFound = 0;

  // DFS with pruning: try to find `needed` distinct combinations summing to target
  function dfs(remaining: number, startIdx: number, depth: number) {
    if (pathsFound >= needed) return;
    if (remaining === 0) { pathsFound++; return; }
    if (depth >= dartLimit) return;
    if (remaining < 0) return;

    for (let i = startIdx; i < candidates.length && pathsFound < needed; i++) {
      const val = candidates[i].statValue;
      if (val > remaining) continue; // skip if too big
      // Pruning: if the largest remaining candidate is too small to
      // reach the remaining target within the dart limit, skip
      if (val * (dartLimit - depth) < remaining) break; // sorted desc, so all following are smaller
      dfs(remaining - val, i + 1, depth + 1);
    }
  }

  dfs(target, 0, 0);
  return pathsFound;
}

/**
 * Generate a validated target by combining 3-4 candidates from the top 20.
 * The target must:
 * 1. Not be achievable with a single dart
 * 2. Have at least 2 distinct multi-dart solution paths
 */
function generateTarget(
  pool: PlayerSeason[],
  statKey: StatKey,
  rng: () => number,
  dartLimit: number,
): { target: number; ghostPath: GhostStep[] } {
  const deduped = deduplicatePool(pool, statKey);
  const topCandidates = deduped.slice(0, Math.min(20, deduped.length));
  const allStatValues = new Set(deduped.map(d => d.statValue));

  // Try up to 50 random combinations of 3-4 candidates
  for (let attempt = 0; attempt < 50; attempt++) {
    // Pick 3 or 4 candidates randomly from top 20
    const pickCount = rng() < 0.5 ? 3 : 4;
    const indices = new Set<number>();
    while (indices.size < pickCount && indices.size < topCandidates.length) {
      indices.add(Math.floor(rng() * topCandidates.length));
    }
    if (indices.size < pickCount) continue;

    const picked = Array.from(indices).map(i => topCandidates[i]);
    const target = picked.reduce((sum, p) => sum + p.statValue, 0);

    // Rule 1: no single dart should equal the target
    if (allStatValues.has(target)) continue;

    // Rule 2: at least 2 distinct paths must exist within dart limit
    const paths = countPaths(target, deduped, dartLimit, 2);
    if (paths < 2) continue;

    // Valid target found! Compute ghost path (greedy best-fit)
    const ghost = computeGhostPath(target, deduped, dartLimit);
    return { target, ghostPath: ghost };
  }

  // Fallback: modified top-5 sum scaled by 0.7-0.9
  const top5sum = topCandidates.slice(0, 5).reduce((sum, p) => sum + p.statValue, 0);
  const scale = 0.7 + rng() * 0.2; // 0.7 to 0.9
  let fallbackTarget = Math.round(top5sum * scale);

  // Ensure fallback target is not achievable by a single dart
  while (allStatValues.has(fallbackTarget)) {
    fallbackTarget++;
  }

  const ghost = computeGhostPath(fallbackTarget, deduped, dartLimit);
  return { target: fallbackTarget, ghostPath: ghost };
}

/**
 * Greedy best-fit ghost path: pick the largest unused player that doesn't
 * overshoot the remaining target, until remainder is 0 or we run out of
 * candidates/darts.
 */
function computeGhostPath(
  target: number,
  candidates: DeduplicatedPlayer[],
  dartLimit: number,
): GhostStep[] {
  const path: GhostStep[] = [];
  let remaining = target;
  const usedPlayers = new Set<string>();

  for (let dart = 0; dart < dartLimit && remaining > 0; dart++) {
    // Find the best-fit: largest stat that doesn't overshoot
    let bestFit: DeduplicatedPlayer | null = null;
    for (const c of candidates) {
      if (usedPlayers.has(c.playerID)) continue;
      if (c.statValue <= remaining) {
        bestFit = c;
        break; // candidates sorted desc, so first fit is best
      }
    }
    if (!bestFit) break;

    path.push({
      name: bestFit.season.name,
      yearID: bestFit.season.yearID,
      teamID: bestFit.season.teamID,
      statValue: bestFit.statValue,
    });
    remaining -= bestFit.statValue;
    usedPlayers.add(bestFit.playerID);
  }

  return path;
}

export function getDailyChallenge(allPlayers: PlayerSeason[]): DailyChallenge {
  const today = new Date().toISOString().split('T')[0];
  const challengeNumber = Math.max(1, daysBetween(EPOCH_DATE, today));

  // DEV: use override config if set
  const config: ChallengeConfig = DEV_OVERRIDE ?? (() => {
    const rng = seedrandom(today);
    return CHALLENGE_CONFIGS[Math.floor(rng() * CHALLENGE_CONFIGS.length)];
  })();

  // Filter players for this season/stat (single year or range)
  const isRange = config.seasonStart !== undefined;
  const minStatValue = config.threshold ?? 1; // threshold or just > 0
  const pool = isRange
    ? allPlayers.filter(p =>
        p.yearID >= config.seasonStart! &&
        p.yearID <= (config.seasonEnd ?? config.seasonStart!) &&
        getStatValue(p, config.statKey) >= minStatValue
      )
    : filterByStat(allPlayers, config.statKey, config.season!);

  // Restrictions only apply to single-year challenges
  const rotationIndex = challengeNumber % RESTRICTION_ROTATION.length;
  const rawRestriction = isRange ? null : RESTRICTION_ROTATION[rotationIndex];
  let restriction: Restriction | undefined;

  if (rawRestriction) {
    const restricted = filterByRestriction(pool, {
      ...rawRestriction,
      label: RESTRICTION_LABELS[rawRestriction.type],
    });
    if (restricted.length >= 5) {
      restriction = { ...rawRestriction, label: RESTRICTION_LABELS[rawRestriction.type] };
    }
  }

  const finalPool = restriction ? filterByRestriction(pool, restriction) : pool;

  // Use deterministic RNG seeded with the date for target generation
  const rng = seedrandom(today + '-target');
  const density = getStatDensity(config.statKey);
  const dartLimit = getDartLimit('normal', density); // Use Normal dart limit for validation
  const { target, ghostPath } = generateTarget(finalPool, config.statKey, rng, dartLimit);

  const seasonDisplay = isRange
    ? `${config.seasonStart}–${config.seasonEnd}`
    : String(config.season);

  let desc: string;
  if (config.threshold && isRange) {
    // Threshold categories get a special description format
    const thresholdLabel = config.statKey === 'AVG' ? `.${config.threshold}+`
      : config.statKey === 'OBP' ? `.${config.threshold}+`
      : config.statKey === 'OPS' ? `${(config.threshold / 1000).toFixed(3)}+`
      : `${config.threshold}+`;
    desc = `${seasonDisplay} MLB · ${thresholdLabel} ${config.statLabel}`;
  } else if (restriction) {
    desc = `${seasonDisplay} MLB · ${config.statLabel} (${restriction.label})`;
  } else {
    desc = `${seasonDisplay} MLB · ${config.statLabel}`;
  }

  const displaySeason = config.season ?? config.seasonEnd ?? config.seasonStart ?? 2025;

  return {
    challengeNumber,
    date: today,
    sport: 'MLB',
    season: displaySeason,
    seasonStart: config.seasonStart,
    seasonEnd: config.seasonEnd,
    statKey: config.statKey,
    statLabel: config.statLabel,
    targetScore: target,
    restriction,
    description: desc,
    ghostPath,
  };
}

// For testing/preview: get challenge for a specific date
export function getChallengeForDate(allPlayers: PlayerSeason[], dateStr: string): DailyChallenge {
  const challengeNumber = Math.max(1, daysBetween(EPOCH_DATE, dateStr));
  const rng = seedrandom(dateStr);
  const configIndex = Math.floor(rng() * CHALLENGE_CONFIGS.length);
  const config = CHALLENGE_CONFIGS[configIndex];
  const season = config.season ?? config.seasonEnd ?? config.seasonStart ?? 2025;
  const isRange = config.seasonStart !== undefined;
  const minStatValue = config.threshold ?? 1;
  const pool = isRange
    ? allPlayers.filter(p => p.yearID >= config.seasonStart! && p.yearID <= (config.seasonEnd ?? config.seasonStart!) && getStatValue(p, config.statKey) >= minStatValue)
    : filterByStat(allPlayers, config.statKey, season);

  const targetRng = seedrandom(dateStr + '-target');
  const density = getStatDensity(config.statKey);
  const dartLimit = getDartLimit('normal', density);
  const { target, ghostPath } = generateTarget(pool, config.statKey, targetRng, dartLimit);

  const seasonDisplay = isRange
    ? `${config.seasonStart}–${config.seasonEnd}`
    : String(season);

  let desc: string;
  if (config.threshold && isRange) {
    const thresholdLabel = config.statKey === 'AVG' ? `.${config.threshold}+`
      : config.statKey === 'OBP' ? `.${config.threshold}+`
      : config.statKey === 'OPS' ? `${(config.threshold / 1000).toFixed(3)}+`
      : `${config.threshold}+`;
    desc = `${seasonDisplay} MLB · ${thresholdLabel} ${config.statLabel}`;
  } else {
    desc = `${seasonDisplay} MLB · ${config.statLabel}`;
  }

  return {
    challengeNumber,
    date: dateStr,
    sport: 'MLB',
    season,
    seasonStart: config.seasonStart,
    seasonEnd: config.seasonEnd,
    statKey: config.statKey,
    statLabel: config.statLabel,
    targetScore: target,
    description: desc,
    ghostPath,
  };
}
