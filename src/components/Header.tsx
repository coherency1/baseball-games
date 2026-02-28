import type { DailyChallenge } from '../types/game';

interface HeaderProps {
  challenge: DailyChallenge | null;
  hardMode: boolean;
  onToggleHardMode: () => void;
}

export function Header({ challenge, hardMode, onToggleHardMode }: HeaderProps) {
  return (
    <header className="w-full max-w-2xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-3xl">🎯</span>
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

        {/* Challenge description */}
        {challenge && (
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-200">
              {challenge.description}
            </p>
            {challenge.restriction && (
              <p className="text-xs text-amber-400 mt-0.5">
                ⚡ {challenge.restriction.label}
              </p>
            )}
          </div>
        )}

        {/* Hard mode toggle */}
        <button
          onClick={onToggleHardMode}
          className={`
            ml-3 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
            ${hardMode
              ? 'bg-red-900/50 border-red-500 text-red-300'
              : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400'
            }
          `}
          title={hardMode ? 'Hard Mode: bust if you go over' : 'Easy Mode: distance from 0 is your score'}
        >
          {hardMode ? '🔴 HARD' : '🟢 EASY'}
        </button>
      </div>
    </header>
  );
}
