// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Share Text Generator
// Produces spoiler-free emoji result string per planning doc spec
// ─────────────────────────────────────────────────────────────────────────────

import type { GameState } from '../types/game';
import { getFinalScore, getDartsRemaining, getMultiplier, getStarRating } from './gameEngine';

// Record<string, string> for backward compat — old saves may have 'good'/'small'
const QUALITY_EMOJI: Record<string, string> = {
  bullseye: '🎯',
  great:    '🟢',
  normal:   '⚪',
  miss:     '❌',
};

/** Format a date like "Mar 1, 2026" */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone issues
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Generate share text per planning doc format:
 *
 *   🎯 Deadeye — Mar 1, 2026
 *   1998 MLB · Home Runs — Target: 291
 *
 *   🟢 → ⚪ → 🟢 → ⚪ → 🏳️
 *   ⭐⭐
 *
 *   Score: 42 | Normal
 */
export function generateShareText(state: GameState): string {
  const { challenge, darts, status } = state;

  const lines: string[] = [];

  // Line 1: Title with date
  lines.push(`🎯 Deadeye — ${formatDate(challenge.date)}`);

  // Line 2: Challenge descriptor with target
  // e.g. "1998 MLB · Home Runs — Target: 291"
  // or   "2010–2025 MLB · Strikeouts — Target: 1200"
  const yearLabel = challenge.seasonStart
    ? `${challenge.seasonStart}–${challenge.seasonEnd}`
    : String(challenge.season);
  let challengeLine = `${yearLabel} MLB · ${challenge.statLabel} — Target: ${challenge.targetScore}`;
  if (challenge.restriction) {
    challengeLine += ` (${challenge.restriction.label})`;
  }
  lines.push(challengeLine);

  lines.push('');

  // Dart emoji row with arrows — outcome emoji appended at end
  const dartEmojis = darts.map((d, i) => {
    if (status === 'bust' && i === darts.length - 1) return '💥';
    return QUALITY_EMOJI[d.quality] ?? '⚪';
  });

  // Append outcome emoji at end if not already shown in last dart
  if (status === 'standing') {
    dartEmojis.push('🏳️');
  } else if (status === 'out_of_darts') {
    // Last dart emoji already shown; no extra marker needed
    // but we could add a visual indicator
  }
  // 'perfect' (bullseye) and 'bust' are already represented in the last dart emoji

  lines.push(dartEmojis.join(' → ') || '–');

  // Star rating line (only for completed games)
  const stars = getStarRating(state);
  if (stars > 0) {
    lines.push('⭐'.repeat(stars));
  }

  lines.push('');

  // Score line with mode
  const finalScore = getFinalScore(state);
  const modeLabel = state.mode === 'hard' ? 'Hard' : state.mode === 'normal' ? 'Normal' : 'Easy';

  if (status === 'perfect') {
    lines.push(`Score: 0 (Bullseye!) | ${modeLabel}`);
  } else if (status === 'bust') {
    lines.push(`Score: Bust | ${modeLabel}`);
  } else if (state.mode !== 'easy') {
    const remaining = getDartsRemaining(state);
    const multiplier = getMultiplier(remaining);
    lines.push(`Score: ${finalScore} (${state.remainingScore} × ${multiplier}x) | ${modeLabel}`);
  } else {
    lines.push(`Score: ${finalScore} | ${modeLabel}`);
  }

  lines.push('');
  lines.push('Play: deadeye.game');

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
