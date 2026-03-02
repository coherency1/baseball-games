// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Daily Challenge Generator
// Date-seeded: all players get the same puzzle each day.
// Target generated via validated non-trivial algorithm with ghost path.
// ─────────────────────────────────────────────────────────────────────────────

// @ts-ignore - seedrandom has no bundled types but @types/seedrandom is installed
import seedrandom from 'seedrandom';
import type { PlayerSeason, DailyChallenge, ChallengeConfig, Restriction, StatKey, GhostStep } from '../types/game';
import { getStatValue, getDartLimit, getStatDensity } from './gameEngine';
import { MLB_TEAMS } from '../data/teams';

// Epoch: day 1 of Deadeye challenges
const EPOCH_DATE = '2026-03-01';

// DEV: force a specific challenge for testing. Set to null for production seeding.
export const DEV_OVERRIDE: ChallengeConfig | null = null;

// ── 30 Curated Challenge Configs ─────────────────────────────────────────────
// Mix of iconic single years, era ranges, and threshold ranges.
// Stat balance: HR 20%, SB 20%, K 17%, RBI 10%, H/SV/BB/TB/R each 7%
export const CHALLENGE_CONFIGS: ChallengeConfig[] = [
  // ── Iconic Single Years (8) ──────────────────────────────────────────────
  { season: 1998, statKey: 'HR',  statLabel: 'Home Runs' },          // McGwire/Sosa HR chase
  { season: 2001, statKey: 'HR',  statLabel: 'Home Runs' },          // Bonds 73
  { season: 1961, statKey: 'HR',  statLabel: 'Home Runs' },          // Maris vs Mantle
  { season: 1985, statKey: 'SB',  statLabel: 'Stolen Bases' },       // Henderson/Coleman
  { season: 2023, statKey: 'SB',  statLabel: 'Stolen Bases' },       // New SB rules explosion
  { season: 2004, statKey: 'H',   statLabel: 'Hits' },               // Ichiro 262 hits
  { season: 1968, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' }, // Year of the Pitcher
  { season: 1930, statKey: 'RBI', statLabel: 'RBI' },                // Hack Wilson 191 RBI

  // ── Era Ranges (13) ──────────────────────────────────────────────────────
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'HR',  statLabel: 'Home Runs' },          // Modern Mashers
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases' },       // Modern Speed
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' }, // Modern Strikeout Era
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'RBI', statLabel: 'RBI' },                // Modern Run Production
  { seasonStart: 2010, seasonEnd: 2019, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' }, // Strikeout Surge
  { seasonStart: 2010, seasonEnd: 2019, statKey: 'SV',  statLabel: 'Saves' },              // Modern Closers
  { seasonStart: 2000, seasonEnd: 2009, statKey: 'SB',  statLabel: 'Stolen Bases' },       // 2000s Speed
  { seasonStart: 1980, seasonEnd: 1999, statKey: 'SB',  statLabel: 'Stolen Bases' },       // 80s-90s Baserunning
  { seasonStart: 1960, seasonEnd: 1980, statKey: 'K',   statLabel: 'Strikeouts (Pitching)' }, // Classic Power Pitching
  { seasonStart: 2000, seasonEnd: 2025, statKey: 'BB',  statLabel: 'Walks' },              // Moneyball Walks
  { seasonStart: 2010, seasonEnd: 2025, statKey: 'TB',  statLabel: 'Total Bases' },        // Total Base Leaders
  { seasonStart: 1990, seasonEnd: 2009, statKey: 'R',   statLabel: 'Runs' },               // Offensive Explosion Era
  { seasonStart: 1950, seasonEnd: 1979, statKey: 'HR',  statLabel: 'Home Runs' },          // Classic Era Power

  // ── Threshold Ranges (9) ─────────────────────────────────────────────────
  // statLabel = clean stat name (used in search prompt); description builder adds threshold prefix
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'HR',  statLabel: 'Home Runs',              threshold: 40 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'RBI', statLabel: 'RBI',                    threshold: 100 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'H',   statLabel: 'Hits',                   threshold: 200 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases',           threshold: 50 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'SV',  statLabel: 'Saves',                  threshold: 40 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'K',   statLabel: 'Strikeouts (Pitching)',   threshold: 200 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'BB',  statLabel: 'Walks',                  threshold: 100 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'TB',  statLabel: 'Total Bases',            threshold: 300 },
  { seasonStart: 1950, seasonEnd: 2025, statKey: 'R',   statLabel: 'Runs',                   threshold: 100 },
];

// ── Restriction rotation ─────────────────────────────────────────────────────
// Periodic restrictions across challenges. Applied to ALL config types.
// Validated with gate checks: must have ≥15 deduped players and produce a
// solvable target — otherwise restriction is silently dropped.
const RESTRICTION_ROTATION: Array<Omit<Restriction, 'label'> | null> = [
  null, null, null, null,
  { type: 'allstar' },
  null, null, null, null,
  { type: 'hof' },
  null, null, null, null,
  { type: 'rookie' },
  null, null, null, null,
  { type: 'mvp' },
  null, null,
  { type: 'league', value: 'AL' },
  null, null,
  { type: 'league', value: 'NL' },
  null, null,
  { type: 'gold_glove' },
  null, null,
  { type: 'ws_winner' },
  null, null,
  { type: 'cy_young' },
  null, null,
  { type: 'silver_slugger' },
  null, null,
  { type: 'division', value: 'AL East' },
  null, null,
  { type: 'division', value: 'NL West' },
];

const RESTRICTION_LABELS: Record<string, string> = {
  allstar: 'All-Star seasons only',
  hof: 'Hall of Famers only',
  ws_winner: 'World Series champions only',
  award: 'Award winners only',
  rookie: 'Rookie seasons only',
  league: '',   // dynamic, uses restriction.value
  division: '', // dynamic, uses restriction.value
  mvp: 'MVP winners only',
  cy_young: 'Cy Young winners only',
  silver_slugger: 'Silver Slugger winners only',
  gold_glove: 'Gold Glove winners only',
};

// Minimum deduped players required for a restriction to be applied
const MIN_RESTRICTED_POOL = 15;

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

function filterByStat(players: PlayerSeason[], statKey: StatKey, season: number): PlayerSeason[] {
  return players.filter(p => p.yearID === season && getStatValue(p, statKey) > 0);
}

function filterByRestriction(players: PlayerSeason[], restriction: Restriction): PlayerSeason[] {
  switch (restriction.type) {
    case 'hof':           return players.filter(p => p.isHOF);
    case 'allstar':       return players.filter(p => p.isAllStar);
    case 'ws_winner':     return players.filter(p => p.wonWorldSeries);
    case 'award':         return players.filter(p => restriction.value && p.awards.includes(restriction.value));
    case 'rookie':        return players.filter(p => p.isRookie);
    case 'league': {
      return players.filter(p => {
        const primaryTeam = p.teamID.split('/')[0];
        const info = MLB_TEAMS[primaryTeam];
        return info?.league === restriction.value;
      });
    }
    case 'division': {
      return players.filter(p => {
        const primaryTeam = p.teamID.split('/')[0];
        const info = MLB_TEAMS[primaryTeam];
        return info?.division === restriction.value;
      });
    }
    case 'mvp':           return players.filter(p => p.awards.includes('Most Valuable Player'));
    case 'cy_young':      return players.filter(p => p.awards.includes('Cy Young Award'));
    case 'silver_slugger': return players.filter(p => p.awards.includes('Silver Slugger'));
    case 'gold_glove':    return players.filter(p => p.awards.includes('Gold Glove'));
    default:              return players;
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

// ── DP-based target generation + short ghost paths ──────────────────────────
//
// Uses minimum-cardinality subset sum (0/1 knapsack variant) on the FULL
// candidate pool to find the shortest possible ghost path.
//
// Algorithm:
// 1. DP on all deduped candidates → TRUE minimum darts for every reachable sum
// 2. Target selection prefers short ghost K (idealGhostK = max(3, hardLimit-2))
// 3. DFS with DP-guided pruning → near-instant path reconstruction
//
// Key design:
// - idealGhostK: Sparse(HR)=3, Standard(RBI/K/SB)=4, Dense(H/TB)=5
// - 3★ = match ghost path (3-5 darts), a real achievement
// - Hard mode uses its dart limit (5-7) — generous compared to ghost
// - Normal mode gives 2-3 extra darts beyond hard

/**
 * DP minimum-cardinality subset sum.
 * For each reachable sum s ∈ [0, maxSum], computes:
 *   dp[s]    = minimum number of elements to reach s (0/1 knapsack)
 *   count[s] = number of distinct min-cardinality subsets reaching s
 *
 * O(n × maxSum) time, O(maxSum) space.
 */
function dpMinSubsetSum(
  values: number[],
  maxSum: number,
): { dp: Uint16Array; count: Float64Array } {
  const dp = new Uint16Array(maxSum + 1).fill(65535);
  const count = new Float64Array(maxSum + 1);
  dp[0] = 0;
  count[0] = 1;

  for (const v of values) {
    // Right to left: each element used at most once (0/1 knapsack)
    for (let s = maxSum; s >= v; s--) {
      const newK = dp[s - v] + 1;
      if (newK < dp[s]) {
        dp[s] = newK;
        count[s] = count[s - v];
      } else if (newK === dp[s] && newK < 65535) {
        count[s] = Math.min(count[s] + count[s - v], 1e9); // cap to avoid overflow
      }
    }
  }

  return { dp, count };
}

/**
 * DFS to find one actual path of exactly K elements summing to target.
 * Candidates must be sorted descending by statValue.
 *
 * DP-guided pruning: when the DP table is provided, each branch checks
 * whether the remaining sum is achievable with the remaining dart slots.
 * This eliminates dead branches early, making reconstruction near-instant
 * even with 200+ candidates. Pruning is optimistic (DP was built on the
 * full pool, not just unused elements) so correctness is preserved.
 */
function findPathOfK(
  candidates: DeduplicatedPlayer[],
  target: number,
  k: number,
  dp?: Uint16Array,
): DeduplicatedPlayer[] | null {
  const result: DeduplicatedPlayer[] = [];

  function dfs(remaining: number, startIdx: number, depth: number): boolean {
    if (remaining === 0 && depth === k) return true;
    if (depth >= k || remaining <= 0) return false;

    const dartsLeft = k - depth;
    for (let i = startIdx; i < candidates.length; i++) {
      const v = candidates[i].statValue;
      if (v > remaining) continue;
      // Pruning: if largest remaining can't fill the target in dartsLeft
      if (v * dartsLeft < remaining) break; // sorted desc
      // DP-guided pruning: skip if remaining-v needs more darts than we'll have
      const newRemaining = remaining - v;
      if (dp && newRemaining > 0 && newRemaining < dp.length && dp[newRemaining] > dartsLeft - 1) continue;
      result.push(candidates[i]);
      if (dfs(newRemaining, i + 1, depth + 1)) return true;
      result.pop();
    }
    return false;
  }

  dfs(target, 0, 0);
  return result.length === k ? result : null;
}

/**
 * Generate a target with a short ghost path using DP subset sum on the
 * FULL candidate pool.
 *
 * Algorithm:
 * 1. Dedup pool — use ALL candidates (not just top 50)
 * 2. Build DP: minimum elements + solution count for every reachable sum
 * 3. Compute idealGhostK = max(3, hardLimit - 2):
 *      Sparse (HR/SV): 3 darts
 *      Standard (RBI/SB/BB/K/R): 4 darts
 *      Dense (H/TB/W): 5 darts
 * 4. Select targets where dp[t] = idealGhostK with ≥ 2 solutions
 * 5. Reconstruct ghost via DFS + DP-guided pruning (near-instant)
 *
 * maxSum = sum of top normalDartLimit values (generous ceiling for
 * playable targets reachable within normal mode).
 */
function generateTarget(
  pool: PlayerSeason[],
  statKey: StatKey,
  rng: () => number,
  hardLimit: number,
  normalDartLimit: number,
): { target: number; ghostPath: GhostStep[] } {
  const deduped = deduplicatePool(pool, statKey);

  // Use full pool — DP is O(n×maxSum) and DP-guided DFS handles large pools
  const candidates = deduped;
  const values = candidates.map(d => d.statValue);

  // Ghost target: find naturally short paths
  const idealGhostK = Math.max(3, hardLimit - 2);

  // maxSum = sum of top normalDartLimit values (upper bound for playable targets)
  const topNValues = values.slice(0, Math.min(normalDartLimit, values.length));
  const maxSum = topNValues.reduce((a, b) => a + b, 0);

  if (maxSum === 0 || values.length < idealGhostK) {
    const fallback = values.slice(0, 3).reduce((a, b) => a + b, 0) || 100;
    return { target: fallback, ghostPath: [] };
  }

  // Build DP on full candidate pool
  const { dp, count } = dpMinSubsetSum(values, maxSum);

  // Target range: 25%-90% of maxSum for interesting gameplay
  const minTarget = Math.max(2, Math.round(maxSum * 0.25));
  const maxTarget = Math.round(maxSum * 0.90);
  const allStatValues = new Set(values);

  // Tier 1: idealGhostK with ≥ 2 distinct solutions
  let targetCandidates: number[] = [];
  for (let t = minTarget; t <= maxTarget; t++) {
    if (dp[t] === idealGhostK && count[t] >= 2 && !allStatValues.has(t)) {
      targetCandidates.push(t);
    }
  }

  // Tier 2: idealGhostK + 1 (slightly longer ghost — still good)
  if (targetCandidates.length < 5) {
    const altK = idealGhostK + 1;
    if (altK <= hardLimit) {
      for (let t = minTarget; t <= maxTarget; t++) {
        if (dp[t] === altK && count[t] >= 2 && !allStatValues.has(t)) {
          targetCandidates.push(t);
        }
      }
    }
  }

  // Tier 3: idealGhostK - 1 (even shorter — impressive!)
  if (targetCandidates.length < 5) {
    const altK = idealGhostK - 1;
    if (altK >= 2) {
      for (let t = minTarget; t <= maxTarget; t++) {
        if (dp[t] === altK && count[t] >= 2 && !allStatValues.has(t)) {
          targetCandidates.push(t);
        }
      }
    }
  }

  // Tier 4: any K from 2 to hardLimit
  if (targetCandidates.length === 0) {
    for (let t = minTarget; t <= maxTarget; t++) {
      if (dp[t] >= 2 && dp[t] <= hardLimit && count[t] >= 2 && !allStatValues.has(t)) {
        targetCandidates.push(t);
      }
    }
  }

  // Emergency: sum of top 3
  if (targetCandidates.length === 0) {
    const fallback = values.slice(0, 3).reduce((a, b) => a + b, 0);
    const path = findPathOfK(candidates, fallback, Math.min(3, candidates.length), dp);
    return {
      target: fallback,
      ghostPath: path ? path.map(toGhostStep) : [],
    };
  }

  // Pick target using seeded RNG
  const chosenTarget = targetCandidates[Math.floor(rng() * targetCandidates.length)];

  // Ghost path: find true minimum-cardinality path with DP-guided DFS
  const ghostK = dp[chosenTarget];
  let path = findPathOfK(candidates, chosenTarget, ghostK, dp);

  // Fallback: try ghostK + 1 if exact K path not found (extremely rare)
  if (!path && ghostK < normalDartLimit) {
    path = findPathOfK(candidates, chosenTarget, ghostK + 1, dp);
  }

  return {
    target: chosenTarget,
    ghostPath: path ? path.map(toGhostStep) : [],
  };
}

function toGhostStep(p: DeduplicatedPlayer): GhostStep {
  return {
    name: p.season.name,
    yearID: p.season.yearID,
    teamID: p.season.teamID,
    statValue: p.statValue,
  };
}

// ── Build player pool from config ────────────────────────────────────────────
function buildPool(allPlayers: PlayerSeason[], config: ChallengeConfig): PlayerSeason[] {
  const isRange = config.seasonStart !== undefined;
  const minStatValue = config.threshold ?? 1;
  return isRange
    ? allPlayers.filter(p =>
        p.yearID >= config.seasonStart! &&
        p.yearID <= (config.seasonEnd ?? config.seasonStart!) &&
        getStatValue(p, config.statKey) >= minStatValue
      )
    : filterByStat(allPlayers, config.statKey, config.season!);
}

// ── Restriction validation gate ──────────────────────────────────────────────
/**
 * Validates that a restriction produces a solvable challenge.
 * Gate checks:
 * 1. Restricted pool has ≥ MIN_RESTRICTED_POOL deduped players
 * 2. Target generation succeeds (not just fallback)
 * Returns the restriction if valid, undefined if it should be dropped.
 */
function validateRestriction(
  pool: PlayerSeason[],
  restriction: Restriction,
  statKey: StatKey,
  dartLimit: number,
  rng: () => number,
): { valid: boolean; restrictedPool: PlayerSeason[] } {
  const restrictedPool = filterByRestriction(pool, restriction);

  // Gate 1: enough deduped players
  const deduped = deduplicatePool(restrictedPool, statKey);
  if (deduped.length < MIN_RESTRICTED_POOL) {
    return { valid: false, restrictedPool };
  }

  // Gate 2: can we generate a validated target? (dry run)
  const testRng = seedrandom(rng().toString());
  const hardLimit = getDartLimit('hard', getStatDensity(statKey));
  const result = generateTarget(restrictedPool, statKey, testRng, hardLimit, dartLimit);
  if (result.ghostPath.length === 0) {
    return { valid: false, restrictedPool };
  }

  return { valid: true, restrictedPool };
}

// ── Build description string ─────────────────────────────────────────────────
function buildDescription(
  config: ChallengeConfig,
  restriction?: Restriction,
): string {
  const isRange = config.seasonStart !== undefined;
  const seasonDisplay = isRange
    ? `${config.seasonStart}–${config.seasonEnd}`
    : String(config.season);

  if (config.threshold && isRange) {
    return `${seasonDisplay} MLB · ${config.threshold}+ ${config.statLabel} Seasons`;
  } else if (restriction) {
    return `${seasonDisplay} MLB · ${config.statLabel} (${restriction.label})`;
  } else {
    return `${seasonDisplay} MLB · ${config.statLabel}`;
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────
export function getDailyChallenge(allPlayers: PlayerSeason[]): DailyChallenge {
  const today = new Date().toISOString().split('T')[0];
  const challengeNumber = Math.max(1, daysBetween(EPOCH_DATE, today));

  // DEV: use override config if set
  const config: ChallengeConfig = DEV_OVERRIDE ?? (() => {
    const rng = seedrandom(today);
    return CHALLENGE_CONFIGS[Math.floor(rng() * CHALLENGE_CONFIGS.length)];
  })();

  const pool = buildPool(allPlayers, config);

  // Restriction: rotation-based, validated with gate checks
  const rotationIndex = challengeNumber % RESTRICTION_ROTATION.length;
  const rawRestriction = RESTRICTION_ROTATION[rotationIndex];
  let restriction: Restriction | undefined;

  const rng = seedrandom(today + '-target');
  const density = getStatDensity(config.statKey);
  const dartLimit = getDartLimit('normal', density);

  if (rawRestriction) {
    const label = rawRestriction.type === 'league' || rawRestriction.type === 'division'
      ? `${rawRestriction.value} only`
      : RESTRICTION_LABELS[rawRestriction.type];
    const candidateRestriction: Restriction = { ...rawRestriction, label };

    const validation = validateRestriction(pool, candidateRestriction, config.statKey, dartLimit, rng);
    if (validation.valid) {
      restriction = candidateRestriction;
    }
  }

  const finalPool = restriction ? filterByRestriction(pool, restriction) : pool;

  // Generate target: desiredK = hard dart limit (best path = hard mode darts)
  const targetRng = seedrandom(today + '-target-gen');
  const hardLimit = getDartLimit('hard', density);
  const { target, ghostPath } = generateTarget(finalPool, config.statKey, targetRng, hardLimit, dartLimit);

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
    description: buildDescription(config, restriction),
    ghostPath,
  };
}

// For dev playtesting: get challenge for a specific config index (0-29)
export function getChallengeByIndex(allPlayers: PlayerSeason[], configIndex: number): DailyChallenge {
  const config = CHALLENGE_CONFIGS[configIndex % CHALLENGE_CONFIGS.length];
  const displaySeason = config.season ?? config.seasonEnd ?? config.seasonStart ?? 2025;

  const pool = buildPool(allPlayers, config);

  // Use config index as seed for deterministic but varied results per config
  const density = getStatDensity(config.statKey);
  const dartLimit = getDartLimit('normal', density);

  // No restriction for dev cycling — keeps it simple for testing target quality
  const targetRng = seedrandom(`dev-config-${configIndex}`);
  const hardLimit = getDartLimit('hard', density);
  const { target, ghostPath } = generateTarget(pool, config.statKey, targetRng, hardLimit, dartLimit);

  return {
    challengeNumber: configIndex + 1,
    date: new Date().toISOString().split('T')[0],
    sport: 'MLB',
    season: displaySeason,
    seasonStart: config.seasonStart,
    seasonEnd: config.seasonEnd,
    statKey: config.statKey,
    statLabel: config.statLabel,
    targetScore: target,
    description: buildDescription(config),
    ghostPath,
  };
}

// For testing/preview: get challenge for a specific date
export function getChallengeForDate(allPlayers: PlayerSeason[], dateStr: string): DailyChallenge {
  const challengeNumber = Math.max(1, daysBetween(EPOCH_DATE, dateStr));
  const rng = seedrandom(dateStr);
  const configIndex = Math.floor(rng() * CHALLENGE_CONFIGS.length);
  const config = CHALLENGE_CONFIGS[configIndex];
  const displaySeason = config.season ?? config.seasonEnd ?? config.seasonStart ?? 2025;

  const pool = buildPool(allPlayers, config);

  // Restriction gate check for preview too
  const rotationIndex = challengeNumber % RESTRICTION_ROTATION.length;
  const rawRestriction = RESTRICTION_ROTATION[rotationIndex];
  let restriction: Restriction | undefined;

  const density = getStatDensity(config.statKey);
  const dartLimit = getDartLimit('normal', density);
  const restrictionRng = seedrandom(dateStr + '-restrict');

  if (rawRestriction) {
    const label = rawRestriction.type === 'league' || rawRestriction.type === 'division'
      ? `${rawRestriction.value} only`
      : RESTRICTION_LABELS[rawRestriction.type];
    const candidateRestriction: Restriction = { ...rawRestriction, label };
    const validation = validateRestriction(pool, candidateRestriction, config.statKey, dartLimit, restrictionRng);
    if (validation.valid) {
      restriction = candidateRestriction;
    }
  }

  const finalPool = restriction ? filterByRestriction(pool, restriction) : pool;

  const targetRng = seedrandom(dateStr + '-target');
  const hardLimit = getDartLimit('hard', density);
  const { target, ghostPath } = generateTarget(finalPool, config.statKey, targetRng, hardLimit, dartLimit);

  return {
    challengeNumber,
    date: dateStr,
    sport: 'MLB',
    season: displaySeason,
    seasonStart: config.seasonStart,
    seasonEnd: config.seasonEnd,
    statKey: config.statKey,
    statLabel: config.statLabel,
    targetScore: target,
    restriction,
    description: buildDescription(config, restriction),
    ghostPath,
  };
}
