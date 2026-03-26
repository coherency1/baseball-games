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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-700 bg-slate-900 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
            {status === 'perfect' ? 'Bullseye!' :
             status === 'bust' ? 'Busted!' :
             status === 'out_of_darts' ? 'Out of Darts' :
             'Stood'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Star rating & Badges */}
        {starRating > 0 && (
          <div className="px-6 py-4 text-center border-b border-slate-700">
            <div className="flex justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map(star => {
                // Only render up to the max stars achieved (or 3 for standard 3-star)
                if (star > Math.max(3, starRating)) return null;
                
                let opacityClass = "opacity-30 grayscale"; // Empty
                if (star <= starRating) {
                  if (starRating === 5) {
                    opacityClass = "drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]"; // Prismatic
                  } else if (starRating === 4) {
                    opacityClass = "drop-shadow-[0_0_8px_rgba(232,121,249,0.8)]"; // Electric Violet
                  } else if (starRating === 3) {
                    opacityClass = "drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"; // Gold
                  } else {
                    opacityClass = "drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]"; // Silver/Sky
                  }
                }

                return (
                  <span key={star} className={`transition-all duration-500 text-3xl flex items-center justify-center w-9 h-9 ${opacityClass}`}>
                    {starRating === 5 && star <= 5 
                      ? <span className="animate-pulse">♦</span> 
                      : <span>★</span>}
                  </span>
                );
              })}
            </div>
            
            {/* Rating Title */}
            <p className="text-sm font-bold tracking-widest uppercase mt-3 mb-1">
              {starRating === 5 ? <span className="text-cyan-300 drop-shadow-[0_0_5px_rgba(103,232,249,0.5)]">Flawless</span> :
               starRating === 4 ? <span className="text-fuchsia-400 drop-shadow-[0_0_5px_rgba(232,121,249,0.5)]">Perfect Bullseye</span> :
               starRating === 3 ? <span className="text-amber-400">Excellent</span> :
               starRating === 2 ? <span className="text-sky-300">Great Effort</span> :
               <span className="text-slate-400">Completed</span>}
            </p>
            
            {/* Badges */}
            {gameState.badges && gameState.badges.length > 0 && (
              <div className="flex justify-center flex-wrap gap-2 mt-3">
                {gameState.badges.includes('scenic_route') && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                    The Scenic Route
                  </span>
                )}
                {gameState.badges.includes('franchise_bonus') && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-950/50 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                    Franchise Bonus
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="px-6 py-5 space-y-3.5">
          <div className="flex justify-between items-start gap-4">
            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-1">Challenge</span>
            <div className="flex flex-col items-end gap-1">
              <span className="text-slate-200 font-semibold text-sm text-right">
                {challenge.seasonStart ? `${challenge.seasonStart}-${challenge.seasonEnd}` : challenge.season} MLB · {challenge.statLabel}
              </span>
              {(challenge.threshold || (challenge.restrictions && challenge.restrictions.length > 0)) && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {challenge.threshold && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-900/40 text-sky-400 border border-sky-400/30 rounded-full text-[10px] font-bold tracking-wider uppercase">
                      {challenge.threshold}+ {challenge.thresholdStatLabel}
                    </div>
                  )}
                  {challenge.restrictions && challenge.restrictions.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-bold tracking-wider uppercase">
                      ⚡ {r.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">Target</span>
            <span className="text-sky-400 font-mono font-bold">{challenge.targetScore}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">Darts thrown</span>
            <span className="text-slate-200 font-mono font-bold">
              {darts.length}{gameState.dartLimit !== Infinity ? <span className="text-slate-600"> / {gameState.dartLimit}</span> : ''}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">Distance</span>
            <span className={`font-mono font-bold flex items-center gap-1.5 ${
              status === 'perfect' ? 'text-emerald-400' :
              status === 'bust' ? 'text-rose-500' :
              'text-slate-200'
            }`}>
              {status === 'perfect' ? '0' : remainingScore}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-800/50 pt-3.5">
            <span className="text-slate-300 text-xs font-bold uppercase tracking-widest">Final Score</span>
            <span className={`font-mono font-black text-2xl ${
              status === 'perfect' ? 'text-emerald-400' :
              status === 'bust' ? 'text-rose-500' :
              finalScore === 0 ? 'text-emerald-400' :
              'text-amber-400'
            }`}>
              {status === 'bust' ? 'BUST' : finalScore}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">Mode</span>
            <span className={`font-bold text-xs uppercase tracking-wider ${
              gameState.mode === 'hard' ? 'text-rose-400' :
              gameState.mode === 'normal' ? 'text-sky-400' :
              'text-emerald-400'
            }`}>
              {modeLabel}
            </span>
          </div>
        </div>

        {/* Spoiler reveal — shown when game didn't end in bullseye */}
        {status !== 'perfect' && (
          <div className="px-6 pb-4">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full py-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-700 text-slate-300 font-bold text-[11px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                Reveal Solution
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
        <div className="px-6 pb-5">
          <pre className="bg-slate-950 rounded-xl p-4 text-slate-400 whitespace-pre-wrap font-mono text-[10px] leading-relaxed border border-slate-800 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
            {shareText}
          </pre>
        </div>

        {/* Copy button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleCopy}
            className={`
              w-full py-3.5 rounded-full font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg
              ${copied
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 shadow-emerald-900/20'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/20'
              }
            `}
          >
            {copied ? 'COPIED TO CLIPBOARD' : 'COPY RESULT'}
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
    <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4">
      <p className="text-[10px] uppercase font-bold tracking-widest text-amber-500/80 mb-3">
        WOULD HAVE FINISHED ({remainingScore} REMAINING)
      </p>
      {finishers.single && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-200 font-semibold text-sm">
            {finishers.single.name}{' '}
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider ml-1">{finishers.single.yearID} · {finishers.single.teamID}</span>
          </span>
          <span className="text-amber-400 font-mono text-xs font-bold">
            {getStatValue(finishers.single, statKey)} <span className="text-[9px] text-amber-500/70">{statLabel}</span>
          </span>
        </div>
      )}
      {finishers.pair && (
        <div className="space-y-2">
          {finishers.pair.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-200 font-semibold text-sm">
                {p.name}{' '}
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider ml-1">{p.yearID} · {p.teamID}</span>
              </span>
              <span className="text-amber-400 font-mono text-xs font-bold w-12 text-right">
                {getStatValue(p, statKey)}
              </span>
            </div>
          ))}
          <div className="text-right text-[10px] font-mono font-bold text-amber-500/70 uppercase tracking-widest border-t border-amber-900/30 pt-2 mt-2">
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
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-3">
        OPTIMAL PATH ({ghostPath.length} DARTS)
      </p>
      <div className="space-y-2">
        {ghostPath.map((step, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-slate-300 font-semibold text-sm">
              {step.name}{' '}
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider ml-1">{step.yearID} · {step.teamID}</span>
            </span>
            <span className="text-slate-400 font-mono text-xs font-bold w-12 text-right">
              {step.statValue}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest border-t border-slate-700/50 flex justify-between">
        <span>{ghostPath.length} DARTS · {statLabel}</span>
        <span>= {totalStat}</span>
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

  // Check restrictions if applicable
  // (Skip restrictions check for finisher — show any valid player from the pool)
  let hintPool = pool;
  const isFinishing = gameState.status === 'out_of_darts';
  if (!isFinishing && challenge.restrictions && challenge.restrictions.length > 0) {
    for (const r of challenge.restrictions) {
      if (r.type === 'hof') hintPool = hintPool.filter(p => p.isHOF);
      else if (r.type === 'allstar') hintPool = hintPool.filter(p => p.isAllStar);
      else if (r.type === 'ws_winner') hintPool = hintPool.filter(p => p.wonWorldSeries);
      else if (r.type === 'award') hintPool = hintPool.filter(p => r.value && p.awards.includes(r.value));
      else if (r.type === 'rookie') hintPool = hintPool.filter(p => p.isRookie);
    }
  }

  // Single player: stat value === remaining
  const single = hintPool.find(p => getStatValue(p, challenge.statKey) === remainingScore);
  if (single) return { single };

  // Two-player pair (two-sum): find pair summing to remaining
  const valueMap = new Map<number, PlayerSeason>();
  for (const p of hintPool) {
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
