import type { GameStatus, GameMode } from '../types/game';

interface ScoreDisplayProps {
  targetScore: number;
  remainingScore: number;
  status: GameStatus;
  dartsThrown: number;
  dartLimit: number;
  mode: GameMode;
  strikes?: number;           // Easy mode: overshoot count (0–3)
  starRating?: number;        // 0-3, only provided when game is over
}

const STATUS_CONFIG: Record<GameStatus, { label: React.ReactNode; color: string; bg: string }> = {
  playing:      { label: 'REMAINING',      color: 'text-rose-500',    bg: 'bg-slate-900 border-slate-700' },
  perfect:      { label: <span className="flex items-center gap-1.5"><img src="/icons/bullseye.png" alt="Bullseye" className="w-3.5 h-3.5"/> BULLSEYE</span>,    color: 'text-emerald-400', bg: 'bg-emerald-950 border-emerald-900/80 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]' },
  bust:         { label: <span className="flex items-center gap-1.5"><img src="/icons/bust.png" alt="Bust" className="w-3.5 h-3.5"/> BUSTED</span>,      color: 'text-red-500',     bg: 'bg-red-950 border-red-900/80 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]' },
  standing:     { label: 'FINAL SCORE',    color: 'text-amber-400',   bg: 'bg-amber-950 border-amber-900/80 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' },
  out_of_darts: { label: 'OUT OF DARTS',   color: 'text-orange-400',  bg: 'bg-orange-950 border-orange-900/80 shadow-[inset_0_0_20px_rgba(249,115,22,0.1)]' },
};

export function ScoreDisplay({ targetScore, remainingScore, status, dartsThrown, dartLimit, mode, strikes = 0, starRating }: ScoreDisplayProps) {
  const cfg = STATUS_CONFIG[status];
  const progress = targetScore > 0 ? Math.max(0, (targetScore - remainingScore) / targetScore) : 0;
  const progressPct = Math.min(100, progress * 100);
  const hasDartLimit = dartLimit !== Infinity;

  return (
    <div className={`w-full max-w-2xl mx-auto px-5 py-5 rounded-2xl ${cfg.bg} border backdrop-blur-sm shadow-xl shadow-black/40`}>
      {/* Score number */}
      <div className="flex flex-col items-center">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">{cfg.label}</p>
        <div className={`text-7xl font-mono font-black tabular-nums leading-none tracking-tighter ${cfg.color}`}>
          {remainingScore}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs uppercase tracking-wider font-bold">
          <div className="flex flex-col items-center">
            <span className="text-slate-500 text-[9px]">TARGET</span>
            <span className="text-sky-400 font-mono text-sm">{targetScore}</span>
          </div>
          <div className="w-px h-6 bg-slate-800"></div>
          <div className="flex flex-col items-center">
            <span className="text-slate-500 text-[9px]">DARTS</span>
            <span className="text-slate-300 font-mono text-sm">
              {dartsThrown}{hasDartLimit ? <span className="text-slate-600">/{dartLimit}</span> : ''}
            </span>
          </div>
          {mode === 'easy' && status === 'playing' && (
            <>
              <div className="w-px h-6 bg-slate-800"></div>
              <div className="flex flex-col items-center">
                <span className="text-slate-500 text-[9px]">STRIKES</span>
                <span className={`${strikes > 0 ? 'text-orange-400' : 'text-slate-300'} font-mono text-sm`}>
                  {strikes}/3
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Star rating (end-game only) */}
        {starRating !== undefined && starRating > 0 && status !== 'playing' && (
          <div className="flex gap-1.5 mt-4 justify-center items-center h-8 drop-shadow-md">
            {starRating === 5 ? (
              Array(5).fill(0).map((_, i) => <img key={i} src="/icons/diamond.png" alt="Diamond" className="w-6 h-6 animate-pulse" />)
            ) : starRating === 4 ? (
              Array(4).fill(0).map((_, i) => <img key={i} src="/icons/crystal.png" alt="Crystal" className="w-6 h-6 animate-pulse" />)
            ) : (
              <>
                {Array(starRating).fill(0).map((_, i) => <img key={`full-${i}`} src="/icons/star.png" alt="Star" className="w-6 h-6 drop-shadow-md" />)}
                {Array(Math.max(0, 3 - starRating)).fill(0).map((_, i) => <img key={`empty-${i}`} src="/icons/star.png" alt="Empty Star" className="w-6 h-6 opacity-30 grayscale" />)}
              </>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-5 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-900/50">
        <div
          className={`h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
            status === 'bust' ? 'bg-red-500 shadow-red-500/50' :
            status === 'perfect' ? 'bg-emerald-400 shadow-emerald-400/50' :
            status === 'out_of_darts' ? 'bg-orange-500 shadow-orange-500/50' :
            progressPct > 80 ? 'bg-amber-400 shadow-amber-400/50' :
            'bg-rose-500 shadow-rose-500/50'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
