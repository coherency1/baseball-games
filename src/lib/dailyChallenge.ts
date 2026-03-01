// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Daily Challenge Generator
// Date-seeded: all players get the same puzzle each day.
// Target = sum of top 5 player-seasons for the chosen year/stat.
// ─────────────────────────────────────────────────────────────────────────────

// @ts-ignore - seedrandom has no bundled types but @types/seedrandom is installed
import seedrandom from 'seedrandom';
import type { PlayerSeason, DailyChallenge, ChallengeConfig, Restriction, StatKey } from '../types/game';
import { getStatValue } from './gameEngine';

// Epoch: day 1 of Deadeye challenges
const EPOCH_DATE = '2026-03-01';

// DEV: force a specific challenge for testing. Set to null for production seeding.
export const DEV_OVERRIDE: ChallengeConfig | null = { seasonStart: 2010, seasonEnd: 2025, statKey: 'K', statLabel: 'Strikeouts (Pitching)' };

// Curated list of interesting year/stat combinations spanning different eras.
// Each entry represents a potential daily challenge configuration.
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
  // Pitching — Wins
  { season: 1968, statKey: 'W',   statLabel: 'Wins (Pitching)' },
  { season: 1920, statKey: 'W',   statLabel: 'Wins (Pitching)' },
  // Saves
  { season: 2008, statKey: 'SV',  statLabel: 'Saves' },
  { season: 1990, statKey: 'SV',  statLabel: 'Saves' },
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

function computeTarget(players: PlayerSeason[], statKey: StatKey): number {
  const sorted = [...players].sort((a, b) => getStatValue(b, statKey) - getStatValue(a, statKey));
  const top5 = sorted.slice(0, 5);
  return top5.reduce((sum, p) => sum + getStatValue(p, statKey), 0);
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
  const pool = isRange
    ? allPlayers.filter(p =>
        p.yearID >= config.seasonStart! &&
        p.yearID <= (config.seasonEnd ?? config.seasonStart!) &&
        getStatValue(p, config.statKey) > 0
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
  const targetScore = computeTarget(finalPool, config.statKey);

  const seasonDisplay = isRange
    ? `${config.seasonStart}–${config.seasonEnd}`
    : String(config.season);
  const desc = restriction
    ? `${seasonDisplay} MLB · ${config.statLabel} (${restriction.label})`
    : `${seasonDisplay} MLB · ${config.statLabel}`;

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
    targetScore,
    restriction,
    description: desc,
  };
}

// For testing/preview: get challenge for a specific date
export function getChallengeForDate(allPlayers: PlayerSeason[], dateStr: string): DailyChallenge {
  const challengeNumber = Math.max(1, daysBetween(EPOCH_DATE, dateStr));
  const rng = seedrandom(dateStr);
  const configIndex = Math.floor(rng() * CHALLENGE_CONFIGS.length);
  const config = CHALLENGE_CONFIGS[configIndex];
  const season = config.season ?? config.seasonEnd ?? config.seasonStart ?? 2025;
  const pool = config.seasonStart !== undefined
    ? allPlayers.filter(p => p.yearID >= config.seasonStart! && p.yearID <= (config.seasonEnd ?? config.seasonStart!) && getStatValue(p, config.statKey) > 0)
    : filterByStat(allPlayers, config.statKey, season);
  const targetScore = computeTarget(pool, config.statKey);

  return {
    challengeNumber,
    date: dateStr,
    sport: 'MLB',
    season,
    seasonStart: config.seasonStart,
    seasonEnd: config.seasonEnd,
    statKey: config.statKey,
    statLabel: config.statLabel,
    targetScore,
    description: config.seasonStart !== undefined
      ? `${config.seasonStart}–${config.seasonEnd} MLB · ${config.statLabel}`
      : `${season} MLB · ${config.statLabel}`,
  };
}
