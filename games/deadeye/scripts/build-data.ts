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
const END_YEAR = 2025;

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

// ── CSV parser (ported from statpad/src/lahmanLoader.js) ─────────────────
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
const awardsShare  = parseCSV(join(LAHMAN_DIR, 'AwardsSharePlayers.csv'));
const seriesPost   = parseCSV(join(LAHMAN_DIR, 'SeriesPost.csv'));
const battingPost  = parseCSV(join(LAHMAN_DIR, 'BattingPost.csv'));
const pitchingPost = parseCSV(join(LAHMAN_DIR, 'PitchingPost.csv'));

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
// Only keep meaningful awards
const KEEP_AWARDS = new Set([
  'Most Valuable Player', 'Cy Young Award', 'Gold Glove', 'Silver Slugger', 'Rookie of the Year',
]);
const awardsMap = new Map<string, string[]>();
const careerMVP = new Set<string>();
const careerCyYoung = new Set<string>();
const careerSilverSlugger = new Set<string>();
for (const row of awards) {
  if (!KEEP_AWARDS.has(row.awardID)) continue;
  if (row.awardID === 'Most Valuable Player') careerMVP.add(row.playerID);
  if (row.awardID === 'Cy Young Award') careerCyYoung.add(row.playerID);
  if (row.awardID === 'Silver Slugger') careerSilverSlugger.add(row.playerID);
  
  const key = `${row.playerID}|${row.yearID}`;
  if (!awardsMap.has(key)) awardsMap.set(key, []);
  const list = awardsMap.get(key)!;
  if (!list.includes(row.awardID)) list.push(row.awardID);
}

// ── Positional Gold Glove → Sets of "playerID|yearID" ─────────────────────
const IF_POSITIONS = new Set(['1B', '2B', '3B', 'SS']);
const OF_POSITIONS = new Set(['OF', 'RF', 'LF', 'CF']);
const ggIF = new Set<string>();
const ggOF = new Set<string>();
const ggP  = new Set<string>();
const careerGoldGlove = new Set<string>();
const careerGoldGloveIF = new Set<string>();
const careerGoldGloveOF = new Set<string>();
const careerGoldGloveP = new Set<string>();
for (const row of awards) {
  if (row.awardID !== 'Gold Glove') continue;
  careerGoldGlove.add(row.playerID);
  const key = `${row.playerID}|${row.yearID}`;
  const pos = (row.notes || '').trim();
  if (IF_POSITIONS.has(pos)) { ggIF.add(key); careerGoldGloveIF.add(row.playerID); }
  else if (OF_POSITIONS.has(pos)) { ggOF.add(key); careerGoldGloveOF.add(row.playerID); }
  else if (pos === 'P') { ggP.add(key); careerGoldGloveP.add(row.playerID); }
  // UT or other: counts as none specifically, but still in generic Gold Glove awards
}
console.log(`🧤 Gold Glove breakdown: IF=${ggIF.size} OF=${ggOF.size} P=${ggP.size}`);

// ── ROTY vote recipients → Set of "playerID|yearID" ─────────────────────
const rotyVoters = new Set<string>();
for (const row of awardsShare) {
  if (row.awardID === 'Rookie of the Year' && row.playerID && row.yearID) {
    rotyVoters.add(`${row.playerID}|${row.yearID}`);
  }
}
console.log(`🏆 ${rotyVoters.size} ROTY vote-getters indexed`);

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

// ── World Series ring holders → Set of "playerID|yearID" for roster-level ──
const wsRingHolders = new Set<string>();
for (const row of battingPost) {
  if (row.round !== 'WS') continue;
  const team = LAHMAN_TO_GAME[row.teamID] ?? row.teamID;
  if (wsWinners.has(`${team}|${row.yearID}`)) {
    wsRingHolders.add(`${row.playerID}|${row.yearID}`);
  }
}
for (const row of pitchingPost) {
  if (row.round !== 'WS') continue;
  const team = LAHMAN_TO_GAME[row.teamID] ?? row.teamID;
  if (wsWinners.has(`${team}|${row.yearID}`)) {
    wsRingHolders.add(`${row.playerID}|${row.yearID}`);
  }
}
console.log(`💍 ${wsRingHolders.size} WS ring holders indexed`);

// ── Aggregate batting stints ──────────────────────────────────────────────────
// Group by playerID+yearID, sum stats across stints (trade deadline deals)
type BatRow = {
  playerID: string; yearID: number; teams: string[];
  HR: number; RBI: number; H: number; R: number; SB: number; BB: number;
  TB: number; SO: number; PA: number;
  AB: number; HBP: number; SF: number; doubles: number; triples: number;
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
    agg.TB += num(row.H) + dbl + 2 * trp + 3 * hr;
    agg.SO += num(row.SO);
    agg.PA  += pa;
    agg.AB  += ab;
    agg.HBP += hbp;
    agg.SF  += sf;
    agg.doubles += dbl;
    agg.triples += trp;
  } else {
    batAgg.set(key, {
      playerID: pid,
      yearID: year,
      teams: [gameTeam],
      HR: hr, RBI: num(row.RBI), H: num(row.H), R: num(row.R),
      SB: num(row.SB), BB: bb, TB: num(row.H) + dbl + 2 * trp + 3 * hr, SO: num(row.SO), PA: pa,
      AB: ab, HBP: hbp, SF: sf, doubles: dbl, triples: trp,
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
  HR: number; RBI: number; H: number; SB: number; BB: number; R: number; TB: number; SO: number;
  W: number; SV: number; K: number;
  AVG: number; OBP: number; OPS: number;
  isAllStar: boolean; careerAllStars: number; isHOF: boolean;
  awards: string[]; wonWorldSeries: boolean; isRookie: boolean;
  ledHR: boolean; ledH: boolean; ledSB: boolean; ledRBI: boolean; ledR: boolean; ledK: boolean;
  goldGloveIF: boolean; goldGloveOF: boolean; goldGloveP: boolean;
  hasCareerGoldGlove: boolean; hasCareerGoldGloveIF: boolean; hasCareerGoldGloveOF: boolean; hasCareerGoldGloveP: boolean;
  hasCareerMVP: boolean; hasCareerCyYoung: boolean; hasCareerSilverSlugger: boolean;
  rotyVotes: boolean; hasRing: boolean;
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

  // Compute rate stats as integers ×1000
  const batAVG = agg.AB > 0 ? Math.round(agg.H / agg.AB * 1000) : 0;
  const singles = agg.H - agg.doubles - agg.triples - agg.HR;
  const obpDenom = agg.AB + agg.BB + agg.HBP + agg.SF;
  const batOBP = obpDenom > 0 ? Math.round((agg.H + agg.BB + agg.HBP) / obpDenom * 1000) : 0;
  const batSLG = agg.AB > 0 ? Math.round((singles + 2 * agg.doubles + 3 * agg.triples + 4 * agg.HR) / agg.AB * 1000) : 0;
  const batOPS = batOBP + batSLG;

  const playerHasRing = agg.teams.some(t => wsWinners.has(`${t}|${agg.yearID}`));

  output.push({
    id: key,
    playerID: agg.playerID,
    name,
    teamID,
    yearID: agg.yearID,
    role: 'batter',
    HR: agg.HR, RBI: agg.RBI, H: agg.H, SB: agg.SB,
    BB: agg.BB, R: agg.R, TB: agg.TB, SO: agg.SO,
    W: 0, SV: 0, K: 0,
    AVG: batAVG, OBP: batOBP, OPS: batOPS,
    isAllStar: allStarYears.has(asKey),
    careerAllStars: allStarCareer.get(agg.playerID) ?? 0,
    isHOF: hofSet.has(agg.playerID),
    awards: awardsMap.get(asKey) ?? [],
    wonWorldSeries: playerHasRing,
    isRookie: false,
    ledHR: false, ledH: false, ledSB: false, ledRBI: false, ledR: false, ledK: false,
    goldGloveIF: ggIF.has(asKey), goldGloveOF: ggOF.has(asKey), goldGloveP: false,
    hasCareerGoldGlove: careerGoldGlove.has(agg.playerID),
    hasCareerGoldGloveIF: careerGoldGloveIF.has(agg.playerID),
    hasCareerGoldGloveOF: careerGoldGloveOF.has(agg.playerID),
    hasCareerGoldGloveP: careerGoldGloveP.has(agg.playerID),
    hasCareerMVP: careerMVP.has(agg.playerID),
    hasCareerCyYoung: careerCyYoung.has(agg.playerID),
    hasCareerSilverSlugger: careerSilverSlugger.has(agg.playerID),
    rotyVotes: rotyVoters.has(asKey), hasRing: wsRingHolders.has(asKey),
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

  const playerHasRing = agg.teams.some(t => wsWinners.has(`${t}|${agg.yearID}`));

  output.push({
    id: pitId,
    playerID: agg.playerID,
    name: hasBatRecord ? `${name} (P)` : name,
    teamID,
    yearID: agg.yearID,
    role: 'pitcher',
    HR: 0, RBI: 0, H: 0, SB: 0, BB: 0, R: 0, TB: 0, SO: 0,
    W: agg.W, SV: agg.SV, K: agg.K,
    AVG: 0, OBP: 0, OPS: 0,
    isAllStar: allStarYears.has(asKey),
    careerAllStars: allStarCareer.get(agg.playerID) ?? 0,
    isHOF: hofSet.has(agg.playerID),
    awards: awardsMap.get(asKey) ?? [],
    wonWorldSeries: playerHasRing,
    isRookie: false,
    ledHR: false, ledH: false, ledSB: false, ledRBI: false, ledR: false, ledK: false,
    goldGloveIF: false, goldGloveOF: false, goldGloveP: ggP.has(asKey),
    hasCareerGoldGlove: careerGoldGlove.has(agg.playerID),
    hasCareerGoldGloveIF: careerGoldGloveIF.has(agg.playerID),
    hasCareerGoldGloveOF: careerGoldGloveOF.has(agg.playerID),
    hasCareerGoldGloveP: careerGoldGloveP.has(agg.playerID),
    hasCareerMVP: careerMVP.has(agg.playerID),
    hasCareerCyYoung: careerCyYoung.has(agg.playerID),
    hasCareerSilverSlugger: careerSilverSlugger.has(agg.playerID),
    rotyVotes: rotyVoters.has(asKey), hasRing: wsRingHolders.has(asKey),
  });
}

// ── Post-processing: compute stat leaders per year ────────────────────────
const statLeaderFields: { key: keyof PlayerSeasonOut; flag: keyof PlayerSeasonOut; role: 'batter' | 'pitcher' | 'any' }[] = [
  { key: 'HR',  flag: 'ledHR',  role: 'batter' },
  { key: 'H',   flag: 'ledH',   role: 'batter' },
  { key: 'SB',  flag: 'ledSB',  role: 'batter' },
  { key: 'RBI', flag: 'ledRBI', role: 'batter' },
  { key: 'R',   flag: 'ledR',   role: 'batter' },
  { key: 'K',   flag: 'ledK',   role: 'pitcher' },
];

// Group output by yearID
const byYear = new Map<number, PlayerSeasonOut[]>();
for (const rec of output) {
  if (!byYear.has(rec.yearID)) byYear.set(rec.yearID, []);
  byYear.get(rec.yearID)!.push(rec);
}

let leaderCount = 0;
for (const [, yearPlayers] of byYear) {
  for (const { key, flag, role } of statLeaderFields) {
    const eligible = role === 'any' ? yearPlayers : yearPlayers.filter(p => p.role === role);
    if (eligible.length === 0) continue;
    const maxVal = Math.max(...eligible.map(p => p[key] as number));
    if (maxVal <= 0) continue;
    for (const p of eligible) {
      if ((p[key] as number) === maxVal) {
        (p as any)[flag] = true;
        leaderCount++;
      }
    }
  }
}
console.log(`👑 ${leaderCount} stat leader flags set`);

// ── Post-processing: compute isRookie ───────────────────────────────────────
// A season is a rookie season if it's the first qualifying year for that playerID
const minYearByPlayer = new Map<string, number>();
for (const rec of output) {
  const existing = minYearByPlayer.get(rec.playerID);
  if (existing === undefined || rec.yearID < existing) {
    minYearByPlayer.set(rec.playerID, rec.yearID);
  }
}
let rookieCount = 0;
for (const rec of output) {
  if (rec.yearID === minYearByPlayer.get(rec.playerID)) {
    rec.isRookie = true;
    rookieCount++;
  }
}
console.log(`🌱 ${rookieCount} rookie seasons tagged`);

output.sort((a, b) => a.yearID - b.yearID || a.name.localeCompare(b.name));

// ── Write output ──────────────────────────────────────────────────────────────
writeFileSync(OUTPUT_PATH, JSON.stringify(output));
console.log(`\n✅ Written ${output.length} player-seasons to ${OUTPUT_PATH}`);
console.log(`   Batters: ${output.filter(p => p.role === 'batter').length}`);
console.log(`   Pitchers: ${output.filter(p => p.role === 'pitcher').length}`);
console.log(`   File size: ${(readFileSync(OUTPUT_PATH).length / 1024 / 1024).toFixed(1)} MB`);
