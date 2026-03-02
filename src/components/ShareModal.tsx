import { useState } from 'react';
import type { GameState, GhostStep, PlayerSeason } from '../types/game';
import { generateShareText, copyToClipboard } from '../lib/shareText';
import { getFinalScore, getStarRating, getStatValue } from '../lib/gameEngine';

interface ShareModalProps {
  gameState: GameState;
  allSeasons: PlayerSeason[];
  onClose: () => void;
}

export function ShareModal({ gameState, allSeasons, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const shareText = generateShareText(gameState);

  async function handleCopy() {
    const ok = await copyToClipboard(shareText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const { status, remainingScore, challenge, darts } = gameState;
  const finalScore = getFinalScore(gameState);
  const modeLabel = gameState.mode === 'hard' ? 'Hard' : gameState.mode === 'normal' ? 'Normal' : 'Easy';
  const starRating = getStarRating(gameState);
  const finishers = findFinishers(allSeasons, gameState);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">
            {status === 'perfect' ? '🎯 Bullseye!' :
             status === 'bust' ? '💥 Busted!' :
             status === 'out_of_darts' ? '⏱️ Out of Darts' :
             '🏳️ Stood'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Star rating */}
        {starRating > 0 && (
          <div className="px-6 py-4 text-center border-b border-slate-700">
            <p className="text-4xl tracking-wider">
              {'⭐'.repeat(starRating)}{'☆'.repeat(3 - starRating)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {starRating === 3 ? 'Optimal play!' :
               starRating === 2 ? 'Near optimal' :
               'Completed'}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="px-6 py-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Challenge</span>
            <span className="text-white font-semibold text-sm text-right">{challenge.description}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Target</span>
            <span className="text-white font-semibold">{challenge.targetScore}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Darts thrown</span>
            <span className="text-white font-semibold">
              {darts.length}{gameState.dartLimit !== Infinity ? ` / ${gameState.dartLimit}` : ''}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Distance</span>
            <span className={`font-bold ${
              status === 'perfect' ? 'text-green-400' :
              status === 'bust' ? 'text-red-400' :
              'text-white'
            }`}>
              {status === 'perfect' ? '0 🎯' : remainingScore}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-700 pt-3">
            <span className="text-slate-300 text-sm font-semibold">Final Score</span>
            <span className={`font-black text-xl ${
              status === 'perfect' ? 'text-green-400' :
              status === 'bust' ? 'text-red-400' :
              finalScore === 0 ? 'text-green-400' :
              'text-amber-400'
            }`}>
              {status === 'bust' ? 'Bust' : finalScore}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Mode</span>
            <span className={`font-semibold text-sm ${
              gameState.mode === 'hard' ? 'text-red-400' :
              gameState.mode === 'normal' ? 'text-blue-400' :
              'text-green-400'
            }`}>
              {modeLabel}
            </span>
          </div>
        </div>

        {/* Spoiler reveal — shown when game didn't end in bullseye */}
        {status !== 'perfect' && (
          <div className="px-6 pb-3">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700/80 text-slate-300 font-bold text-sm transition-colors"
              >
                👁️ Reveal Solution
              </button>
            ) : (
              <div className="space-y-3">
                {/* What would have finished (from current position) */}
                {finishers && remainingScore > 0 && (
                  <FinisherSection
                    finishers={finishers}
                    remainingScore={remainingScore}
                    statLabel={challenge.statLabel}
                    statKey={challenge.statKey}
                  />
                )}

                {/* Ghost path (optimal from scratch) */}
                {challenge.ghostPath && challenge.ghostPath.length > 0 && (
                  <GhostPathSection ghostPath={challenge.ghostPath} statLabel={challenge.statLabel} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Share text preview */}
        <div className="px-6 pb-4">
          <pre className="bg-slate-800 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap font-mono text-xs leading-relaxed border border-slate-700">
            {shareText}
          </pre>
        </div>

        {/* Copy button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleCopy}
            className={`
              w-full py-3 rounded-xl font-bold text-sm transition-all
              ${copied
                ? 'bg-green-700 text-green-100 border border-green-600'
                : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500'
              }
            `}
          >
            {copied ? '✅ Copied!' : '📋 Copy Result'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Finisher Section — what would have closed out from remaining ─────────────

interface FinisherInfo {
  single?: PlayerSeason;
  pair?: [PlayerSeason, PlayerSeason];
}

function FinisherSection({ finishers, remainingScore, statLabel, statKey }: {
  finishers: FinisherInfo;
  remainingScore: number;
  statLabel: string;
  statKey: string;
}) {
  return (
    <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
      <p className="text-xs uppercase tracking-widest text-amber-500 mb-2">
        Would have finished ({remainingScore} remaining)
      </p>
      {finishers.single && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-200">
            {finishers.single.name}{' '}
            <span className="text-slate-500">{finishers.single.yearID} · {finishers.single.teamID}</span>
          </span>
          <span className="text-amber-400 font-mono text-xs font-bold">
            {getStatValue(finishers.single, statKey)} {statLabel}
          </span>
        </div>
      )}
      {finishers.pair && (
        <div className="space-y-1.5">
          {finishers.pair.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-200">
                {p.name}{' '}
                <span className="text-slate-500">{p.yearID} · {p.teamID}</span>
              </span>
              <span className="text-amber-400 font-mono text-xs font-bold">
                {getStatValue(p, statKey)}
              </span>
            </div>
          ))}
          <div className="text-right text-xs text-slate-500">
            = {finishers.pair.reduce((s, p) => s + getStatValue(p, statKey), 0)} {statLabel}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ghost Path Section ────────────────────────────────────────────────────────

function GhostPathSection({ ghostPath, statLabel }: { ghostPath: GhostStep[]; statLabel: string }) {
  const totalStat = ghostPath.reduce((sum, step) => sum + step.statValue, 0);
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">
        Optimal path ({ghostPath.length} darts)
      </p>
      <div className="space-y-1.5">
        {ghostPath.map((step, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-slate-300">
              {step.name}{' '}
              <span className="text-slate-500">{step.yearID} · {step.teamID}</span>
            </span>
            <span className="text-slate-400 font-mono text-xs">
              {step.statValue}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between text-xs">
        <span className="text-slate-500">{ghostPath.length} darts · {statLabel}</span>
        <span className="text-slate-400 font-semibold">= {totalStat}</span>
      </div>
    </div>
  );
}

// ── Find player(s) that would have closed out from remaining score ───────────

function findFinishers(
  allSeasons: PlayerSeason[],
  gameState: GameState,
): FinisherInfo | null {
  const { challenge, remainingScore, status } = gameState;
  if (status === 'perfect' || remainingScore <= 0) return null;

  const usedPlayerIds = new Set(gameState.darts.map(d => d.playerSeason.playerID));
  const usedSeasonIds = new Set(gameState.darts.map(d => d.playerSeason.id));

  const pool = allSeasons.filter(p => {
    // Year range check
    const inYear = challenge.seasonStart !== undefined
      ? p.yearID >= challenge.seasonStart && p.yearID <= (challenge.seasonEnd ?? challenge.seasonStart)
      : p.yearID === challenge.season;
    if (!inYear) return false;

    const val = getStatValue(p, challenge.statKey);
    if (val <= 0) return false;

    // Not already used
    if (gameState.mode === 'easy') {
      if (usedSeasonIds.has(p.id)) return false;
    } else {
      if (usedPlayerIds.has(p.playerID)) return false;
    }

    return true;
  });

  // Check restriction if applicable
  // (Skip restriction check for finisher — show any valid player from the pool)

  // Single player: stat value === remaining
  const single = pool.find(p => getStatValue(p, challenge.statKey) === remainingScore);
  if (single) return { single };

  // Two-player pair (two-sum): find pair summing to remaining
  const valueMap = new Map<number, PlayerSeason>();
  for (const p of pool) {
    const v = getStatValue(p, challenge.statKey);
    const complement = remainingScore - v;
    if (complement > 0 && valueMap.has(complement)) {
      const other = valueMap.get(complement)!;
      // Different players
      const isDifferent = gameState.mode === 'easy'
        ? other.id !== p.id
        : other.playerID !== p.playerID;
      if (isDifferent) {
        return v >= complement
          ? { pair: [p, other] }
          : { pair: [other, p] };
      }
    }
    // Only store first occurrence per value for clean results
    if (!valueMap.has(v)) valueMap.set(v, p);
  }

  return null;
}
