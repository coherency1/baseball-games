import { getDailyChallenge } from '../src/lib/dailyChallenge';
import { readFileSync } from 'fs';
const dataPath = './public/data/players.json';
const players = JSON.parse(readFileSync(dataPath, 'utf-8'));

for (let i = 0; i < 30; i++) {
  const d = new Date(Date.now() + i * 24 * 3600 * 1000).toISOString().split('T')[0];
  const save = Date.prototype.toISOString;
  Date.prototype.toISOString = function () { return d + 'T00:00:00Z'; };
  const c = getDailyChallenge(players);
  let season = c.seasonStart ? c.seasonStart + '-' + c.seasonEnd : String(c.season);
  let res = c.restrictions?.map((r: any)=>r.type).join(',') || '(no-restrictions)';
  console.log(`${d.padEnd(12)} | ${c.targetScore.toString().padEnd(4)} | ${c.statLabel.padEnd(14)} | ${season.padEnd(9)} | ${res}`);
  Date.prototype.toISOString = save;
}
