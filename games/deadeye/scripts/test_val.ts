import { getDailyChallenge } from '../src/lib/dailyChallenge';
import { readFileSync } from 'fs';
const dataPath = './public/data/players.json';
const players = JSON.parse(readFileSync(dataPath, 'utf-8'));

// Test validate directly on an Era Config
import { deduplicatePool, filterByRestrictions } from '../src/lib/dailyChallenge';
const p10 = players.filter(p => p.yearID >= 1990 && p.yearID <= 1999 && p.HR > 0);
const r1 = filterByRestrictions(p10, [{ type: 'hr_leader', label: 'HR leaders only' }]);
const d1 = deduplicatePool(r1, 'HR');
console.log('1990-1999 HR leaders filter count:', r1.length);
console.log('1990-1999 HR leaders dedupe count:', d1.length);
