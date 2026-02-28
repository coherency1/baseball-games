import { useState } from 'react';
import type { GameState } from '../types/game';
import { generateShareText, copyToClipboard } from '../lib/shareText';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">
            {status === 'perfect' ? '🎯 Bullseye!' :
             status === 'bust' ? '💥 Busted!' :
             '📊 Results'}
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
            <span className="text-slate-400 text-sm">Final Score</span>
            <span className={`font-black text-xl ${
              status === 'perfect' ? 'text-green-400' :
              status === 'bust' ? 'text-red-400' :
              'text-amber-400'
            }`}>
              {remainingScore} {status === 'perfect' ? '🎯' : ''}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Darts thrown</span>
            <span className="text-white font-semibold">{darts.length}</span>
          </div>
          {gameState.hardMode && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Mode</span>
              <span className="text-red-400 font-semibold text-sm">🔴 Hard</span>
            </div>
          )}
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
