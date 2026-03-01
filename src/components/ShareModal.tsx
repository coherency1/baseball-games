import { useState } from 'react';
import type { GameState } from '../types/game';
import { generateShareText, copyToClipboard } from '../lib/shareText';
import { getFinalScore, getDartsRemaining, getMultiplier } from '../lib/gameEngine';

interface ShareModalProps {
  gameState: GameState;
  onClose: () => void;
}

export function ShareModal({ gameState, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const shareText = generateShareText(gameState);

  async function handleCopy() {
    await copyToClipboard(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const { status, remainingScore, challenge, darts } = gameState;
  const finalScore = getFinalScore(gameState);
  const modeLabel = gameState.mode === 'hard' ? 'Hard' : gameState.mode === 'normal' ? 'Normal' : 'Easy';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
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
          {gameState.mode !== 'easy' && status !== 'perfect' && status !== 'bust' && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">
                Multiplier ({getDartsRemaining(gameState)} darts left)
              </span>
              <span className="text-amber-400 font-semibold">
                {getMultiplier(getDartsRemaining(gameState))}x
              </span>
            </div>
          )}
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
