import { useState, useRef, useEffect, useMemo } from 'react';

import type { PlayerSeason } from '../types/game';
import type { PlayerEntry } from '../lib/playerSearch';
import { searchPlayers, getPlayerSeasons } from '../lib/playerSearch';

interface PlayerSearchProps {
  searchIndex: PlayerEntry[];
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
  searchIndex,
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
    const found = searchPlayers(searchIndex, query, 30, challengeSeasonStart, challengeSeasonEnd);

    // Filter out players whose career or seasons are already fully picked
    const availablePlayers = found.filter(player => {
      // Normal/Hard mode: player entirely blocked
      if (usedPlayerIds?.has(player.playerID)) return false;

      // Easy mode: check if any valid season is still un-used
      const all = getPlayerSeasons(allSeasons, player.playerID, challengeStatKey as never, usedIds, usedPlayerIds);
      const validSeasons = challengeSeasonEnd !== undefined
        ? all.filter(item => item.season.yearID >= challengeSeasonStart && item.season.yearID <= challengeSeasonEnd)
        : all.filter(item => item.season.yearID === challengeSeasonStart);

      return validSeasons.some(s => !s.used);
    });

    const finalResults = availablePlayers.slice(0, 8);
    setResults(finalResults);
    setShowDropdown(finalResults.length > 0);
  }, [query, searchIndex, allSeasons, challengeStatKey, challengeSeasonStart, challengeSeasonEnd, usedIds, usedPlayerIds]);

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
              w-full pl-12 pr-4 py-3.5 rounded-full text-sm font-medium
              bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500
              focus:outline-none transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]
              ${disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 hover:bg-slate-800'
              }
            `}
          />
        </div>

        {/* Player autocomplete dropdown (opens upward since search is at page bottom) */}
        {showDropdown && !selectedPlayer && results.length > 0 && (
          <div className="absolute z-50 left-4 right-4 bottom-full mb-3 bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] overflow-hidden max-h-72 flex flex-col">
            <div className="overflow-y-auto w-full p-2 space-y-0.5">
              {results.map(player => (
                <button
                  key={player.playerID}
                  onClick={() => handleSelectPlayer(player)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center justify-between transition-colors group"
                >
                  <span className="font-semibold text-slate-200 text-sm group-hover:text-white transition-colors">{player.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {player.careerStart}–{player.careerEnd}
                  </span>
                </button>
              ))}
            </div>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950">
              <button
                onClick={handleBack}
                className="text-slate-400 hover:text-rose-400 transition-colors text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800"
                aria-label="Back to search"
              >
                ←
              </button>
              <div>
                <p className="text-sm font-bold text-white tracking-wide">{selectedPlayer.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                  Pick a {challengeStatKey} season
                  {challengeSeasonEnd !== undefined
                    ? ` (${challengeSeasonStart}–${challengeSeasonEnd})`
                    : ` (${challengeSeasonStart})`}
                </p>
              </div>
            </div>

            {/* Season list */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
              {playerSeasons.length > 0 ? (
                playerSeasons.map(({ season, used }) => (
                  <button
                    key={season.id}
                    onClick={() => !used && handleSelectSeason(season)}
                    disabled={used}
                    className={`
                      w-full text-left px-4 py-2.5 rounded-xl flex items-center justify-between
                      transition-all group
                      ${used
                        ? 'opacity-40 cursor-not-allowed text-slate-500'
                        : 'hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-700'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono font-bold text-sm ${used ? 'text-slate-500' : 'text-slate-200 group-hover:text-white'}`}>{season.yearID}</span>
                      {showTeams && <span className="text-[10px] font-mono text-slate-500 tracking-wider bg-slate-800/50 px-1.5 py-0.5 rounded">{season.teamID}</span>}
                    </div>
                    {used && <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500/70">USED</span>}
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
