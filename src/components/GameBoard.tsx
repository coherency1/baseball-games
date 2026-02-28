import { useState, useEffect, useMemo } from 'react';
import type Fuse from 'fuse.js';
import type { PlayerSeason, GameState, DailyChallenge } from '../types/game';
import type { PlayerEntry } from '../lib/playerSearch';
import { buildPlayerIndex, buildFuseIndex } from '../lib/playerSearch';
import { getDailyChallenge } from '../lib/dailyChallenge';
import { createInitialState, throwDart, standGame, isGameOver, getUsedSeasonIds } from '../lib/gameEngine';
import { Header } from './Header';
import { ScoreDisplay } from './ScoreDisplay';
import { DartRow } from './DartRow';
import { PlayerSearch } from './PlayerSearch';
import { ShareModal } from './ShareModal';

const STORAGE_KEY_PREFIX = 'deadeye-';

function getTodayKey() {
  return STORAGE_KEY_PREFIX + new Date().toISOString().split('T')[0];
}

function loadSavedState(): GameState | null {
  try {
    const key = getTodayKey();
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state: GameState) {
  try {
    localStorage.setItem(getTodayKey(), JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

function pruneOldStates() {
  try {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_KEY_PREFIX))
      .forEach(k => {
        const dateStr = k.replace(STORAGE_KEY_PREFIX, '');
        if (dateStr < cutoffStr) localStorage.removeItem(k);
      });
  } catch {
    // ignore
  }
}

export function GameBoard() {
  const [allSeasons, setAllSeasons] = useState<PlayerSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [hardMode, setHardMode] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Build search index
  const playerIndex = useMemo<PlayerEntry[]>(() => buildPlayerIndex(allSeasons), [allSeasons]);
  const fuse = useMemo<Fuse<PlayerEntry>>(() => buildFuseIndex(playerIndex), [playerIndex]);

  // Load data + init game
  useEffect(() => {
    pruneOldStates();
    async function load() {
      try {
        const res = await fetch('/data/players.json');
        if (!res.ok) throw new Error(`Failed to load player data (${res.status})`);
        const data: PlayerSeason[] = await res.json();
        setAllSeasons(data);

        // Try restoring today's saved state
        const saved = loadSavedState();
        if (saved) {
          setGameState(saved);
          setHardMode(saved.hardMode);
        } else {
          // Generate fresh challenge
          const challenge: DailyChallenge = getDailyChallenge(data);
          const initial = createInitialState(challenge, hardMode);
          setGameState(initial);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleThrowDart(season: PlayerSeason) {
    if (!gameState) return;
    const next = throwDart(gameState, season);
    setGameState(next);
    saveState(next);
    if (isGameOver(next)) setShowShare(true);
  }

  function handleStand() {
    if (!gameState) return;
    const next = standGame(gameState);
    setGameState(next);
    saveState(next);
    setShowShare(true);
  }

  function handleToggleHardMode() {
    if (gameState && gameState.darts.length > 0) return; // can't change mid-game
    const next = !hardMode;
    setHardMode(next);
    if (gameState) {
      const updated = { ...gameState, hardMode: next };
      setGameState(updated);
    }
  }

  function handleNewGame() {
    if (!allSeasons.length) return;
    const challenge = getDailyChallenge(allSeasons);
    const initial = createInitialState(challenge, hardMode);
    setGameState(initial);
    setShowShare(false);
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-400">
        <span className="text-5xl animate-spin">🎯</span>
        <p className="text-lg font-semibold">Loading player data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-red-400 px-4">
        <span className="text-5xl">⚠️</span>
        <p className="text-lg font-semibold text-center">{error}</p>
        <p className="text-sm text-slate-500 text-center">
          Make sure you ran <code className="bg-slate-800 px-2 py-0.5 rounded">npm run build:data</code> to generate player data.
        </p>
      </div>
    );
  }

  if (!gameState) return null;

  const gameOver = isGameOver(gameState);
  const usedIds = getUsedSeasonIds(gameState);

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto pb-10">
      {/* Header */}
      <Header
        challenge={gameState.challenge}
        hardMode={hardMode}
        onToggleHardMode={handleToggleHardMode}
      />

      {/* Score display */}
      <div className="px-0 mt-2">
        <ScoreDisplay
          targetScore={gameState.challenge.targetScore}
          remainingScore={gameState.remainingScore}
          status={gameState.status}
          dartsThrown={gameState.darts.length}
        />
      </div>

      {/* Dart rows (darts thrown so far) */}
      {gameState.darts.length > 0 && (
        <div className="px-4 mt-4 space-y-2">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Darts thrown</p>
          {gameState.darts.map((dart, i) => (
            <DartRow
              key={dart.playerSeason.id}
              dart={dart}
              index={i}
              statLabel={gameState.challenge.statLabel}
              isBust={gameState.status === 'bust' && i === gameState.darts.length - 1}
            />
          ))}
        </div>
      )}

      {/* Search or game over actions */}
      <div className="mt-auto pt-6 space-y-3">
        {!gameOver ? (
          <>
            <PlayerSearch
              fuse={fuse}
              allSeasons={allSeasons}
              challengeStatKey={gameState.challenge.statKey}
              challengeSeason={gameState.challenge.season}
              usedIds={usedIds}
              disabled={false}
              onSelect={handleThrowDart}
            />
            {/* How-to hint */}
            <p className="text-center text-xs text-slate-500 px-4">
              Search a player from <strong className="text-slate-400">{gameState.challenge.season}</strong> to subtract their {gameState.challenge.statLabel}.
              {gameState.darts.length > 0 && (
                <button
                  onClick={handleStand}
                  className="ml-2 text-amber-400 hover:text-amber-300 underline font-semibold"
                >
                  Stand here →
                </button>
              )}
            </p>
            {/* Restriction reminder */}
            {gameState.challenge.restriction && (
              <p className="text-center text-xs text-amber-400 px-4">
                ⚡ Only {gameState.challenge.restriction.label} count
              </p>
            )}
          </>
        ) : (
          <div className="px-4 flex gap-3">
            <button
              onClick={() => setShowShare(true)}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors"
            >
              📋 Share Result
            </button>
            <button
              onClick={handleNewGame}
              className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-sm transition-colors"
            >
              🎯 New Game
            </button>
          </div>
        )}
      </div>

      {/* Share modal */}
      {showShare && gameState && (
        <ShareModal
          gameState={gameState}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
