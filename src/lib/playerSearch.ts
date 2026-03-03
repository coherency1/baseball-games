// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Player Search
// Fuse.js fuzzy search with accent normalization (matches statpad-dupe pattern)
// ─────────────────────────────────────────────────────────────────────────────

import type { PlayerSeason, StatKey } from '../types/game';

export interface PlayerEntry {
  playerID: string;
  name: string;
  normalizedName: string;
  careerStart: number;
  careerEnd: number;
}

// Normalize accented characters: "Hernández" → "Hernandez"
export function normalizeName(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Build a deduplicated player list for autocomplete
export function buildPlayerIndex(seasons: PlayerSeason[]): PlayerEntry[] {
  const map = new Map<string, PlayerEntry>();
  for (const s of seasons) {
    const existing = map.get(s.playerID);
    if (existing) {
      existing.careerStart = Math.min(existing.careerStart, s.yearID);
      existing.careerEnd = Math.max(existing.careerEnd, s.yearID);
    } else {
      map.set(s.playerID, {
        playerID: s.playerID,
        name: s.name,
        normalizedName: normalizeName(s.name),
        careerStart: s.yearID,
        careerEnd: s.yearID,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// (Removed buildFuseIndex in favor of raw array passing)

// Search players by strict substring inclusion (2+ characters required).
// When challengeYearStart/End are provided, players active during that era
// are boosted to the top (without revealing pool membership — just career overlap).
export function searchPlayers(
  players: PlayerEntry[],
  query: string,
  limit = 10,
  challengeYearStart?: number,
  challengeYearEnd?: number,
): PlayerEntry[] {
  if (query.length < 2) return [];
  const normalizedQuery = normalizeName(query).toLowerCase();

  // 1. Filter by substring match
  const matches = players.filter(p => p.normalizedName.toLowerCase().includes(normalizedQuery));

  if (challengeYearStart === undefined) {
    return matches.slice(0, limit);
  }

  const yearEnd = challengeYearEnd ?? challengeYearStart;

  // 2. Stable sort: era-relevant players first, then alphabetical or length
  const sorted = matches.sort((a, b) => {
    const aOverlap = a.careerStart <= yearEnd && a.careerEnd >= challengeYearStart;
    const bOverlap = b.careerStart <= yearEnd && b.careerEnd >= challengeYearStart;
    
    // Era overlap gets absolute priority
    if (aOverlap && !bOverlap) return -1;
    if (!aOverlap && bOverlap) return 1;
    
    // Tie-breaker: Exact startsWith is better than mid-string inclusion
    const aStarts = a.normalizedName.toLowerCase().startsWith(normalizedQuery);
    const bStarts = b.normalizedName.toLowerCase().startsWith(normalizedQuery);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Tie-breaker: Shorter names first (e.g. "Bob" beats "Bobby") if both start with it
    return a.name.length - b.name.length;
  });

  return sorted.slice(0, limit);
}

// Get all seasons for a specific player, filtered by what's valid for the challenge.
// usedPlayerIds: if provided (Normal/Hard), marks ALL seasons as used when playerID is in set.
export function getPlayerSeasons(
  allSeasons: PlayerSeason[],
  playerID: string,
  statKey: StatKey,
  usedIds: Set<string>,
  usedPlayerIds?: Set<string>
): Array<{ season: PlayerSeason; statValue: number; used: boolean }> {
  const playerBlocked = usedPlayerIds?.has(playerID) ?? false;
  return allSeasons
    .filter(s => s.playerID === playerID)
    .map(s => ({
      season: s,
      statValue: (s as unknown as Record<string, number>)[statKey] ?? 0,
      used: playerBlocked || usedIds.has(s.id),
    }))
    .filter(item => item.statValue > 0)
    .sort((a, b) => a.season.yearID - b.season.yearID);
}
