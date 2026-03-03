import type { DailyChallenge, GameMode } from '../types/game';

interface HeaderProps {
  challenge: DailyChallenge | null;
  mode: GameMode;
  onChangeMode: (mode: GameMode) => void;
}

const MODE_CONFIG: Record<GameMode, { label: string; color: string; activeColor: string }> = {
  easy:   { label: 'Easy',   color: 'text-slate-400', activeColor: 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]' },
  normal: { label: 'Normal', color: 'text-slate-400', activeColor: 'bg-sky-500/20 text-sky-400 border border-sky-500/50 shadow-[0_0_10px_rgba(14,165,233,0.2)]' },
  hard:   { label: 'Hard',   color: 'text-slate-400', activeColor: 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]' },
};

export function Header({ challenge, mode, onChangeMode }: HeaderProps) {
  return (
    <header className="w-full max-w-2xl mx-auto px-4 py-3 border-b border-slate-800 bg-slate-950 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/icons/bullseye.png" alt="Deadeye" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white leading-none">
              DEADEYE
            </h1>
            {challenge && (
              <p className="text-xs text-slate-400 mt-0.5">
                #{challenge.challengeNumber}
              </p>
            )}
          </div>
        </div>

        {/* Challenge descriptive badges */}
        {challenge && (
          <div className="flex-1 mx-3 flex flex-wrap gap-1.5 justify-end items-center">
            {/* Era Badge */}
            <div className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800/50 text-slate-300 text-[10px] uppercase font-bold tracking-wider">
              {challenge.seasonStart ? `${challenge.seasonStart}-${challenge.seasonEnd}` : challenge.season}
            </div>
            
            {/* Target Badge */}
            <div className="px-2 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.1)]">
              Score: {challenge.statLabel}
            </div>

            {/* Threshold Filter Badge */}
            {challenge.threshold && (
              <div className="px-2 py-0.5 rounded border border-sky-500/30 bg-sky-900/40 text-sky-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                Filter: {challenge.threshold}+ {challenge.thresholdStatLabel || challenge.statLabel}
              </div>
            )}

            {/* Restriction Badge */}
            {challenge.restriction && (
              <div className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.1)]">
                ⚡ {challenge.restriction.label}
              </div>
            )}
          </div>
        )}

        {/* Mode selector — segmented control */}
        <div className="flex gap-1 p-1 rounded-full border border-slate-800 bg-slate-900/50">
          {(['easy', 'normal', 'hard'] as GameMode[]).map(m => {
            const cfg = MODE_CONFIG[m];
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => onChangeMode(m)}
                className={`
                  px-3 py-1 text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer rounded-full border
                  ${isActive ? cfg.activeColor : `text-slate-500 hover:text-slate-300 hover:bg-slate-800 border-transparent`}
                `}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
