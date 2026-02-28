import { useState, useRef, useEffect, useMemo } from 'react';
import type Fuse from 'fuse.js';
import type { PlayerSeason } from '../types/game';
import type { PlayerEntry } from '../lib/playerSearch';
import { searchPlayers, getPlayerSeasons } from '../lib/playerSearch';

interface PlayerSearchProps {
  fuse: Fuse<PlayerEntry>;
  allSeasons: PlayerSeason[];
  challengeStatKey: string;
  challengeSeason: number;
  usedIds: Set<string>;
  disabled: boolean;
  onSelect: (season: PlayerSeason) => void;
}

export function PlayerSearch({
  fuse,
  allSeasons,
  challengeStatKey,
  challengeSeason,
  usedIds,
  disabled,
  onSelect,
}: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerEntry[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerEntry | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter seasons for selected player to challenge year only
  const playerSeasons = useMemo(() => {
    if (!selectedPlayer) return [];
    return getPlayerSeasons(allSeasons, selectedPlayer.playerID, challengeStatKey as never, usedIds)
      .filter(item => item.season.yearID === challengeSeason);
  }, [selectedPlayer, allSeasons, challengeStatKey, challengeSeason, usedIds]);

  // Search as user types
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const found = searchPlayers(fuse, query, 8);
    setResults(found);
    setShowDropdown(found.length > 0);
  }, [query, fuse]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setSelectedPlayer(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelectPlayer(player: PlayerEntry) {
    setSelectedPlayer(player);
    setQuery(player.name);
    setShowDropdown(false);
  }

  function handleSelectSeason(season: PlayerSeason) {
    onSelect(season);
    setQuery('');
    setSelectedPlayer(null);
    setResults([]);
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (selectedPlayer) setSelectedPlayer(null);
  }

  return (
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
          placeholder={disabled ? 'Game over' : `Search players from ${challengeSeason}…`}
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

      {/* Dropdown container */}
      <div ref={dropdownRef}>
        {/* Player autocomplete list */}
        {showDropdown && !selectedPlayer && (
          <div className="absolute z-50 left-4 right-4 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
            {results.map(player => (
              <button
                key={player.playerID}
                onMouseDown={() => handleSelectPlayer(player)}
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

        {/* Season picker for selected player */}
        {selectedPlayer && playerSeasons.length > 0 && (
          <div className="absolute z-50 left-4 right-4 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-700">
              <p className="text-xs text-slate-400">
                Select a season for <span className="text-white font-semibold">{selectedPlayer.name}</span> · {challengeStatKey} stat
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {playerSeasons.map(({ season, statValue, used }) => (
                <button
                  key={season.id}
                  onMouseDown={() => !used && handleSelectSeason(season)}
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
                    <span className="text-xs text-slate-400 ml-2">{season.teamID}</span>
                    {used && <span className="text-xs text-slate-500 ml-2">(used)</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-blue-400">{statValue}</span>
                    <span className="text-xs text-slate-400 ml-1">{challengeStatKey}</span>
                  </div>
                </button>
              ))}
              {playerSeasons.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-500">
                  No qualifying seasons in {challengeSeason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* No seasons found for this player in challenge year */}
        {selectedPlayer && playerSeasons.length === 0 && (
          <div className="absolute z-50 left-4 right-4 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4">
            <p className="text-sm text-slate-400">
              <span className="text-white font-semibold">{selectedPlayer.name}</span> has no qualifying {challengeStatKey} seasons in {challengeSeason}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
