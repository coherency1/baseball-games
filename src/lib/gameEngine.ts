// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Game Engine
// Core scoring logic, bust detection, dart quality classification
// ─────────────────────────────────────────────────────────────────────────────

import type { GameState, Dart, DartQuality, PlayerSeason, DailyChallenge } from '../types/game';

export function createInitialState(challenge: DailyChallenge, hardMode: boolean): GameState {
  return {
    challenge,
    darts: [],
    remainingScore: challenge.targetScore,
    status: 'playing',
    hardMode,
  };
}

export function getStatValue(season: PlayerSeason, statKey: string): number {
  return (season as unknown as Record<string, number>)[statKey] ?? 0;
}

function getDartQuality(statValue: number, previousScore: number): DartQuality {
  if (previousScore === 0) return 'small';
  const pct = statValue / previousScore;
  if (statValue === previousScore) return 'bullseye'; // would reach exactly 0
  if (pct > 0.5) return 'great';
  if (pct >= 0.25) return 'good';
  return 'small';
}

export function throwDart(state: GameState, season: PlayerSeason): GameState {
  if (state.status !== 'playing') return state;

  // Prevent duplicate season guesses
  const alreadyUsed = state.darts.some(
    d => d.playerSeason.playerID === season.playerID && d.playerSeason.yearID === season.yearID
  );
  if (alreadyUsed) return state;

  // Validate against restriction
  if (state.challenge.restriction) {
    const r = state.challenge.restriction;
    if (r.type === 'hof' && !season.isHOF) return state;
    if (r.type === 'allstar' && !season.isAllStar) return state;
    if (r.type === 'ws_winner' && !season.wonWorldSeries) return state;
    if (r.type === 'award' && r.value && !season.awards.includes(r.value)) return state;
  }

  const statValue = getStatValue(season, state.challenge.statKey);
  const previousScore = state.remainingScore;
  const rawNewScore = previousScore - statValue;

  const quality: DartQuality =
    rawNewScore === 0 ? 'bullseye' : getDartQuality(statValue, previousScore);

  const dart: Dart = {
    playerSeason: season,
    statValue,
    previousScore,
    newScore: rawNewScore,
    quality,
  };

  // Hard mode: going negative = bust; score stays at previousScore (real darts rules)
  if (rawNewScore < 0 && state.hardMode) {
    return {
      ...state,
      darts: [...state.darts, dart],
      remainingScore: previousScore,
      status: 'bust',
    };
  }

  const newScore = Math.abs(rawNewScore); // easy mode: treat as distance from 0
  const newStatus = rawNewScore === 0 ? 'perfect' : 'playing';

  return {
    ...state,
    darts: [...state.darts, dart],
    remainingScore: newScore,
    status: newStatus,
  };
}

export function standGame(state: GameState): GameState {
  if (state.status !== 'playing') return state;
  return { ...state, status: 'standing' };
}

export function isGameOver(state: GameState): boolean {
  return state.status !== 'playing';
}

export function getFinalScore(state: GameState): number {
  return state.remainingScore;
}

export function getUsedSeasonIds(state: GameState): Set<string> {
  return new Set(state.darts.map(d => d.playerSeason.id));
}
