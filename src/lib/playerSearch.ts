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

// Search players by name (2+ characters required)
export function searchPlayers(
  fuse: Fuse<PlayerEntry>,
  query: string,
  limit = 10
): PlayerEntry[] {
  if (query.length < 2) return [];
  const normalized = normalizeName(query);
  const results = fuse.search(normalized, { limit });
  return results.map(r => r.item);
}

// Get all seasons for a specific player, filtered by what's valid for the challenge
export function getPlayerSeasons(
  allSeasons: PlayerSeason[],
  playerID: string,
  statKey: StatKey,
  usedIds: Set<string>
): Array<{ season: PlayerSeason; statValue: number; used: boolean }> {
  return allSeasons
    .filter(s => s.playerID === playerID)
    .map(s => ({
      season: s,
      statValue: (s as unknown as Record<string, number>)[statKey] ?? 0,
      used: usedIds.has(s.id),
    }))
    .filter(item => item.statValue > 0)
    .sort((a, b) => a.season.yearID - b.season.yearID);
}
