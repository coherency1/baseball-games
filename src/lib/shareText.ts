// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Share Text Generator
// Produces Wordle-style copy-pasteable emoji result strings
// ─────────────────────────────────────────────────────────────────────────────

import type { GameState, DartQuality } from '../types/game';

const QUALITY_EMOJI: Record<DartQuality, string> = {
  bullseye: '🎯',
  great:    '🟢',
  good:     '🟡',
  small:    '🔴',
};

function getBustEmoji(): string {
  return '💥';
}

export function generateShareText(state: GameState): string {
  const { challenge, darts, status, remainingScore } = state;

  const lines: string[] = [];

  // Header
  lines.push(`🎯 Deadeye #${challenge.challengeNumber}`);
  lines.push(`📊 ${challenge.description}`);

  // Result line
  const dartCount = darts.length;
  let resultLine = `Target: ${challenge.targetScore}`;

  if (status === 'perfect') {
    resultLine += ` · 🎯 Bullseye! · ${dartCount} dart${dartCount !== 1 ? 's' : ''}`;
  } else if (status === 'bust') {
    resultLine += ` · 💥 Bust · ${dartCount} dart${dartCount !== 1 ? 's' : ''}`;
  } else {
    resultLine += ` · ${remainingScore} left · ${dartCount} dart${dartCount !== 1 ? 's' : ''}`;
  }
  lines.push(resultLine);

  // Mode indicator
  if (state.hardMode) lines.push('🔴 Hard Mode');

  // Restriction
  if (challenge.restriction) {
    lines.push(`⚡ ${challenge.restriction.label}`);
  }

  lines.push('');

  // Dart emojis
  const emojiRow = darts.map((d, i) => {
    if (status === 'bust' && i === darts.length - 1) return getBustEmoji();
    return QUALITY_EMOJI[d.quality];
  }).join('');

  lines.push(emojiRow || '–');
  lines.push('');
  lines.push('🎯 Play Deadeye: deadeye.game');

  return lines.join('\n');
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}
