import type { Dart, DartQuality } from '../types/game';

interface DartRowProps {
  dart: Dart;
  index: number;
  statLabel: string;
  isBust: boolean;
}

const QUALITY_STYLES: Record<DartQuality, { border: string; badge: string; emoji: string }> = {
  bullseye: { border: 'border-green-400',  badge: 'bg-green-900/50 text-green-300', emoji: '🎯' },
  great:    { border: 'border-green-600',  badge: 'bg-green-900/40 text-green-400', emoji: '🟢' },
  good:     { border: 'border-yellow-600', badge: 'bg-yellow-900/40 text-yellow-400', emoji: '🟡' },
  small:    { border: 'border-red-800',    badge: 'bg-red-900/30 text-red-400', emoji: '🔴' },
};

export function DartRow({ dart, index, statLabel, isBust }: DartRowProps) {
  const styles = isBust
    ? { border: 'border-red-500', badge: 'bg-red-900/50 text-red-300', emoji: '💥' }
    : QUALITY_STYLES[dart.quality];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${styles.border} bg-slate-800/50`}>
      {/* Dart number */}
      <span className="text-xs text-slate-500 w-5 shrink-0 text-center">#{index + 1}</span>

      {/* Quality emoji */}
      <span className="text-lg w-6 text-center">{styles.emoji}</span>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate text-sm">
          {dart.playerSeason.name}
        </p>
        <p className="text-xs text-slate-400">
          {dart.playerSeason.yearID} · {dart.playerSeason.teamID}
        </p>
      </div>

      {/* Stat value */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${styles.badge.includes('green') ? 'text-green-400' : styles.badge.includes('yellow') ? 'text-yellow-400' : styles.badge.includes('red') ? 'text-red-400' : 'text-white'}`}>
          −{dart.statValue}
        </p>
        <p className="text-xs text-slate-500">{statLabel}</p>
      </div>

      {/* Score change */}
      <div className={`text-right shrink-0 px-2 py-1 rounded-lg ${styles.badge}`}>
        <p className="text-xs text-slate-400 leading-none">{dart.previousScore}</p>
        {isBust
          ? <p className="text-sm font-black leading-none">+{Math.abs(dart.newScore)} over</p>
          : <p className="text-sm font-black leading-none">→ {Math.abs(dart.newScore)}</p>
        }
      </div>
    </div>
  );
}
