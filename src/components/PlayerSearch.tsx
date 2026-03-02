import { useState, useRef, useEffect, useMemo } from 'react';
import type Fuse from 'fuse.js';
import type { PlayerSeason } from '../types/game';
import type { PlayerEntry } from '../lib/playerSearch';
import { searchPlayers, getPlayerSeasons } from '../lib/playerSearch';

interface PlayerSearchProps {
  fuse: Fuse<PlayerEntry>;
  allSeasons: PlayerSeason[];
  challengeStatKey: string;
  challengeSeasonStart: number;
  challengeSeasonEnd?: number;   // undefined = single-year challenge
  usedIds: Set<string>;
  usedPlayerIds?: Set<string>;   // Normal/Hard: blocks entire player after one season used
  showTeams?: boolean;            // false in Hard mode — hide teamID in season picker
  disabled: boolean;
  rejectionMessage?: string | null; // shown as toast below search input
  onSelect: (season: PlayerSeason) => void;
}

export function PlayerSearch({
  fuse,
  allSeasons,
  challengeStatKey,
  challengeSeasonStart,
  challengeSeasonEnd,
  usedIds,
  usedPlayerIds,
  showTeams = true,
  disabled,
  rejectionMessage,
  onSelect,
}: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerEntry[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerEntry | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter seasons for selected player to challenge year/range
  const playerSeasons = useMemo(() => {
    if (!selectedPlayer) return [];
    const all = getPlayerSeasons(allSeasons, selectedPlayer.playerID, challengeStatKey as never, usedIds, usedPlayerIds);
    return challengeSeasonEnd !== undefined
      ? all.filter(item => item.season.yearID >= challengeSeasonStart && item.season.yearID <= challengeSeasonEnd)
      : all.filter(item => item.season.yearID === challengeSeasonStart);
  }, [selectedPlayer, allSeasons, challengeStatKey, challengeSeasonStart, challengeSeasonEnd, usedIds, usedPlayerIds]);

  // Search as user types
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const found = searchPlayers(fuse, query, 8, challengeSeasonStart, challengeSeasonEnd);
    setResults(found);
    setShowDropdown(found.length > 0);
  }, [query, fuse]);

  function handleSelectPlayer(player: PlayerEntry) {
    const all = getPlayerSeasons(allSeasons, player.playerID, challengeStatKey as never, usedIds, usedPlayerIds);
    const seasons = challengeSeasonEnd !== undefined
      ? all.filter(item => item.season.yearID >= challengeSeasonStart && item.season.yearID <= challengeSeasonEnd)
      : all.filter(item => item.season.yearID === challengeSeasonStart);

    if (seasons.length === 1 && !seasons[0].used) {
      // Auto-submit: one unambiguous season — no picker needed
      onSelect(seasons[0].season);
      setQuery('');
      setResults([]);
      setShowDropdown(false);
      inputRef.current?.focus();
    } else {
      // Multiple seasons (range challenge) or already used: show modal picker
      setSelectedPlayer(player);
      setShowDropdown(false);
    }
  }

  function handleSelectSeason(season: PlayerSeason) {
    onSelect(season);
    setQuery('');
    setSelectedPlayer(null);
    setResults([]);
    inputRef.current?.focus();
  }

  function handleBack() {
    setSelectedPlayer(null);
    setShowDropdown(query.length >= 2 && results.length > 0);
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (selectedPlayer) setSelectedPlayer(null);
  }

  function handleCloseModal() {
    setSelectedPlayer(null);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  }

  return (
    <>
      <div className="relative w-full max-w-2xl mx-auto px-4">
        {/* Search input */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => query.length >= 2 && results.length > 0 && setShowDropdown(true)}
            disabled={disabled}
            placeholder={disabled ? 'Game over' : challengeSeasonEnd !== undefined ? `Search players from ${challengeSeasonStart}–${challengeSeasonEnd}…` : `Search players from ${challengeSeasonStart}…`}
            className={`
              w-full pl-12 pr-4 py-4 rounded-xl text-base font-medium
              bg-slate-800 border-2 text-white placeholder-slate-500
              focus:outline-none transition-colors
              ${disabled
                ? 'border-slate-700 opacity-50 cursor-not-allowed'
                : 'border-slate-600 focus:border-blue-500 hover:border-slate-500'
              }
            `}
          />
        </div>

        {/* Player autocomplete dropdown (opens upward since search is at page bottom) */}
        {showDropdown && !selectedPlayer && results.length > 0 && (
          <div className="absolute z-50 left-4 right-4 bottom-full mb-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
            {results.map(player => (
              <button
                key={player.playerID}
                onClick={() => handleSelectPlayer(player)}
                className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center justify-between border-b border-slate-700 last:border-0 transition-colors"
              >
                <span className="font-semibold text-white text-sm">{player.name}</span>
                <span className="text-xs text-slate-400 ml-2">
                  {player.careerStart}–{player.careerEnd}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Rejection toast */}
        {rejectionMessage && (
          <div className="mt-2 px-4 py-2 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-300 text-center animate-pulse">
            {rejectionMessage}
          </div>
        )}
      </div>

      {/* Season picker modal overlay */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-sm mx-4 bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
              <button
                onClick={handleBack}
                className="text-slate-400 hover:text-white transition-colors text-lg font-bold"
                aria-label="Back to search"
              >
                ←
              </button>
              <div>
                <p className="text-sm font-bold text-white">{selectedPlayer.name}</p>
                <p className="text-xs text-slate-400">
                  Pick a {challengeStatKey} season
                  {challengeSeasonEnd !== undefined
                    ? ` (${challengeSeasonStart}–${challengeSeasonEnd})`
                    : ` (${challengeSeasonStart})`}
                </p>
              </div>
            </div>

            {/* Season list */}
            <div className="max-h-80 overflow-y-auto">
              {playerSeasons.length > 0 ? (
                playerSeasons.map(({ season, statValue, used }) => (
                  <button
                    key={season.id}
                    onClick={() => !used && handleSelectSeason(season)}
                    disabled={used}
                    className={`
                      w-full text-left px-4 py-3 flex items-center justify-between
                      border-b border-slate-700 last:border-0 transition-colors
                      ${used
                        ? 'opacity-40 cursor-not-allowed text-slate-500'
                        : 'hover:bg-slate-700 cursor-pointer'
                      }
                    `}
                  >
                    <div>
                      <span className="font-semibold text-white text-sm">{season.yearID}</span>
                      {showTeams && <span className="text-xs text-slate-400 ml-2">{season.teamID}</span>}
                      {used && <span className="text-xs text-slate-500 ml-2">(used)</span>}
                    </div>
                    </button>
                ))
              ) : (
                <p className="px-4 py-4 text-sm text-slate-500 text-center">
                  No qualifying seasons in{' '}
                  {challengeSeasonEnd !== undefined
                    ? `${challengeSeasonStart}–${challengeSeasonEnd}`
                    : challengeSeasonStart}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
