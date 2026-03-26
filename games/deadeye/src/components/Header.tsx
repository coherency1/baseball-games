import type { DailyChallenge, GameMode } from '../types/game';

interface HeaderProps {
  challenge: DailyChallenge | null;
  mode: GameMode;
  onChangeMode: (mode: GameMode) => void;
}

function getShortStatLabel(label: string): string {
  const map: Record<string, string> = {
    'Strikeouts': 'K',
    'Home Runs': 'HR',
    'Runs Batted In': 'RBI',
    'Hits': 'H',
    'Wins': 'W',
    'Stolen Bases': 'SB',
    'Walks': 'BB',
    'Saves': 'SV',
    'Doubles': '2B',
    'Triples': '3B',
    'Runs': 'R',
  };
  return map[label] || label;
}

const MODE_CONFIG: Record<GameMode, { label: string; color: string; activeColor: string }> = {
  easy:   { label: 'Easy',   color: 'text-slate-400', activeColor: 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]' },
  normal: { label: 'Normal', color: 'text-slate-400', activeColor: 'bg-sky-500/20 text-sky-400 border border-sky-500/50 shadow-[0_0_10px_rgba(14,165,233,0.2)]' },
  hard:   { label: 'Hard',   color: 'text-slate-400', activeColor: 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]' },
};

export function Header({ challenge, mode, onChangeMode }: HeaderProps) {
  return (
    <header className="w-full max-w-2xl mx-auto px-4 py-3 border-b border-slate-800 bg-slate-900/85 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black tracking-tight text-white leading-none flex items-baseline gap-2">
            DEADEYE
            {challenge && (
              <span className="text-xs text-slate-400 font-bold tracking-widest">
                #{challenge.challengeNumber}
              </span>
            )}
          </h1>
        </div>

        {/* Challenge descriptive badges */}
        {challenge && (
          <div className="flex-1 mx-4 flex flex-wrap gap-2 justify-end items-center">
            {/* Era Badge */}
            <div className="px-2.5 py-1 rounded-md border border-slate-700 bg-slate-800/50 text-slate-300 text-[10px] uppercase font-bold tracking-wider leading-none flex items-center h-7">
              {challenge.seasonStart ? `${challenge.seasonStart}-${challenge.seasonEnd}` : challenge.season}
            </div>

            {/* Threshold Filter Badge */}
            {challenge.threshold && (
              <div className="px-2.5 py-1 rounded-md border border-sky-500/30 bg-sky-900/40 text-sky-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 leading-none h-7">
                [{challenge.thresholdStatKey === 'AVG' ? '' : `${challenge.threshold}+ `}{getShortStatLabel(challenge.thresholdStatLabel || challenge.statLabel)}]
              </div>
            )}

            {/* Restriction Badges */}
            {challenge.restrictions && challenge.restrictions.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[9px] md:text-[10px] font-bold tracking-wider uppercase shadow-sm whitespace-nowrap">
                {r.label}
              </div>
            ))}
          </div>
        )}

        {/* Mode selector — segmented control */}
        <div className="flex gap-1 p-0.5 rounded-md border border-slate-700 bg-slate-800/50 h-8 items-center">
          {(['easy', 'normal', 'hard'] as GameMode[]).map(m => {
            const cfg = MODE_CONFIG[m];
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => onChangeMode(m)}
                className={`
                  px-3 flex items-center justify-center h-full text-[10px] uppercase tracking-wider font-bold transition-all cursor-pointer rounded border
                  ${isActive ? cfg.activeColor : `text-slate-500 hover:text-slate-300 hover:bg-slate-700 border-transparent`}
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
