import { useState, useEffect, useMemo } from 'react';
import type { PlayerSeason, GameState, DailyChallenge, GameMode } from '../types/game';
import type { PlayerEntry } from '../lib/playerSearch';
import { buildPlayerIndex } from '../lib/playerSearch';
import { getDailyChallenge, getChallengeByIndex, CHALLENGE_CONFIGS, DEV_OVERRIDE } from '../lib/dailyChallenge';
import { createInitialState, throwDart, standGame, isGameOver, getUsedSeasonIds, getUsedPlayerIds, validateSelection, getStarRating } from '../lib/gameEngine';
import { Header } from './Header';
import { ScoreDisplay } from './ScoreDisplay';
import { DartRow } from './DartRow';
import { PlayerSearch } from './PlayerSearch';
import { ShareModal } from './ShareModal';

const STORAGE_KEY_PREFIX = 'deadeye-';
const MODE_STORAGE_KEY = 'deadeye-mode';

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

function loadSavedMode(): GameMode {
  try {
    const mode = localStorage.getItem(MODE_STORAGE_KEY);
    if (mode === 'easy' || mode === 'normal' || mode === 'hard') return mode;
  } catch { /* ignore */ }
  return 'normal'; // default per spec
}

function saveMode(mode: GameMode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch { /* ignore */ }
}

function pruneOldStates() {
  try {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_KEY_PREFIX) && k !== MODE_STORAGE_KEY)
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
  const [mode, setMode] = useState<GameMode>(loadSavedMode);
  const [showShare, setShowShare] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [devConfigIndex, setDevConfigIndex] = useState<number | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);

  // Build search index from ALL players — pool membership is never revealed through search.
  // Validation happens after selection, with specific rejection messages.
  const searchIndex = useMemo<PlayerEntry[]>(() => buildPlayerIndex(allSeasons), [allSeasons]);

  // Load data + init game
  useEffect(() => {
    pruneOldStates();
    async function load() {
      try {
        const res = await fetch('/data/players.json');
        if (!res.ok) throw new Error(`Failed to load player data (${res.status})`);
        const data: PlayerSeason[] = await res.json();
        setAllSeasons(data);

        // Try restoring today's saved state (skip when DEV_OVERRIDE is active)
        const saved = DEV_OVERRIDE ? null : loadSavedState();
        if (saved) {
          setGameState(saved);
          setMode(saved.mode);
        } else {
          // Generate fresh challenge
          const challenge: DailyChallenge = getDailyChallenge(data);
          const initial = createInitialState(challenge, mode);
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

    // Validate with human-readable rejection
    const validation = validateSelection(season, gameState);
    if (!validation.valid) {
      setRejectionMessage(validation.reason ?? 'Invalid selection');
      setTimeout(() => setRejectionMessage(null), 3000);
      return;
    }

    setRejectionMessage(null);
    const next = throwDart(gameState, season, allSeasons);
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

  function handleChangeMode(newMode: GameMode) {
    setMode(newMode);
    saveMode(newMode);
    if (gameState) {
      // Reset game with same challenge but new mode settings
      const initial = createInitialState(gameState.challenge, newMode);
      setGameState(initial);
      setShowShare(false);
      setRejectionMessage(null);
    }
  }

  function handleNewGame() {
    if (!allSeasons.length) return;
    const challenge = getDailyChallenge(allSeasons);
    const initial = createInitialState(challenge, mode);
    setGameState(initial);
    setShowShare(false);
    setDevConfigIndex(null);
  }

  // Dev mode: cycle through specific config indices
  function handleDevConfig(index: number) {
    if (!allSeasons.length) return;
    const wrappedIndex = ((index % CHALLENGE_CONFIGS.length) + CHALLENGE_CONFIGS.length) % CHALLENGE_CONFIGS.length;
    setDevConfigIndex(wrappedIndex);
    const challenge = getChallengeByIndex(allSeasons, wrappedIndex);
    const initial = createInitialState(challenge, mode);
    setGameState(initial);
    setShowShare(false);
    setRejectionMessage(null);
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-400">
        <img src="/icons/bullseye.png" alt="Loading..." className="w-12 h-12 object-contain animate-spin" />
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
  const usedPlayerIds = gameState.mode !== 'easy' ? getUsedPlayerIds(gameState) : undefined;
  const showTeams = gameState.mode !== 'hard';

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto pb-10">
      {/* Header */}
      <Header
        challenge={gameState.challenge}
        mode={mode}
        onChangeMode={handleChangeMode}
      />

      {/* Score display */}
      <div className="px-0 mt-2">
        <ScoreDisplay
          targetScore={gameState.challenge.targetScore}
          remainingScore={gameState.remainingScore}
          status={gameState.status}
          dartsThrown={gameState.darts.length}
          dartLimit={gameState.dartLimit}
          mode={gameState.mode}
          strikes={gameState.strikes}
          starRating={gameOver ? getStarRating(gameState) : undefined}
          statLabel={gameState.challenge.statLabel}
        />
      </div>

      {/* Dart rows (darts thrown so far) */}
      {gameState.darts.length > 0 && (
        <div className="mt-6 mx-4 relative bg-slate-900/50 backdrop-blur-sm border border-slate-800/80 rounded-xl shadow-xl shadow-black/40">
          <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/80 rounded-t-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Darts thrown</p>
          </div>
          <div className="flex flex-col">
            {gameState.darts.map((dart, i) => {
              const isLastDart = i === gameState.darts.length - 1;
              const isBust = gameState.status === 'bust' && isLastDart;
              // Strike = miss dart that didn't end the game (Easy mode, not the bust dart)
              const isStrike = dart.quality === 'miss' && !isBust;
              return (
                <DartRow
                  key={dart.playerSeason.id}
                  dart={dart}
                  index={i}
                  statLabel={gameState.challenge.statLabel}
                  isBust={isBust}
                  isStrike={isStrike}
                  showTeam={showTeams}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Search or game over actions */}
      <div className="mt-auto pt-6 space-y-3">
        {!gameOver ? (
          <>
            <PlayerSearch
              searchIndex={searchIndex}
              allSeasons={allSeasons}
              challengeStatKey={gameState.challenge.statKey}
              challengeSeasonStart={gameState.challenge.seasonStart ?? gameState.challenge.season}
              challengeSeasonEnd={gameState.challenge.seasonEnd}
              usedIds={usedIds}
              usedPlayerIds={usedPlayerIds}
              showTeams={showTeams}
              disabled={false}
              rejectionMessage={rejectionMessage}
              onSelect={handleThrowDart}
            />
            {/* Stand button — visible after first dart */}
            {gameState.darts.length > 0 && (
              <div className="px-4">
                <button
                  onClick={handleStand}
                  className="w-full py-3 rounded-full bg-slate-900/80 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  Stand — Lock in Score
                </button>
              </div>
            )}
            {/* How-to hint */}
            <p className="text-center text-xs text-slate-500 px-4">
              {gameState.challenge.threshold ? (
                <>
                  Search a player from{' '}
                  <strong className="text-slate-400">
                    {gameState.challenge.seasonStart
                      ? `${gameState.challenge.seasonStart}–${gameState.challenge.seasonEnd}`
                      : gameState.challenge.season}
                  </strong>{' '}
                  with <strong className="text-sky-400">{gameState.challenge.threshold}+ {gameState.challenge.thresholdStatLabel || gameState.challenge.statLabel}</strong> to subtract their {gameState.challenge.statLabel}.
                </>
              ) : (
                <>
                  Search a player from{' '}
                  <strong className="text-slate-400">
                    {gameState.challenge.seasonStart
                      ? `${gameState.challenge.seasonStart}–${gameState.challenge.seasonEnd}`
                      : gameState.challenge.season}
                  </strong>{' '}
                  to subtract their {gameState.challenge.statLabel}.
                </>
              )}
            </p>
            {/* Restriction Badges */}
            {gameState.challenge.restrictions && gameState.challenge.restrictions.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">
                ⚡ Only {r.label} count
              </div>
            ))}
          </>
        ) : (
          <div className="px-4 flex gap-3">
            <button
              onClick={() => setShowShare(true)}
              className="flex-1 py-3 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition-colors shadow-lg shadow-sky-900/20"
            >
              Share Result
            </button>
            <button
              onClick={handleNewGame}
              className="flex-1 py-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors border border-slate-700"
            >
              New Game
            </button>
          </div>
        )}
      </div>

      {/* Share modal */}
      {showShare && gameState && (
        <ShareModal
          gameState={gameState}
          allSeasons={allSeasons}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Dev Panel Toggle */}
      {import.meta.env.DEV && !showDevPanel && (
        <button
          onClick={() => setShowDevPanel(true)}
          className="fixed bottom-2 right-2 px-2 py-1 rounded bg-slate-800 text-slate-500 text-[10px] uppercase tracking-wider font-mono hover:bg-slate-700 hover:text-slate-300 z-50 opacity-30 hover:opacity-100 transition-all border border-slate-700 shadow-xl"
          title="Show Dev Panel"
        >
          Dev ⚙
        </button>
      )}

      {/* Dev panel */}
      {import.meta.env.DEV && showDevPanel && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-700 px-3 py-2 z-50 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDevPanel(false)}
              className="text-slate-500 font-mono font-bold hover:text-slate-300 transition-colors"
              title="Hide Dev Panel"
            >
              DEV ✕
            </button>
            <button
              onClick={() => handleDevConfig((devConfigIndex ?? 0) - 1)}
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
            >
              ◀
            </button>
            <input
              type="number"
              min={0}
              max={CHALLENGE_CONFIGS.length - 1}
              key={devConfigIndex}
              defaultValue={devConfigIndex ?? ''}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = parseInt(e.currentTarget.value, 10);
                  if (!isNaN(val)) handleDevConfig(val);
                  e.currentTarget.blur();
                }
              }}
              onBlur={e => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val !== devConfigIndex) handleDevConfig(val);
                e.target.value = devConfigIndex !== null ? String(devConfigIndex) : '';
              }}
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 font-mono w-[6ch] text-center focus:outline-none focus:ring-1 focus:ring-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              title="Enter config index (press Enter)"
              placeholder="—"
            />
            <button
              onClick={() => handleDevConfig((devConfigIndex ?? -1) + 1)}
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
            >
              ▶
            </button>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 truncate">
              {gameState && (
                <>
                  T=<strong className="text-amber-300">{gameState?.challenge.targetScore}</strong>
                  {' · '}Ghost={gameState?.challenge.ghostPath?.length ?? 0}
                  {' · '}Limit={gameState?.dartLimit === Infinity ? '∞' : gameState?.dartLimit}
                </>
              )}
            </span>
            <button
              onClick={handleNewGame}
              className="ml-auto px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
            >
              Today
            </button>
          </div>
          {gameState && (
            <div className="text-slate-500 font-mono truncate">
              {gameState?.challenge.description}
              {(gameState?.challenge.ghostPath?.length ?? 0) > 0 && (
                <> · Path: {gameState?.challenge.ghostPath?.map(s => `${s.name} (${s.statValue})`).join(' → ')}</>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
