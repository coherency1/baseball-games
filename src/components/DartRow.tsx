import type { Dart, DartQuality } from '../types/game';

interface DartRowProps {
  dart: Dart;
  index: number;
  statLabel: string;
  isBust: boolean;
  isStrike: boolean;   // Easy mode: overshoot that didn't end game
  showTeam?: boolean;  // false in Hard mode
}

const QUALITY_STYLES: Record<DartQuality, { border: string; badge: string; emoji: string }> = {
  bullseye: { border: 'border-green-400',  badge: 'bg-green-900/50 text-green-300', emoji: '🎯' },
  great:    { border: 'border-green-600',  badge: 'bg-green-900/40 text-green-400', emoji: '🟢' },
  normal:   { border: 'border-slate-600',  badge: 'bg-slate-800/40 text-slate-300', emoji: '⚪' },
  miss:     { border: 'border-orange-600', badge: 'bg-orange-900/40 text-orange-400', emoji: '❌' },
};

export function DartRow({ dart, index, statLabel, isBust, isStrike, showTeam = true }: DartRowProps) {
  const styles = isBust
    ? { border: 'border-red-500', badge: 'bg-red-900/50 text-red-300', emoji: '💥' }
    : isStrike
    ? QUALITY_STYLES.miss
    : (QUALITY_STYLES[dart.quality] ?? QUALITY_STYLES.normal);

  const isOvershoot = isBust || isStrike;

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
          {dart.playerSeason.yearID}{showTeam ? ` · ${dart.playerSeason.teamID}` : ''}
        </p>
      </div>

      {/* Stat value */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${styles.badge.includes('green') ? 'text-green-400' : styles.badge.includes('orange') ? 'text-orange-400' : 'text-slate-300'}`}>
          −{dart.statValue}
        </p>
        <p className="text-xs text-slate-500">{statLabel}</p>
      </div>

      {/* Score change */}
      <div className={`text-right shrink-0 px-2 py-1 rounded-lg ${styles.badge}`}>
        <p className="text-xs text-slate-400 leading-none">{dart.previousScore}</p>
        {isOvershoot
          ? <p className="text-sm font-black leading-none">+{Math.abs(dart.newScore)} over</p>
          : <p className="text-sm font-black leading-none">→ {dart.newScore}</p>
        }
      </div>
    </div>
  );
}
