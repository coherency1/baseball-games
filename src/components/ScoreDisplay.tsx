import type { GameStatus, GameMode } from '../types/game';

interface ScoreDisplayProps {
  targetScore: number;
  remainingScore: number;
  status: GameStatus;
  dartsThrown: number;
  dartLimit: number;
  mode: GameMode;
  multiplierPreview?: number; // live multiplier for Normal/Hard
  strikes?: number;           // Easy mode: overshoot count (0–3)
}

const STATUS_CONFIG: Record<GameStatus, { label: string; color: string; bg: string }> = {
  playing:      { label: 'Remaining',      color: 'text-white',       bg: 'bg-slate-800' },
  perfect:      { label: '🎯 Bullseye!',   color: 'text-green-400',  bg: 'bg-green-900/30' },
  bust:         { label: '💥 Bust!',        color: 'text-red-400',    bg: 'bg-red-900/30' },
  standing:     { label: 'Final Score',     color: 'text-amber-400',  bg: 'bg-amber-900/30' },
  out_of_darts: { label: 'Out of Darts',    color: 'text-orange-400', bg: 'bg-orange-900/30' },
};

export function ScoreDisplay({ targetScore, remainingScore, status, dartsThrown, dartLimit, mode, multiplierPreview, strikes = 0 }: ScoreDisplayProps) {
  const cfg = STATUS_CONFIG[status];
  const progress = targetScore > 0 ? Math.max(0, (targetScore - remainingScore) / targetScore) : 0;
  const progressPct = Math.min(100, progress * 100);
  const hasDartLimit = dartLimit !== Infinity;

  return (
    <div className={`w-full max-w-2xl mx-auto px-4 py-5 rounded-2xl ${cfg.bg} border border-slate-700`}>
      {/* Score number */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">{cfg.label}</p>
        <div className={`text-7xl font-black tabular-nums leading-none ${cfg.color}`}>
          {remainingScore}
        </div>
        <p className="text-sm text-slate-500 mt-2">
          Target: <span className="text-slate-300 font-semibold">{targetScore}</span>
          {dartsThrown > 0 && (
            <span className="ml-3">
              Darts: <span className="text-slate-300 font-semibold">
                {dartsThrown}{hasDartLimit ? `/${dartLimit}` : ''}
              </span>
            </span>
          )}
          {/* Live multiplier preview for Normal/Hard */}
          {multiplierPreview !== undefined && mode !== 'easy' && status === 'playing' && dartsThrown > 0 && (
            <span className="ml-3 text-amber-400">
              {multiplierPreview}x
            </span>
          )}
        </p>
        {/* Strike counter for Easy mode */}
        {mode === 'easy' && strikes > 0 && status === 'playing' && (
          <p className="text-sm text-orange-400 font-semibold mt-1">
            ⚠️ {strikes}/3 strikes
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status === 'bust' ? 'bg-red-500' :
            status === 'perfect' ? 'bg-green-500' :
            status === 'out_of_darts' ? 'bg-orange-500' :
            progressPct > 80 ? 'bg-amber-400' :
            'bg-blue-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-slate-500">
        <span>{targetScore}</span>
        <span>0</span>
      </div>
    </div>
  );
}
