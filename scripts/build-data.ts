#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Data Build Script
// Reads Lahman CSV files → outputs public/data/players.json
// Run: npx tsx scripts/build-data.ts
//
// Requires LAHMAN_DIR env variable or defaults to ~/Downloads/lahman-folder
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

// ── Config ────────────────────────────────────────────────────────────────────
const LAHMAN_DIR = process.env.LAHMAN_DIR
  ?? resolve(homedir(), 'Downloads', 'lahman-folder');

const OUTPUT_PATH = resolve(process.cwd(), 'public', 'data', 'players.json');
const MIN_PA = 100;    // minimum plate appearances for batters
const MIN_IP = 20;     // minimum innings pitched for pitchers
const START_YEAR = 1900;
const END_YEAR = 2024;

console.log(`📂 Lahman dir: ${LAHMAN_DIR}`);
console.log(`📄 Output: ${OUTPUT_PATH}`);

// ── Lahman team → game abbreviation map ──────────────────────────────────────
const LAHMAN_TO_GAME: Record<string, string | null> = {
  NYA: 'NYY', BOS: 'BOS', TOR: 'TOR', BAL: 'BAL', TBA: 'TBR', TBD: 'TBR',
  CHA: 'CHW', MIN: 'MIN', DET: 'DET', CLE: 'CLE', CLG: 'CLE', KCA: 'KCR',
  OAK: 'OAK', ATH: 'OAK', SEA: 'SEA', HOU: 'HOU', TEX: 'TEX',
  LAA: 'LAA', ANA: 'LAA', CAL: 'LAA',
  NYN: 'NYM', PHI: 'PHI', ATL: 'ATL', MIA: 'MIA', FLO: 'MIA',
  WAS: 'WSN', MON: null,
  CHN: 'CHC', SLN: 'STL', MIL: 'MIL', CIN: 'CIN', PIT: 'PIT',
  LAN: 'LAD', SFN: 'SFG', SDN: 'SDP', ARI: 'ARI', COL: 'COL',
};

// ── CSV parser (ported from statpad-dupe/src/lahmanLoader.js) ─────────────────
function parseCSV(filePath: string): Record<string, string>[] {
  if (!existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return [];
  }
  const raw = readFileSync(filePath, 'utf8');
  const text = raw.startsWith('\uFEFF') ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = line.split(',');
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ?? '';
    }
    rows.push(obj);
  }
  return rows;
}

const num = (v: string | undefined) => +(v ?? 0) || 0;

// ── Load all CSVs ─────────────────────────────────────────────────────────────
console.log('📖 Reading CSVs…');
const people       = parseCSV(join(LAHMAN_DIR, 'People.csv'));
const batting      = parseCSV(join(LAHMAN_DIR, 'Batting.csv'));
const pitching     = parseCSV(join(LAHMAN_DIR, 'Pitching.csv'));
const allstar      = parseCSV(join(LAHMAN_DIR, 'AllstarFull.csv'));
const hof          = parseCSV(join(LAHMAN_DIR, 'HallOfFame.csv'));
const awards       = parseCSV(join(LAHMAN_DIR, 'AwardsPlayers.csv'));
const seriesPost   = parseCSV(join(LAHMAN_DIR, 'SeriesPost.csv'));

// ── People → name map ─────────────────────────────────────────────────────────
const nameMap = new Map<string, string>();
for (const row of people) {
  if (!row.playerID) continue;
  const name = `${(row.nameFirst || '').trim()} ${(row.nameLast || '').trim()}`.trim();
  nameMap.set(row.playerID, name);
}
console.log(`👤 ${nameMap.size} players in People.csv`);

// ── Hall of Fame → Set of inducted playerIDs ──────────────────────────────────
const hofSet = new Set<string>();
for (const row of hof) {
  if (row.inducted === 'Y' && row.category === 'Player') {
    hofSet.add(row.playerID);
  }
}
console.log(`🏆 ${hofSet.size} Hall of Famers`);

// ── All-Star appearances ──────────────────────────────────────────────────────
// isAllStar: Set of "playerID|yearID" where GP=1
// careerAllStars: total count per playerID
const allStarYears = new Set<string>();
const allStarCareer = new Map<string, number>();
for (const row of allstar) {
  const pid = row.playerID;
  const year = row.yearID;
  if (!pid || !year) continue;
  allStarYears.add(`${pid}|${year}`);
  allStarCareer.set(pid, (allStarCareer.get(pid) ?? 0) + 1);
}
console.log(`⭐ ${allStarYears.size} All-Star appearances indexed`);

// ── Awards → map of "playerID|yearID" → string[] ─────────────────────────────
const awardsMap = new Map<string, string[]>();
for (const row of awards) {
  const key = `${row.playerID}|${row.yearID}`;
  if (!awardsMap.has(key)) awardsMap.set(key, []);
  awardsMap.get(key)!.push(row.awardID);
}

// ── World Series winners → Set of "teamID|yearID" ────────────────────────────
// We normalize Lahman teamIDs to game abbrevs here too
const wsWinners = new Set<string>();
for (const row of seriesPost) {
  if (row.round === 'WS' && row.teamIDwinner) {
    const team = LAHMAN_TO_GAME[row.teamIDwinner] ?? row.teamIDwinner;
    wsWinners.add(`${team}|${row.yearID}`);
  }
}
console.log(`🏆 ${wsWinners.size} World Series winner team-years`);

// ── Aggregate batting stints ──────────────────────────────────────────────────
// Group by playerID+yearID, sum stats across stints (trade deadline deals)
type BatRow = {
  playerID: string; yearID: number; teams: string[];
  HR: number; RBI: number; H: number; R: number; SB: number; BB: number;
  XBH: number; PA: number;
};

const batAgg = new Map<string, BatRow>();
for (const row of batting) {
  const year = +row.yearID;
  if (year < START_YEAR || year > END_YEAR) continue;
  const gameTeam = LAHMAN_TO_GAME[row.teamID];
  if (gameTeam === null) continue;  // defunct franchise
  if (!gameTeam) continue;           // unknown team

  const pid = row.playerID;
  const key = `${pid}|${year}`;
  const ab  = num(row.AB);
  const bb  = num(row.BB);
  const hbp = num(row.HBP);
  const sf  = num(row.SF);
  const sh  = num(row.SH);
  const pa  = ab + bb + hbp + sf + sh;
  const dbl = num(row['2B']);
  const trp = num(row['3B']);
  const hr  = num(row.HR);

  if (batAgg.has(key)) {
    const agg = batAgg.get(key)!;
    if (!agg.teams.includes(gameTeam)) agg.teams.push(gameTeam);
    agg.HR  += hr;
    agg.RBI += num(row.RBI);
    agg.H   += num(row.H);
    agg.R   += num(row.R);
    agg.SB  += num(row.SB);
    agg.BB  += bb;
    agg.XBH += dbl + trp + hr;
    agg.PA  += pa;
  } else {
    batAgg.set(key, {
      playerID: pid,
      yearID: year,
      teams: [gameTeam],
      HR: hr, RBI: num(row.RBI), H: num(row.H), R: num(row.R),
      SB: num(row.SB), BB: bb, XBH: dbl + trp + hr, PA: pa,
    });
  }
}

// ── Aggregate pitching stints ─────────────────────────────────────────────────
type PitRow = {
  playerID: string; yearID: number; teams: string[];
  W: number; SV: number; K: number; IPouts: number;
};

const pitAgg = new Map<string, PitRow>();
for (const row of pitching) {
  const year = +row.yearID;
  if (year < START_YEAR || year > END_YEAR) continue;
  const gameTeam = LAHMAN_TO_GAME[row.teamID];
  if (gameTeam === null) continue;
  if (!gameTeam) continue;

  const pid = row.playerID;
  const key = `${pid}|${year}`;
  const ipouts = num(row.IPouts);

  if (pitAgg.has(key)) {
    const agg = pitAgg.get(key)!;
    if (!agg.teams.includes(gameTeam)) agg.teams.push(gameTeam);
    agg.W      += num(row.W);
    agg.SV     += num(row.SV);
    agg.K      += num(row.SO);
    agg.IPouts += ipouts;
  } else {
    pitAgg.set(key, {
      playerID: pid, yearID: year,
      teams: [gameTeam],
      W: num(row.W), SV: num(row.SV), K: num(row.SO), IPouts: ipouts,
    });
  }
}

// ── Build final PlayerSeason records ─────────────────────────────────────────
interface PlayerSeasonOut {
  id: string; playerID: string; name: string; teamID: string; yearID: number;
  role: 'batter' | 'pitcher';
  HR: number; RBI: number; H: number; SB: number; BB: number; R: number; XBH: number;
  W: number; SV: number; K: number;
  isAllStar: boolean; careerAllStars: number; isHOF: boolean;
  awards: string[]; wonWorldSeries: boolean;
}

const output: PlayerSeasonOut[] = [];

// Batters
for (const [key, agg] of batAgg) {
  if (agg.PA < MIN_PA) continue;
  const name = nameMap.get(agg.playerID);
  if (!name) continue;
  const teamID = agg.teams.join('/');
  const primaryTeam = agg.teams[0];
  const asKey = `${agg.playerID}|${agg.yearID}`;
  output.push({
    id: key,
    playerID: agg.playerID,
    name,
    teamID,
    yearID: agg.yearID,
    role: 'batter',
    HR: agg.HR, RBI: agg.RBI, H: agg.H, SB: agg.SB,
    BB: agg.BB, R: agg.R, XBH: agg.XBH,
    W: 0, SV: 0, K: 0,
    isAllStar: allStarYears.has(asKey),
    careerAllStars: allStarCareer.get(agg.playerID) ?? 0,
    isHOF: hofSet.has(agg.playerID),
    awards: awardsMap.get(asKey) ?? [],
    wonWorldSeries: wsWinners.has(`${primaryTeam}|${agg.yearID}`),
  });
}

// Pitchers
for (const [key, agg] of pitAgg) {
  const ip = agg.IPouts / 3;
  if (ip < MIN_IP) continue;
  const name = nameMap.get(agg.playerID);
  if (!name) continue;

  // Skip if this player already appears as a batter for this year
  // (two-way players: batting record takes precedence unless pitching stats are significant)
  const batKey = `${agg.playerID}|${agg.yearID}`;
  const hasBatRecord = batAgg.has(batKey) && (batAgg.get(batKey)!.PA >= MIN_PA);
  if (hasBatRecord && (agg.W + agg.SV + agg.K) < 10) continue;

  const teamID = agg.teams.join('/');
  const primaryTeam = agg.teams[0];
  const asKey = `${agg.playerID}|${agg.yearID}`;

  // For two-way players, append "-p" to id to distinguish pitching record
  const pitId = hasBatRecord ? `${key}-p` : key;

  output.push({
    id: pitId,
    playerID: agg.playerID,
    name: hasBatRecord ? `${name} (P)` : name,
    teamID,
    yearID: agg.yearID,
    role: 'pitcher',
    HR: 0, RBI: 0, H: 0, SB: 0, BB: 0, R: 0, XBH: 0,
    W: agg.W, SV: agg.SV, K: agg.K,
    isAllStar: allStarYears.has(asKey),
    careerAllStars: allStarCareer.get(agg.playerID) ?? 0,
    isHOF: hofSet.has(agg.playerID),
    awards: awardsMap.get(asKey) ?? [],
    wonWorldSeries: wsWinners.has(`${primaryTeam}|${agg.yearID}`),
  });
}

output.sort((a, b) => a.yearID - b.yearID || a.name.localeCompare(b.name));

// ── Write output ──────────────────────────────────────────────────────────────
writeFileSync(OUTPUT_PATH, JSON.stringify(output));
console.log(`\n✅ Written ${output.length} player-seasons to ${OUTPUT_PATH}`);
console.log(`   Batters: ${output.filter(p => p.role === 'batter').length}`);
console.log(`   Pitchers: ${output.filter(p => p.role === 'pitcher').length}`);
console.log(`   File size: ${(readFileSync(OUTPUT_PATH).length / 1024 / 1024).toFixed(1)} MB`);
