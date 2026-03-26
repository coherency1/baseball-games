import type { Dart, DartQuality } from '../types/game';

interface DartRowProps {
  dart: Dart;
  index: number;
  statLabel: string;
  isBust: boolean;
  isStrike: boolean;   // Easy mode: overshoot that didn't end game
  showTeam?: boolean;  // false in Hard mode
}

const QUALITY_STYLES: Record<DartQuality, { border: string; text: string; bg: string }> = {
  bullseye: { border: 'border-emerald-500/80 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]', text: 'text-emerald-400', bg: 'bg-emerald-950/50' },
  great:    { border: 'border-emerald-500/40', text: 'text-emerald-500', bg: 'bg-emerald-950/30' },
  normal:   { border: 'border-slate-700',      text: 'text-slate-200',   bg: 'bg-slate-900/30' },
  miss:     { border: 'border-orange-500/50 shadow-[inset_0_0_15px_rgba(249,115,22,0.1)]',  text: 'text-orange-400',  bg: 'bg-orange-950/50' },
};

export function DartRow({ dart, index, statLabel, isBust, isStrike, showTeam = true }: DartRowProps) {
  const styles = isBust
    ? { border: 'border-red-500/50', text: 'text-red-500', bg: 'bg-red-500/10' }
    : isStrike
    ? QUALITY_STYLES.miss
    : (QUALITY_STYLES[dart.quality] ?? QUALITY_STYLES.normal);

  const isOvershoot = isBust || isStrike;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 border-b border-x ${styles.border} ${styles.bg} hover:bg-slate-800/80 transition-colors group last:rounded-b-xl animate-slide-in`}>
      {/* Dart number */}
      <span className="text-[10px] font-mono text-slate-500 w-5 shrink-0 text-center">{index + 1}</span>

      {/* Player info */}
      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <p className={`font-semibold text-sm truncate group-hover:text-white transition-colors ${styles.text}`}>
          {dart.playerSeason.name}
        </p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0">
          {dart.playerSeason.yearID}{showTeam ? ` · ${dart.playerSeason.teamID}` : ''}
        </p>
      </div>

      {/* Stat value */}
      <div className="text-right shrink-0 flex items-center gap-2">
        <span className="text-[9px] text-slate-600 uppercase tracking-widest">{statLabel}</span>
        <span className={`text-sm font-mono font-bold w-8 text-right ${styles.text}`}>
          −{dart.statValue}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-800/80 mx-1"></div>

      {/* Score change */}
      <div className="text-right shrink-0 w-12 flex flex-col items-end justify-center">
        <p className="text-[9px] text-slate-500 font-mono leading-none">{dart.previousScore}</p>
        <p className={`text-sm font-mono font-black leading-none mt-0.5 ${isOvershoot ? 'text-rose-500' : 'text-slate-200'}`}>
          {isOvershoot ? `+${Math.abs(dart.newScore)}` : dart.newScore}
        </p>
      </div>
    </div>
  );
}
