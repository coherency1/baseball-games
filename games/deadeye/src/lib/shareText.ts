// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Share Text Generator
// Produces spoiler-free emoji result string per planning doc spec
// ─────────────────────────────────────────────────────────────────────────────

import type { GameState } from '../types/game';
import { getFinalScore, getStarRating } from './gameEngine';

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
  if (challenge.restrictions && challenge.restrictions.length > 0) {
    const labels = challenge.restrictions.map(r => r.label).join(', ');
    challengeLine += ` (${labels})`;
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
    if (stars === 5) {
      lines.push('💎💎💎💎💎'); // Prismatic / Flawless
    } else if (stars === 4) {
      lines.push('🔮🔮🔮🔮');   // Perfect Bullseye
    } else {
      lines.push('⭐'.repeat(stars));
    }
  }

  // Append secret badges if any
  if (state.badges && state.badges.length > 0) {
    const badgeChars = state.badges.map(b => {
      if (b === 'scenic_route') return '🏕️';
      if (b === 'franchise_bonus') return '🏢';
      return '';
    }).filter(Boolean);
    
    if (badgeChars.length > 0) {
      lines.push(badgeChars.join(' '));
    }
  }

  lines.push('');

  // Score line with mode
  const finalScore = getFinalScore(state);
  const modeLabel = state.mode === 'hard' ? 'Hard' : state.mode === 'normal' ? 'Normal' : 'Easy';

  if (status === 'perfect') {
    lines.push(`Score: 0 (Bullseye!) | ${modeLabel}`);
  } else if (status === 'bust') {
    lines.push(`Score: Bust (${state.remainingScore}) | ${modeLabel}`);
  } else {
    lines.push(`Score: ${finalScore} | ${modeLabel}`);
  }

  lines.push('');
  lines.push('Play: deadeye.game');

  return lines.join('\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern clipboard API first
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API failed (permissions, focus, etc.) — try fallback
  }
  // Fallback: hidden textarea + execCommand
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
