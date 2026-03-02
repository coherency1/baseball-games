// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Player Search
// Fuse.js fuzzy search with accent normalization (matches statpad-dupe pattern)
// ─────────────────────────────────────────────────────────────────────────────

import Fuse from 'fuse.js';
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

// Build a Fuse.js instance for fuzzy name search
export function buildFuseIndex(players: PlayerEntry[]): Fuse<PlayerEntry> {
  return new Fuse(players, {
    keys: ['normalizedName', 'name'],
    threshold: 0.3,
    minMatchCharLength: 2,
    shouldSort: true,
    includeScore: true,
  });
}

// Search players by name (2+ characters required).
// When challengeYearStart/End are provided, players active during that era
// are boosted to the top (without revealing pool membership — just career overlap).
export function searchPlayers(
  fuse: Fuse<PlayerEntry>,
  query: string,
  limit = 10,
  challengeYearStart?: number,
  challengeYearEnd?: number,
): PlayerEntry[] {
  if (query.length < 2) return [];
  const normalized = normalizeName(query);
  // Fetch more than needed so we have room to re-rank
  const results = fuse.search(normalized, { limit: limit * 2 });

  if (challengeYearStart === undefined) {
    return results.slice(0, limit).map(r => r.item);
  }

  const yearEnd = challengeYearEnd ?? challengeYearStart;

  // Stable re-sort: era-relevant players first, then by original Fuse score
  const sorted = results.sort((a, b) => {
    const aOverlap = a.item.careerStart <= yearEnd && a.item.careerEnd >= challengeYearStart;
    const bOverlap = b.item.careerStart <= yearEnd && b.item.careerEnd >= challengeYearStart;
    if (aOverlap && !bOverlap) return -1;
    if (!aOverlap && bOverlap) return 1;
    return (a.score ?? 1) - (b.score ?? 1); // lower score = better match
  });

  return sorted.slice(0, limit).map(r => r.item);
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
