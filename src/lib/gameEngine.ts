// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Game Engine
// Core scoring logic, bust detection, dart quality classification
// ─────────────────────────────────────────────────────────────────────────────

import type { GameState, Dart, DartQuality, PlayerSeason, DailyChallenge, GameMode, StatDensity, StatKey, SecretBadge } from '../types/game';
import { MLB_TEAMS } from '../data/teams';

// ── Stat density classification (determines dart limits) ─────────────────────
const STAT_DENSITY: Record<StatKey, StatDensity> = {
  HR: 'sparse', SV: 'sparse',
  RBI: 'standard', SB: 'standard', BB: 'standard', K: 'standard', R: 'standard',
  H: 'dense', W: 'dense', TB: 'dense', AVG: 'dense', OBP: 'dense', OPS: 'dense',
};

export function getStatDensity(statKey: StatKey): StatDensity {
  return STAT_DENSITY[statKey] ?? 'standard';
}

// ── Dart limits per mode × density ───────────────────────────────────────────
const DART_LIMITS: Record<StatDensity, Record<Exclude<GameMode, 'easy'>, number>> = {
  sparse:   { normal: 8,  hard: 5 },
  standard: { normal: 9,  hard: 6 },
  dense:    { normal: 10, hard: 7 },
};

export function getDartLimit(mode: GameMode, density: StatDensity): number {
  if (mode === 'easy') return Infinity;
  return DART_LIMITS[density][mode];
}

// ── Darts-remaining scoring multiplier (lower score = better) ────────────────
// Index = darts remaining when game ends. 4+ remaining all use 3.0x.
const MULTIPLIER_TABLE = [1.0, 1.3, 1.7, 2.2, 3.0] as const;

export function getMultiplier(dartsRemaining: number): number {
  const idx = Math.min(dartsRemaining, MULTIPLIER_TABLE.length - 1);
  return MULTIPLIER_TABLE[idx];
}

export function getDartsRemaining(state: GameState): number {
  if (state.dartLimit === Infinity) return 0; // Easy mode has no concept of remaining
  return Math.max(0, state.dartLimit - state.darts.length);
}

export function createInitialState(challenge: DailyChallenge, mode: GameMode): GameState {
  const density = getStatDensity(challenge.statKey);
  const dartLimit = getDartLimit(mode, density);
  return {
    challenge,
    darts: [],
    remainingScore: challenge.targetScore,
    status: 'playing',
    mode,
    dartLimit,
    strikes: 0,
  };
}

export function getStatValue(season: PlayerSeason, statKey: string): number {
  return (season as unknown as Record<string, number>)[statKey] ?? 0;
}

function getDartQuality(statValue: number, previousScore: number): DartQuality {
  if (previousScore === 0) return 'normal';
  const pct = statValue / previousScore;
  if (statValue === previousScore) return 'bullseye';
  if (pct > 0.5) return 'great';
  return 'normal';
}

export function throwDart(state: GameState, season: PlayerSeason): GameState {
  if (state.status !== 'playing') return state;

  // Duplicate prevention:
  // Easy: block exact same season only (same player, different years OK)
  // Normal/Hard: block entire player (one player per game)
  if (state.mode === 'easy') {
    const exactDup = state.darts.some(
      d => d.playerSeason.playerID === season.playerID && d.playerSeason.yearID === season.yearID
    );
    if (exactDup) return state;
  } else {
    const playerUsed = state.darts.some(d => d.playerSeason.playerID === season.playerID);
    if (playerUsed) return state;
  }

  // Validate against restriction
  if (state.challenge.restriction) {
    const r = state.challenge.restriction;
    if (r.type === 'hof' && !season.isHOF) return state;
    if (r.type === 'allstar' && !season.isAllStar) return state;
    if (r.type === 'ws_winner' && !season.wonWorldSeries) return state;
    if (r.type === 'award' && r.value && !season.awards.includes(r.value)) return state;
    if (r.type === 'rookie' && !season.isRookie) return state;
    if (r.type === 'league') {
      const primaryTeam = season.teamID.split('/')[0];
      const teamInfo = MLB_TEAMS[primaryTeam];
      if (teamInfo?.league !== r.value) return state;
    }
    if (r.type === 'division') {
      const primaryTeam = season.teamID.split('/')[0];
      const teamInfo = MLB_TEAMS[primaryTeam];
      if (teamInfo?.division !== r.value) return state;
    }
    if (r.type === 'mvp' && !season.awards.includes('Most Valuable Player')) return state;
    if (r.type === 'cy_young' && !season.awards.includes('Cy Young Award')) return state;
    if (r.type === 'silver_slugger' && !season.awards.includes('Silver Slugger')) return state;
    if (r.type === 'gold_glove' && !season.awards.includes('Gold Glove')) return state;
  }

  const statValue = getStatValue(season, state.challenge.statKey);
  const previousScore = state.remainingScore;
  const rawNewScore = previousScore - statValue;

  // Determine dart quality
  let quality: DartQuality;
  if (rawNewScore === 0) {
    quality = 'bullseye';
  } else if (rawNewScore < 0) {
    quality = 'miss'; // overshoot
  } else {
    quality = getDartQuality(statValue, previousScore);
  }

  const dart: Dart = {
    playerSeason: season,
    statValue,
    previousScore,
    newScore: rawNewScore,
    quality,
  };

  const newDarts = [...state.darts, dart];

  // ── Bullseye (exact 0) — all modes ──
  if (rawNewScore === 0) {
    return {
      ...state,
      darts: newDarts,
      remainingScore: 0,
      status: 'perfect',
    };
  }

  // ── Overshoot (went negative) ──
  if (rawNewScore < 0) {
    // Normal/Hard: instant bust
    if (state.mode !== 'easy') {
      return {
        ...state,
        darts: newDarts,
        remainingScore: rawNewScore, // Pass the negative busted amount
        status: 'bust',
      };
    }

    // Easy: strike system — 3 strikes = bust
    const newStrikes = state.strikes + 1;
    if (newStrikes >= 3) {
      return {
        ...state,
        darts: newDarts,
        remainingScore: rawNewScore, // Pass the negative busted amount on final strike
        strikes: newStrikes,
        status: 'bust',
      };
    }
    // Strike but keep playing — score stays, dart is wasted
    return {
      ...state,
      darts: newDarts,
      remainingScore: previousScore, // score doesn't change
      strikes: newStrikes,
      status: 'playing',
    };
  }

  // ── Normal positive score ──
  const newScore = rawNewScore; // always positive here

  // Check if all darts exhausted (Normal/Hard only)
  if (state.dartLimit !== Infinity && newDarts.length >= state.dartLimit) {
    return {
      ...state,
      darts: newDarts,
      remainingScore: newScore,
      status: 'out_of_darts',
    };
  }

  const nextState: GameState = {
    ...state,
    darts: newDarts,
    remainingScore: newScore,
    status: 'playing',
  };

  if (isGameOver(nextState)) {
    const achievements = evaluatePostGameAchievements(nextState);
    nextState.starRating = achievements.stars;
    nextState.badges = achievements.badges;
  }

  return nextState;
}

export function standGame(state: GameState): GameState {
  if (state.status !== 'playing') return state;
  const nextState: GameState = { ...state, status: 'standing' };
  
  const achievements = evaluatePostGameAchievements(nextState);
  nextState.starRating = achievements.stars;
  nextState.badges = achievements.badges;

  return nextState;
}

export function isGameOver(state: GameState): boolean {
  return state.status !== 'playing';
}

export function getFinalScore(state: GameState): number {
  // Bullseye always = 0
  if (state.status === 'perfect') return 0;

  // Score = distance remaining. Lower = better. All modes.
  return state.remainingScore;
}

export function getUsedSeasonIds(state: GameState): Set<string> {
  return new Set(state.darts.map(d => d.playerSeason.id));
}

export function getUsedPlayerIds(state: GameState): Set<string> {
  return new Set(state.darts.map(d => d.playerSeason.playerID));
}

// ── Scoring & Post-Game Assessment ──────────────────────────────────────────

/**
 * Calculates the final star rating and any earned secret badges for a completed game.
 * 3 Stars: Distance <= 5% of target
 * 4 Stars: Exact Bullseye (distance 0)
 * 5 Stars: Exact Bullseye AND darts used matches the optimal Ghost Path length.
 */
export function evaluatePostGameAchievements(state: GameState): { stars: number; badges: SecretBadge[] } {
  // If forfeited or busted, 0 stars and no badges
  if (state.status === 'playing' || state.status === 'bust') return { stars: 0, badges: [] };

  const { targetScore } = state.challenge;
  const { remainingScore, darts, mode } = state;
  const ghostLength = state.challenge.ghostPath?.length ?? 99;

  let stars = 0;
  const badges: SecretBadge[] = [];

  // Determine Stars
  const pctOff = remainingScore / targetScore;

  if (remainingScore === 0) {
    if (darts.length === ghostLength) {
      stars = 5; // Flawless
    } else {
      stars = 4; // Bullseye
    }
  } else if (pctOff <= 0.05) {
    stars = 3; // Excellent (5% leniency)
  } else if (pctOff <= 0.20 && darts.length <= ghostLength) {
    stars = 2; // High Efficiency Bonus
  } else if (pctOff <= 0.10) {
    stars = 2; // Near-perfect
  } else if (state.status === 'out_of_darts' || state.status === 'perfect' || state.status === 'standing') {
    stars = 1; // Completed without busting
  }

  // Determine Secret Badges (require a win >= 1 star)
  if (stars >= 1) {
    // 1. The Scenic Route: Easy Mode, Bullseye, 11+ darts
    if (mode === 'easy' && remainingScore === 0 && darts.length >= 11) {
      badges.push('scenic_route');
    }

    // 2. The Franchise Bonus: All darts from the same franchise (using primary team split by '/')
    if (darts.length > 0) {
      const firstTeam = darts[0].playerSeason.teamID.split('/')[0];
      const allSameTeam = darts.every(d => d.playerSeason.teamID.split('/')[0] === firstTeam);
      if (allSameTeam) {
        badges.push('franchise_bonus');
      }
    }
  }

  return { stars, badges };
}

export function getStarRating(state: GameState): number {
  return evaluatePostGameAchievements(state).stars;
}

// ── Selection validation with human-readable rejection reasons ───────────────
export function validateSelection(
  season: PlayerSeason,
  state: GameState
): { valid: boolean; reason?: string } {
  const { challenge } = state;

  // Check year range
  const inYear = challenge.seasonStart !== undefined
    ? season.yearID >= challenge.seasonStart && season.yearID <= (challenge.seasonEnd ?? challenge.seasonStart)
    : season.yearID === challenge.season;
  if (!inYear) {
    const yearLabel = challenge.seasonStart
      ? `${challenge.seasonStart}–${challenge.seasonEnd}`
      : String(challenge.season);
    return { valid: false, reason: `${season.name} didn't play in ${yearLabel}` };
  }

  // Check stat value > 0
  const statValue = getStatValue(season, challenge.statKey);
  if (statValue <= 0) {
    return { valid: false, reason: `${season.name} had 0 ${challenge.statLabel} in ${season.yearID}` };
  }

  // Duplicate check
  if (state.mode === 'easy') {
    const exactDup = state.darts.some(
      d => d.playerSeason.playerID === season.playerID && d.playerSeason.yearID === season.yearID
    );
    if (exactDup) return { valid: false, reason: `${season.name} ${season.yearID} already used` };
  } else {
    const playerUsed = state.darts.some(d => d.playerSeason.playerID === season.playerID);
    if (playerUsed) return { valid: false, reason: `${season.name} already used this game` };
  }

  // Restriction check
  if (challenge.restriction) {
    const r = challenge.restriction;
    if (r.type === 'hof' && !season.isHOF) {
      return { valid: false, reason: `${season.name} is not in the Hall of Fame` };
    }
    if (r.type === 'allstar' && !season.isAllStar) {
      return { valid: false, reason: `${season.name} was not an All-Star in ${season.yearID}` };
    }
    if (r.type === 'ws_winner' && !season.wonWorldSeries) {
      return { valid: false, reason: `${season.name}'s team didn't win the World Series in ${season.yearID}` };
    }
    if (r.type === 'award' && r.value && !season.awards.includes(r.value)) {
      return { valid: false, reason: `${season.name} didn't win ${r.value} in ${season.yearID}` };
    }
    if (r.type === 'rookie' && !season.isRookie) {
      return { valid: false, reason: `${season.name} was not a rookie in ${season.yearID}` };
    }
    if (r.type === 'league') {
      const primaryTeam = season.teamID.split('/')[0];
      const teamInfo = MLB_TEAMS[primaryTeam];
      if (teamInfo?.league !== r.value) {
        return { valid: false, reason: `${season.name} was not in the ${r.value} in ${season.yearID}` };
      }
    }
    if (r.type === 'division') {
      const primaryTeam = season.teamID.split('/')[0];
      const teamInfo = MLB_TEAMS[primaryTeam];
      if (teamInfo?.division !== r.value) {
        return { valid: false, reason: `${season.name} was not in the ${r.value} in ${season.yearID}` };
      }
    }
    if (r.type === 'mvp' && !season.awards.includes('Most Valuable Player')) {
      return { valid: false, reason: `${season.name} didn't win MVP in ${season.yearID}` };
    }
    if (r.type === 'cy_young' && !season.awards.includes('Cy Young Award')) {
      return { valid: false, reason: `${season.name} didn't win the Cy Young in ${season.yearID}` };
    }
    if (r.type === 'silver_slugger' && !season.awards.includes('Silver Slugger')) {
      return { valid: false, reason: `${season.name} didn't win a Silver Slugger in ${season.yearID}` };
    }
    if (r.type === 'gold_glove' && !season.awards.includes('Gold Glove')) {
      return { valid: false, reason: `${season.name} didn't win a Gold Glove in ${season.yearID}` };
    }
  }

  return { valid: true };
}
