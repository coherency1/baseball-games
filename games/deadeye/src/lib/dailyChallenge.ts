// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Daily Challenge Generator
// Date-seeded: all players get the same puzzle each day.
// Target generated via validated non-trivial algorithm with ghost path.
// ─────────────────────────────────────────────────────────────────────────────

// @ts-ignore - seedrandom has no bundled types but @types/seedrandom is installed
import seedrandom from 'seedrandom';
import type { PlayerSeason, DailyChallenge, ChallengeConfig, Restriction, StatKey, GhostStep } from '../types/game';
import { getStatValue, getDartLimit, getStatDensity } from './gameEngine';
import { MLB_TEAMS } from '../data/teams';

// Epoch: day 1 of Deadeye challenges
const EPOCH_DATE = '2026-03-01';

// DEV: force a specific challenge for testing. Set to null for production seeding.
export const DEV_OVERRIDE: ChallengeConfig | null = null;

// ── Challenge Configs ─────────────────────────────────────────────────────────
// Sorted by year (ascending), split among filter types.
// Section 1: Iconic single years — eligible for restriction filters
// Section 2: Era ranges (no threshold) — eligible for restriction filters
// Section 3: Threshold configs — mutually exclusive with restrictions
export const CHALLENGE_CONFIGS: ChallengeConfig[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: ICONIC SINGLE YEARS (sorted ascending)
  // ═══════════════════════════════════════════════════════════════════════════
  { season: 1920, statKey: 'HR',  statLabel: 'Home Runs' },          // Babe Ruth revolutionizes power
  { season: 1930, statKey: 'RBI', statLabel: 'RBI' },                // Hack Wilson 191 RBI
  { season: 1941, statKey: 'H',   statLabel: 'Hits' },               // DiMaggio streak / Ted .406
  { season: 1951, statKey: 'HR',  statLabel: 'Home Runs' },          // Shot Heard Round the World
  { season: 1961, statKey: 'HR',  statLabel: 'Home Runs' },          // Maris 61 / Mantle
  { season: 1968, statKey: 'K',   statLabel: 'Strikeouts' },         // Year of the Pitcher
  { season: 1974, statKey: 'SB',  statLabel: 'Stolen Bases' },       // Lou Brock 118 SB
  { season: 1982, statKey: 'SB',  statLabel: 'Stolen Bases' },       // Rickey Henderson 130 SB
  { season: 1985, statKey: 'SB',  statLabel: 'Stolen Bases' },       // Henderson/Coleman
  { season: 1995, statKey: 'HR',  statLabel: 'Home Runs' },          // Post-strike power surge
  { season: 1998, statKey: 'HR',  statLabel: 'Home Runs' },          // McGwire/Sosa HR chase
  { season: 2001, statKey: 'HR',  statLabel: 'Home Runs' },          // Bonds 73 HR
  { season: 2004, statKey: 'H',   statLabel: 'Hits' },               // Ichiro 262 hits
  { season: 2015, statKey: 'K',   statLabel: 'Strikeouts' },         // Kershaw/Scherzer K dominance
  { season: 2023, statKey: 'SB',  statLabel: 'Stolen Bases' },       // New SB rules explosion
  { season: 2024, statKey: 'HR',  statLabel: 'Home Runs' },          // Shohei's 50/50

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: ERA RANGES — no threshold, eligible for restriction filters
  // Sorted by ascending start year
  // ═══════════════════════════════════════════════════════════════════════════
  // ── Pre-1950 ───────────────────────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 1919, statKey: 'H',   statLabel: 'Hits' },               // Dead Ball Contact
  { seasonStart: 1920, seasonEnd: 1941, statKey: 'HR',  statLabel: 'Home Runs' },          // Live Ball Era Power
  { seasonStart: 1920, seasonEnd: 1941, statKey: 'RBI', statLabel: 'RBI' },                // Live Ball Run Production
  { seasonStart: 1940, seasonEnd: 1949, statKey: 'HR',  statLabel: 'Home Runs' },          // Post-War Power
  { seasonStart: 1940, seasonEnd: 1949, statKey: 'R',   statLabel: 'Runs' },               // Wartime Run Scoring
  // ── 1950s ──────────────────────────────────────────────────────────────────
  { seasonStart: 1950, seasonEnd: 1959, statKey: 'HR',  statLabel: 'Home Runs' },          // 50s Power Explosion
  { seasonStart: 1950, seasonEnd: 1959, statKey: 'H',   statLabel: 'Hits' },               // 50s Contact Kings
  { seasonStart: 1950, seasonEnd: 1960, statKey: 'TB',  statLabel: 'Total Bases' },        // Golden Age Sluggers
  { seasonStart: 1950, seasonEnd: 1970, statKey: 'SV',  statLabel: 'Saves' },              // Classic Relief Aces
  { seasonStart: 1950, seasonEnd: 1979, statKey: 'HR',  statLabel: 'Home Runs' },          // Classic Era Power
  // ── 1960s ──────────────────────────────────────────────────────────────────
  { seasonStart: 1960, seasonEnd: 1969, statKey: 'K',   statLabel: 'Strikeouts' },         // 60s Pitching Dominance
  { seasonStart: 1960, seasonEnd: 1969, statKey: 'SB',  statLabel: 'Stolen Bases' },       // 60s Speed Revival
  { seasonStart: 1960, seasonEnd: 1980, statKey: 'K',   statLabel: 'Strikeouts' },         // Classic Power Pitching
  { seasonStart: 1965, seasonEnd: 1975, statKey: 'K',   statLabel: 'Strikeouts' },         // Lowered Mound Era
  // ── 1970s ──────────────────────────────────────────────────────────────────
  { seasonStart: 1970, seasonEnd: 1979, statKey: 'SV',  statLabel: 'Saves' },              // Birth of the Closer
  { seasonStart: 1970, seasonEnd: 1979, statKey: 'SB',  statLabel: 'Stolen Bases' },       // 70s Baserunning
  { seasonStart: 1970, seasonEnd: 1979, statKey: 'HR',  statLabel: 'Home Runs' },          // 70s Power Hitters
  // ── 1980s ──────────────────────────────────────────────────────────────────
  { seasonStart: 1980, seasonEnd: 1989, statKey: 'SB',  statLabel: 'Stolen Bases' },       // 80s Speedsters
  { seasonStart: 1980, seasonEnd: 1989, statKey: 'HR',  statLabel: 'Home Runs' },          // 80s Power
  { seasonStart: 1980, seasonEnd: 1989, statKey: 'K',   statLabel: 'Strikeouts' },         // 80s K Artists
  { seasonStart: 1980, seasonEnd: 1995, statKey: 'H',   statLabel: 'Hits' },               // Contact Hitters
  { seasonStart: 1980, seasonEnd: 1999, statKey: 'SB',  statLabel: 'Stolen Bases' },       // 80s-90s Baserunning
  { seasonStart: 1985, seasonEnd: 1995, statKey: 'SB',  statLabel: 'Stolen Bases' },       // Peak Rickey Era
  // ── 1990s ──────────────────────────────────────────────────────────────────
  { seasonStart: 1990, seasonEnd: 1999, statKey: 'HR',  statLabel: 'Home Runs' },          // 90s Steroid Era Power
  { seasonStart: 1990, seasonEnd: 1999, statKey: 'RBI', statLabel: 'RBI' },                // 90s Run Producers
  { seasonStart: 1990, seasonEnd: 2000, statKey: 'R',   statLabel: 'Runs' },               // 90s Run Scorers
  { seasonStart: 1990, seasonEnd: 2009, statKey: 'R',   statLabel: 'Runs' },               // Offensive Explosion
  { seasonStart: 1995, seasonEnd: 2005, statKey: 'RBI', statLabel: 'RBI' },                // Run Production Boom
  { seasonStart: 1995, seasonEnd: 2005, statKey: 'TB',  statLabel: 'Total Bases' },        // Peak Slugging Era
  // ── 2000s ──────────────────────────────────────────────────────────────────
  { seasonStart: 2000, seasonEnd: 2009, statKey: 'SB',  statLabel: 'Stolen Bases' },       // 2000s Speed
  { seasonStart: 2000, seasonEnd: 2009, statKey: 'HR',  statLabel: 'Home Runs' },          // 2000s Power
  { seasonStart: 2000, seasonEnd: 2010, statKey: 'RBI', statLabel: 'RBI' },                // 2000s Run Production
  { seasonStart: 2000, seasonEnd: 2020, statKey: 'K',   statLabel: 'Strikeouts' },         // Strikeout Inflation
  { seasonStart: 2000, seasonEnd: 2025, statKey: 'BB',  statLabel: 'Walks' },              // Moneyball Walks
  { seasonStart: 2000, seasonEnd: 2025, statKey: 'SO',  statLabel: 'Batting Strikeouts' }, // Batting Whiff Era
  { seasonStart: 2005, seasonEnd: 2015, statKey: 'TB',  statLabel: 'Total Bases' },        // Transition Era Sluggers
  { seasonStart: 2005, seasonEnd: 2015, statKey: 'SV',  statLabel: 'Saves' },              // 2000s Elite Closers
  // ── 2010s ──────────────────────────────────────────────────────────────────
  { seasonStart: 2010, seasonEnd: 2019, statKey: 'K',   statLabel: 'Strikeouts' },         // Strikeout Surge
  { seasonStart: 2010, seasonEnd: 2019, statKey: 'SV',  statLabel: 'Saves' },              // Modern Closers
  { seasonStart: 2010, seasonEnd: 2019, statKey: 'HR',  statLabel: 'Home Runs' },          // 2010s Power
  { seasonStart: 2010, seasonEnd: 2025, statKey: 'TB',  statLabel: 'Total Bases' },        // Total Base Leaders
  { seasonStart: 2010, seasonEnd: 2025, statKey: 'BB',  statLabel: 'Walks' },              // Modern Plate Discipline
  { seasonStart: 2015, seasonEnd: 2025, statKey: 'HR',  statLabel: 'Home Runs' },          // Launch Angle Era
  { seasonStart: 2015, seasonEnd: 2025, statKey: 'SO',  statLabel: 'Batting Strikeouts' }, // Modern Whiff Era
  { seasonStart: 2018, seasonEnd: 2025, statKey: 'RBI', statLabel: 'RBI' },                // Modern Run Producers
  // ── 2020s ──────────────────────────────────────────────────────────────────
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'HR',  statLabel: 'Home Runs' },          // Modern Mashers
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases' },       // Modern Speed
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'K',   statLabel: 'Strikeouts' },         // Modern Strikeout Era
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'RBI', statLabel: 'RBI' },                // Modern Run Production
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'SV',  statLabel: 'Saves' },              // Modern Bullpens
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'H',   statLabel: 'Hits' },               // Modern Contact
  { seasonStart: 2020, seasonEnd: 2025, statKey: 'R',   statLabel: 'Runs' },               // Modern Run Scoring
  // ── Full Span ──────────────────────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'HR',  statLabel: 'Home Runs' },          // All-Time Power
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'H',   statLabel: 'Hits' },               // All-Time Hit Kings
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'K',   statLabel: 'Strikeouts' },         // All-Time K Artists
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SV',  statLabel: 'Saves' },              // All-Time Closers
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases' },       // All-Time Speed

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: THRESHOLD CONFIGS — mutually exclusive with restrictions
  // Sorted by ascending start year, then by threshold type
  // ═══════════════════════════════════════════════════════════════════════════
  // ── 30+ HR Threshold ───────────────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'RBI', statLabel: 'RBI',                   threshold: 30,  thresholdStatKey: 'HR', thresholdStatLabel: 'Home Runs' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'R',   statLabel: 'Runs',                  threshold: 30,  thresholdStatKey: 'HR', thresholdStatLabel: 'Home Runs' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'TB',  statLabel: 'Total Bases',           threshold: 30,  thresholdStatKey: 'HR', thresholdStatLabel: 'Home Runs' },
  { seasonStart: 1990, seasonEnd: 2025, statKey: 'BB',  statLabel: 'Walks',                 threshold: 30,  thresholdStatKey: 'HR', thresholdStatLabel: 'Home Runs' },
  // ── 40+ HR Threshold ───────────────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'RBI', statLabel: 'RBI',                   threshold: 40,  thresholdStatKey: 'HR', thresholdStatLabel: 'Home Runs' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'TB',  statLabel: 'Total Bases',           threshold: 40,  thresholdStatKey: 'HR', thresholdStatLabel: 'Home Runs' },
  // ── 30+ SV Threshold ───────────────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'K',   statLabel: 'Strikeouts',            threshold: 30,  thresholdStatKey: 'SV', thresholdStatLabel: 'Saves' },
  { seasonStart: 1970, seasonEnd: 2025, statKey: 'K',   statLabel: 'Strikeouts',            threshold: 40,  thresholdStatKey: 'SV', thresholdStatLabel: 'Saves' },
  // ── 180+ H Threshold ───────────────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'BB',  statLabel: 'Walks',                 threshold: 180, thresholdStatKey: 'H',  thresholdStatLabel: 'Hits' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'R',   statLabel: 'Runs',                  threshold: 180, thresholdStatKey: 'H',  thresholdStatLabel: 'Hits' },
  // ── 200+ H Threshold ───────────────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'BB',  statLabel: 'Walks',                 threshold: 200, thresholdStatKey: 'H',  thresholdStatLabel: 'Hits' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases',          threshold: 200, thresholdStatKey: 'H',  thresholdStatLabel: 'Hits' },
  // ── Mixed Cross-Stat Thresholds ────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SV',  statLabel: 'Saves',                 threshold: 200, thresholdStatKey: 'K',  thresholdStatLabel: 'Strikeouts' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'R',   statLabel: 'Runs',                  threshold: 80,  thresholdStatKey: 'BB', thresholdStatLabel: 'Walks' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'H',   statLabel: 'Hits',                  threshold: 50,  thresholdStatKey: 'SB', thresholdStatLabel: 'Stolen Bases' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'HR',  statLabel: 'Home Runs',             threshold: 100, thresholdStatKey: 'R',  thresholdStatLabel: 'Runs' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases',          threshold: 100, thresholdStatKey: 'RBI',thresholdStatLabel: 'RBI' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'R',   statLabel: 'Runs',                  threshold: 40,  thresholdStatKey: 'HR', thresholdStatLabel: 'Home Runs' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'BB',  statLabel: 'Walks',                 threshold: 40,  thresholdStatKey: 'SB', thresholdStatLabel: 'Stolen Bases' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases',          threshold: 80,  thresholdStatKey: 'BB', thresholdStatLabel: 'Walks' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'TB',  statLabel: 'Total Bases',           threshold: 200, thresholdStatKey: 'H',  thresholdStatLabel: 'Hits' },
  // ── 200+ K Threshold ───────────────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'K',   statLabel: 'Strikeouts',            threshold: 200, thresholdStatKey: 'K',  thresholdStatLabel: 'Strikeouts' },
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SV',  statLabel: 'Saves',                 threshold: 40,  thresholdStatKey: 'K',  thresholdStatLabel: 'Strikeouts' },
  // ── Club Categories ────────────────────────────────────────────────────────
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases',          threshold: 20,  thresholdStatKey: 'HR', thresholdStatLabel: 'Home Runs' },    // 20HR/20SB Club
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases',          threshold: 30,  thresholdStatKey: 'HR', thresholdStatLabel: 'Home Runs' },    // 30HR/30SB Club
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'HR',  statLabel: 'Home Runs',             threshold: 30,  thresholdStatKey: 'SB', thresholdStatLabel: 'Stolen Bases' }, // Power-Speed
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'H',   statLabel: 'Hits',                  threshold: 300, thresholdStatKey: 'AVG',thresholdStatLabel: '.300+ AVG only' },    // .300 Hitters
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'HR',  statLabel: 'Home Runs',             threshold: 200, thresholdStatKey: 'SO', thresholdStatLabel: 'Batting Strikeouts' }, // Whiff Power
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'HR',  statLabel: 'Home Runs',             threshold: 100, thresholdStatKey: 'RBI',thresholdStatLabel: 'RBI' },          // 100+ RBI Club
  { seasonStart: 1900, seasonEnd: 2025, statKey: 'SB',  statLabel: 'Stolen Bases',          threshold: 100, thresholdStatKey: 'R',  thresholdStatLabel: 'Runs' },         // 100+ R Speedsters
];

// ── Combinatorial Restriction Categories ───────────────────────────────────
// Grouped by type so that a daily challenge can mix constraints (e.g., Award + Geography + Status)
// without clashing (e.g., picking both AL West and NL West).
const RESTRICTION_CATEGORIES: Record<string, Restriction[]> = {
  award: [
    { type: 'mvp', label: '1+ MVP' },
    { type: 'mvp_season', label: 'MVP' },
    { type: 'cy_young', label: '1+ Cy Young' },
    { type: 'cy_young_season', label: 'Cy Young' },
    { type: 'silver_slugger', label: '1+ Silver Slugger' },
    { type: 'silver_slugger_season', label: 'Silver Slugger' },
    { type: 'gold_glove', label: '1+ Gold Glove' },
    { type: 'gold_glove_season', label: 'Gold Glove' },
    { type: 'allstar', label: 'All-Star same season' },
  ],
  positional: [
    { type: 'gg_infield', label: '1+ Gold Glove (IF)' },
    { type: 'gg_infield_season', label: 'Gold Glove (IF)' },
    { type: 'gg_outfield', label: '1+ Gold Glove (OF)' },
    { type: 'gg_outfield_season', label: 'Gold Glove (OF)' },
    { type: 'gg_pitcher', label: '1+ Gold Glove (P)' },
    { type: 'gg_pitcher_season', label: 'Gold Glove (P)' },
    { type: 'roty_votes', label: 'Received ROTY votes' },
    { type: 'ws_winner', label: 'Won World Series' },
    { type: 'ws_ring', label: 'Played in WS' },
  ],
  status: [
    { type: 'hof', label: 'Hall of Fame' },
    { type: 'rookie', label: 'Rookie season' },
  ],
  team_or_league: [
    { type: 'league', value: 'AL', label: 'AL' },
    { type: 'league', value: 'NL', label: 'NL' },
  ]
};

// Minimum deduped players required for a restriction to be applied
const MIN_RESTRICTED_POOL = 8;

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

function filterByStat(players: PlayerSeason[], statKey: StatKey, season: number): PlayerSeason[] {
  return players.filter(p => p.yearID === season && getStatValue(p, statKey) > 0);
}

function filterByRestrictions(players: PlayerSeason[], restrictions: Restriction[]): PlayerSeason[] {
  let filtered = players;
  for (const restriction of restrictions) {
    if (filtered.length === 0) break;
    switch (restriction.type) {
      case 'hof':           filtered = filtered.filter(p => p.isHOF); break;
      case 'allstar':       filtered = filtered.filter(p => p.isAllStar); break;
      case 'ws_winner':     filtered = filtered.filter(p => p.wonWorldSeries); break;
      case 'ws_ring':       filtered = filtered.filter(p => p.hasRing); break;
      case 'award':         filtered = filtered.filter(p => restriction.value && p.awards.includes(restriction.value)); break;
      case 'rookie':        filtered = filtered.filter(p => p.isRookie); break;
      case 'league': {
        filtered = filtered.filter(p => {
          const primaryTeam = p.teamID.split('/')[0];
          const info = MLB_TEAMS[primaryTeam];
          return info?.league === restriction.value;
        });
        break;
      }
      case 'division': {
        filtered = filtered.filter(p => {
          const primaryTeam = p.teamID.split('/')[0];
          const info = MLB_TEAMS[primaryTeam];
          return info?.division === restriction.value;
        });
        break;
      }
      case 'mvp':           filtered = filtered.filter(p => p.hasCareerMVP); break;
      case 'mvp_season':    filtered = filtered.filter(p => p.awards.includes('Most Valuable Player')); break;
      case 'cy_young':      filtered = filtered.filter(p => p.hasCareerCyYoung); break;
      case 'cy_young_season': filtered = filtered.filter(p => p.awards.includes('Cy Young Award')); break;
      case 'silver_slugger': filtered = filtered.filter(p => p.hasCareerSilverSlugger); break;
      case 'silver_slugger_season': filtered = filtered.filter(p => p.awards.includes('Silver Slugger')); break;
      case 'gold_glove':    filtered = filtered.filter(p => p.hasCareerGoldGlove); break;
      case 'gold_glove_season': filtered = filtered.filter(p => p.awards.includes('Gold Glove')); break;
      // Positional Gold Glove
      case 'gg_infield':    filtered = filtered.filter(p => p.hasCareerGoldGloveIF); break;
      case 'gg_infield_season': filtered = filtered.filter(p => p.goldGloveIF); break;
      case 'gg_outfield':   filtered = filtered.filter(p => p.hasCareerGoldGloveOF); break;
      case 'gg_outfield_season': filtered = filtered.filter(p => p.goldGloveOF); break;
      case 'gg_pitcher':    filtered = filtered.filter(p => p.hasCareerGoldGloveP); break;
      case 'gg_pitcher_season': filtered = filtered.filter(p => p.goldGloveP); break;
      // Voting
      case 'roty_votes':    filtered = filtered.filter(p => p.rotyVotes); break;
    }
  }
  return filtered;
}

// ── Deduplicate pool by playerID, keeping best stat value per player ──────────
interface DeduplicatedPlayer {
  playerID: string;
  season: PlayerSeason;
  statValue: number;
}

function deduplicatePool(pool: PlayerSeason[], statKey: StatKey): DeduplicatedPlayer[] {
  const map = new Map<string, DeduplicatedPlayer>();
  for (const s of pool) {
    const val = getStatValue(s, statKey);
    const existing = map.get(s.playerID);
    if (!existing || val > existing.statValue) {
      map.set(s.playerID, { playerID: s.playerID, season: s, statValue: val });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.statValue - a.statValue);
}

// ── DP-based target generation + short ghost paths ──────────────────────────
//
// Uses minimum-cardinality subset sum (0/1 knapsack variant) on the FULL
// candidate pool to find the shortest possible ghost path.
//
// Algorithm:
// 1. DP on all deduped candidates → TRUE minimum darts for every reachable sum
// 2. Target selection prefers short ghost K (idealGhostK = max(3, hardLimit-2))
// 3. DFS with DP-guided pruning → near-instant path reconstruction
//
// Key design:
// - idealGhostK: Sparse(HR)=3, Standard(RBI/K/SB)=4, Dense(H/TB)=5
// - 3★ = match ghost path (3-5 darts), a real achievement
// - Hard mode uses its dart limit (5-7) — generous compared to ghost
// - Normal mode gives 2-3 extra darts beyond hard

/**
 * DP minimum-cardinality subset sum.
 * For each reachable sum s ∈ [0, maxSum], computes:
 *   dp[s]    = minimum number of elements to reach s (0/1 knapsack)
 *   count[s] = number of distinct min-cardinality subsets reaching s
 *
 * O(n × maxSum) time, O(maxSum) space.
 */
function dpMinSubsetSum(
  values: number[],
  maxSum: number,
): { dp: Uint16Array; count: Float64Array } {
  const dp = new Uint16Array(maxSum + 1).fill(65535);
  const count = new Float64Array(maxSum + 1);
  dp[0] = 0;
  count[0] = 1;

  for (const v of values) {
    // Right to left: each element used at most once (0/1 knapsack)
    for (let s = maxSum; s >= v; s--) {
      const newK = dp[s - v] + 1;
      if (newK < dp[s]) {
        dp[s] = newK;
        count[s] = count[s - v];
      } else if (newK === dp[s] && newK < 65535) {
        count[s] = Math.min(count[s] + count[s - v], 1e9); // cap to avoid overflow
      }
    }
  }

  return { dp, count };
}

/**
 * DFS to find one actual path of exactly K elements summing to target.
 * Candidates must be sorted descending by statValue.
 *
 * DP-guided pruning: when the DP table is provided, each branch checks
 * whether the remaining sum is achievable with the remaining dart slots.
 * This eliminates dead branches early, making reconstruction near-instant
 * even with 200+ candidates. Pruning is optimistic (DP was built on the
 * full pool, not just unused elements) so correctness is preserved.
 */
function findPathOfK(
  candidates: DeduplicatedPlayer[],
  target: number,
  k: number,
  dp?: Uint16Array,
): DeduplicatedPlayer[] | null {
  const result: DeduplicatedPlayer[] = [];

  function dfs(remaining: number, startIdx: number, depth: number): boolean {
    if (remaining === 0 && depth === k) return true;
    if (depth >= k || remaining <= 0) return false;

    const dartsLeft = k - depth;
    for (let i = startIdx; i < candidates.length; i++) {
      const v = candidates[i].statValue;
      if (v > remaining) continue;
      // Pruning: if largest remaining can't fill the target in dartsLeft
      if (v * dartsLeft < remaining) break; // sorted desc
      // DP-guided pruning: skip if remaining-v needs more darts than we'll have
      const newRemaining = remaining - v;
      if (dp && newRemaining > 0 && newRemaining < dp.length && dp[newRemaining] > dartsLeft - 1) continue;
      result.push(candidates[i]);
      if (dfs(newRemaining, i + 1, depth + 1)) return true;
      result.pop();
    }
    return false;
  }

  dfs(target, 0, 0);
  return result.length === k ? result : null;
}

/**
 * Generate a target with a short ghost path using DP subset sum on the
 * FULL candidate pool.
 *
 * Algorithm:
 * 1. Dedup pool — use ALL candidates (not just top 50)
 * 2. Build DP: minimum elements + solution count for every reachable sum
 * 3. Compute idealGhostK = max(3, hardLimit - 2):
 *      Sparse (HR/SV): 3 darts
 *      Standard (RBI/SB/BB/K/R): 4 darts
 *      Dense (H/TB/W): 5 darts
 * 4. Select targets where dp[t] = idealGhostK with ≥ 2 solutions
 * 5. Reconstruct ghost via DFS + DP-guided pruning (near-instant)
 *
 * maxSum = sum of top normalDartLimit values (generous ceiling for
 * playable targets reachable within normal mode).
 */
function generateTarget(
  pool: PlayerSeason[],
  statKey: StatKey,
  rng: () => number,
  hardLimit: number,
  normalDartLimit: number,
): { target: number; ghostPath: GhostStep[] } {
  const deduped = deduplicatePool(pool, statKey);

  // Use full pool — DP is O(n×maxSum) and DP-guided DFS handles large pools
  const candidates = deduped;
  const values = candidates.map(d => d.statValue);

  // Ghost target: find naturally short paths
  const idealGhostK = Math.max(3, hardLimit - 2);

  // maxSum = sum of top normalDartLimit values (upper bound for playable targets)
  const topNValues = values.slice(0, Math.min(normalDartLimit, values.length));
  const maxSum = topNValues.reduce((a, b) => a + b, 0);

  if (maxSum === 0 || values.length < idealGhostK) {
    const fallback = values.slice(0, 3).reduce((a, b) => a + b, 0) || 100;
    return { target: fallback, ghostPath: [] };
  }

  // Build DP on full candidate pool
  const { dp, count } = dpMinSubsetSum(values, maxSum);

  // Target range: 25%-90% of maxSum for interesting gameplay
  const minTarget = Math.max(2, Math.round(maxSum * 0.25));
  const maxTarget = Math.round(maxSum * 0.90);
  const allStatValues = new Set(values);

  // Tier 1: idealGhostK with ≥ 2 distinct solutions
  let targetCandidates: number[] = [];
  for (let t = minTarget; t <= maxTarget; t++) {
    if (dp[t] === idealGhostK && count[t] >= 2 && !allStatValues.has(t)) {
      targetCandidates.push(t);
    }
  }

  // Tier 2: idealGhostK + 1 (slightly longer ghost — still good)
  if (targetCandidates.length < 5) {
    const altK = idealGhostK + 1;
    if (altK <= hardLimit) {
      for (let t = minTarget; t <= maxTarget; t++) {
        if (dp[t] === altK && count[t] >= 2 && !allStatValues.has(t)) {
          targetCandidates.push(t);
        }
      }
    }
  }

  // Tier 3: idealGhostK - 1 (even shorter — impressive!)
  if (targetCandidates.length < 5) {
    const altK = idealGhostK - 1;
    if (altK >= 2) {
      for (let t = minTarget; t <= maxTarget; t++) {
        if (dp[t] === altK && count[t] >= 2 && !allStatValues.has(t)) {
          targetCandidates.push(t);
        }
      }
    }
  }

  // Tier 4: any K from 2 to hardLimit
  if (targetCandidates.length === 0) {
    for (let t = minTarget; t <= maxTarget; t++) {
      if (dp[t] >= 2 && dp[t] <= hardLimit && count[t] >= 2 && !allStatValues.has(t)) {
        targetCandidates.push(t);
      }
    }
  }

  // Emergency: sum of top 3
  if (targetCandidates.length === 0) {
    const fallback = values.slice(0, 3).reduce((a, b) => a + b, 0);
    const path = findPathOfK(candidates, fallback, Math.min(3, candidates.length), dp);
    return {
      target: fallback,
      ghostPath: path ? path.map(toGhostStep) : [],
    };
  }

  // Pick target using seeded RNG
  const chosenTarget = targetCandidates[Math.floor(rng() * targetCandidates.length)];

  // Ghost path: find true minimum-cardinality path with DP-guided DFS
  const ghostK = dp[chosenTarget];
  let path = findPathOfK(candidates, chosenTarget, ghostK, dp);

  // Fallback: try ghostK + 1 if exact K path not found (extremely rare)
  if (!path && ghostK < normalDartLimit) {
    path = findPathOfK(candidates, chosenTarget, ghostK + 1, dp);
  }

  return {
    target: chosenTarget,
    ghostPath: path ? path.map(toGhostStep) : [],
  };
}

function toGhostStep(p: DeduplicatedPlayer): GhostStep {
  return {
    name: p.season.name,
    yearID: p.season.yearID,
    teamID: p.season.teamID,
    statValue: p.statValue,
  };
}

// ── Build player pool from config ────────────────────────────────────────────
function buildPool(allPlayers: PlayerSeason[], config: ChallengeConfig): PlayerSeason[] {
  const isRange = config.seasonStart !== undefined;
  const minStatValue = config.threshold ?? 1;
  const filterStatKey = config.thresholdStatKey ?? config.statKey;
  
  return isRange
    ? allPlayers.filter(p =>
        p.yearID >= config.seasonStart! &&
        p.yearID <= (config.seasonEnd ?? config.seasonStart!) &&
        getStatValue(p, filterStatKey) >= minStatValue &&
        getStatValue(p, config.statKey) > 0 // Ensure they have >0 of the target stat
      )
    : filterByStat(allPlayers, config.statKey, config.season!);
}

// ── Restriction validation gate ──────────────────────────────────────────────
/**
 * Validates that a restriction produces a solvable challenge.
 * Gate checks:
 * 1. Restricted pool has ≥ MIN_RESTRICTED_POOL deduped players
 * 2. Target generation succeeds (not just fallback)
 * Returns the restriction if valid, undefined if it should be dropped.
 */
function validateRestrictions(
  pool: PlayerSeason[],
  restrictions: Restriction[],
  statKey: StatKey,
  dartLimit: number,
  rng: () => number,
): { valid: boolean; restrictedPool: PlayerSeason[] } {
  const restrictedPool = filterByRestrictions(pool, restrictions);

  // Gate 1: enough deduped players
  const deduped = deduplicatePool(restrictedPool, statKey);
  if (deduped.length < MIN_RESTRICTED_POOL) {
    return { valid: false, restrictedPool };
  }

  // Gate 2: can we generate a validated target? (dry run)
  const testRng = seedrandom(rng().toString());
  const hardLimit = getDartLimit('hard', getStatDensity(statKey));
  const result = generateTarget(restrictedPool, statKey, testRng, hardLimit, dartLimit);
  if (result.ghostPath.length === 0) {
    return { valid: false, restrictedPool };
  }

  return { valid: true, restrictedPool };
}

// ── Build description string ─────────────────────────────────────────────────
// This is now purely used as a clean fallback for shareText.ts
function buildDescription(
  config: ChallengeConfig,
  restrictions?: Restriction[],
): string {
  const isRange = config.seasonStart !== undefined;
  const seasonDisplay = isRange
    ? `${config.seasonStart}–${config.seasonEnd}`
    : String(config.season);

  if (restrictions && restrictions.length > 0) {
    const labels = restrictions.map(r => r.label).join(' & ');
    return `${seasonDisplay} MLB · ${config.statLabel} (${labels})`;
  } else {
    return `${seasonDisplay} MLB · ${config.statLabel}`;
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────
export function getDailyChallenge(allPlayers: PlayerSeason[]): DailyChallenge {
  const today = new Date().toISOString().split('T')[0];
  const challengeNumber = Math.max(1, daysBetween(EPOCH_DATE, today));

  // DEV: use override config if set
  const config: ChallengeConfig = DEV_OVERRIDE ?? (() => {
    const rng = seedrandom(today);
    return CHALLENGE_CONFIGS[Math.floor(rng() * CHALLENGE_CONFIGS.length)];
  })();

  const pool = buildPool(allPlayers, config);

  // Restriction: Multi-category combinatorial picking
  // MUTUAL EXCLUSIVITY: configs with stat thresholds skip restriction logic
  let selectedRestrictions: Restriction[] = [];
  const hasThreshold = config.threshold != null;

  if (!hasThreshold && config.season === undefined) {
    const restrictRng = seedrandom(today + '-restrict-combo');
    const MAX_RETRIES = 10;
    
    const density = getStatDensity(config.statKey);
    const dartLimit = getDartLimit('normal', density);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const numRestrictions = 1;
      
      // Pick N distinct categories
      const categoryKeys = Object.keys(RESTRICTION_CATEGORIES);
      for (let i = categoryKeys.length - 1; i > 0; i--) {
        const j = Math.floor(restrictRng() * (i + 1));
        [categoryKeys[i], categoryKeys[j]] = [categoryKeys[j], categoryKeys[i]];
      }
      const selectedCategories = categoryKeys.slice(0, numRestrictions);
      
      // Pick 1 specific constraint from each chosen category
      const candidateRestrictions: Restriction[] = [];
      for (const cat of selectedCategories) {
        const options = RESTRICTION_CATEGORIES[cat];
        const selected = options[Math.floor(restrictRng() * options.length)];
        candidateRestrictions.push(selected);
      }
      
      // Validate combination
      const validation = validateRestrictions(pool, candidateRestrictions, config.statKey, dartLimit, restrictRng);
      if (validation.valid) {
        selectedRestrictions = candidateRestrictions;
        break;
      }
    }

    // Fallback to All-Star if everything failed
    if (selectedRestrictions.length === 0) {
      const fallback: Restriction = { type: 'allstar', label: 'All-Star same season' };
      const val = validateRestrictions(pool, [fallback], config.statKey, dartLimit, restrictRng);
      if (val.valid) selectedRestrictions = [fallback];
    }
  }

  const finalPool = selectedRestrictions.length > 0 ? filterByRestrictions(pool, selectedRestrictions) : pool;

  // Generate target: desiredK = hard dart limit (best path = hard mode darts)
  const density = hasThreshold ? getStatDensity(config.statKey) : getStatDensity(config.statKey);
  const dartLimit = hasThreshold ? getDartLimit('normal', density) : getDartLimit('normal', density);
  const targetRng = seedrandom(today + '-target-gen');
  const hardLimit = getDartLimit('hard', density);
  const { target, ghostPath } = generateTarget(finalPool, config.statKey, targetRng, hardLimit, dartLimit);

  const displaySeason = config.season ?? config.seasonEnd ?? config.seasonStart ?? 2025;

  return {
    challengeNumber,
    date: today,
    sport: 'MLB',
    season: displaySeason,
    seasonStart: config.seasonStart,
    seasonEnd: config.seasonEnd,
    statKey: config.statKey,
    statLabel: config.statLabel,
    targetScore: target,
    restrictions: selectedRestrictions.length > 0 ? selectedRestrictions : undefined,
    description: buildDescription(config, selectedRestrictions.length > 0 ? selectedRestrictions : undefined),
    threshold: config.threshold,
    thresholdStatKey: config.thresholdStatKey,
    thresholdStatLabel: config.thresholdStatLabel,
    ghostPath,
  };
}

// For dev playtesting: get challenge for a specific config index (0-29)
export function getChallengeByIndex(allPlayers: PlayerSeason[], configIndex: number): DailyChallenge {
  const config = CHALLENGE_CONFIGS[configIndex % CHALLENGE_CONFIGS.length];
  const displaySeason = config.season ?? config.seasonEnd ?? config.seasonStart ?? 2025;

  const pool = buildPool(allPlayers, config);

  // Use config index as seed for deterministic but varied results per config
  const density = getStatDensity(config.statKey);
  const dartLimit = getDartLimit('normal', density);

  // ── Apply Restrictions for Dev Cycling ──
  const hasThreshold = config.threshold != null;
  let selectedRestrictions: Restriction[] = [];

  if (!hasThreshold && config.season === undefined) {
    const restrictRng = seedrandom(`dev-restrict-${configIndex}`);
    const MAX_RETRIES = 10;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const numRestrictions = 1;
      
      const categoryKeys = Object.keys(RESTRICTION_CATEGORIES);
      for (let i = categoryKeys.length - 1; i > 0; i--) {
        const j = Math.floor(restrictRng() * (i + 1));
        [categoryKeys[i], categoryKeys[j]] = [categoryKeys[j], categoryKeys[i]];
      }
      const selectedCategories = categoryKeys.slice(0, numRestrictions);
      
      const candidateRestrictions: Restriction[] = [];
      for (const cat of selectedCategories) {
        const options = RESTRICTION_CATEGORIES[cat];
        const selected = options[Math.floor(restrictRng() * options.length)];
        candidateRestrictions.push(selected);
      }
      
      const validation = validateRestrictions(pool, candidateRestrictions, config.statKey, dartLimit, restrictRng);
      if (validation.valid) {
        selectedRestrictions = candidateRestrictions;
        break;
      }
    }
  }

  const finalPool = selectedRestrictions.length > 0 ? filterByRestrictions(pool, selectedRestrictions) : pool;

  const targetRng = seedrandom(`dev-config-${configIndex}`);
  const hardLimit = getDartLimit('hard', density);
  const { target, ghostPath } = generateTarget(finalPool, config.statKey, targetRng, hardLimit, dartLimit);

  return {
    challengeNumber: configIndex + 1,
    date: new Date().toISOString().split('T')[0],
    sport: 'MLB',
    season: displaySeason,
    seasonStart: config.seasonStart,
    seasonEnd: config.seasonEnd,
    statKey: config.statKey,
    statLabel: config.statLabel,
    targetScore: target,
    restrictions: selectedRestrictions.length > 0 ? selectedRestrictions : undefined,
    description: buildDescription(config, selectedRestrictions.length > 0 ? selectedRestrictions : undefined),
    threshold: config.threshold,
    thresholdStatKey: config.thresholdStatKey,
    thresholdStatLabel: config.thresholdStatLabel,
    ghostPath,
  };
}

// For testing/preview: get challenge for a specific date
export function getChallengeForDate(allPlayers: PlayerSeason[], dateStr: string): DailyChallenge {
  const challengeNumber = Math.max(1, daysBetween(EPOCH_DATE, dateStr));
  const rng = seedrandom(dateStr);
  const configIndex = Math.floor(rng() * CHALLENGE_CONFIGS.length);
  const config = CHALLENGE_CONFIGS[configIndex];
  const displaySeason = config.season ?? config.seasonEnd ?? config.seasonStart ?? 2025;

  const pool = buildPool(allPlayers, config);

  // Restriction logic for preview mode
  let selectedRestrictions: Restriction[] = [];
  const restrictRng = seedrandom(dateStr + '-restrict-combo');
  const MAX_RETRIES = 10;
  
  const density = getStatDensity(config.statKey);
  const dartLimit = getDartLimit('normal', density);
  const hasThreshold = config.threshold != null;

  if (!hasThreshold && config.season === undefined) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const numRestrictions = 1;
    
    const categoryKeys = Object.keys(RESTRICTION_CATEGORIES);
    for (let i = categoryKeys.length - 1; i > 0; i--) {
      const j = Math.floor(restrictRng() * (i + 1));
      [categoryKeys[i], categoryKeys[j]] = [categoryKeys[j], categoryKeys[i]];
    }
    const selectedCategories = categoryKeys.slice(0, numRestrictions);
    
    const candidateRestrictions: Restriction[] = [];
    for (const cat of selectedCategories) {
      const options = RESTRICTION_CATEGORIES[cat];
      const selected = options[Math.floor(restrictRng() * options.length)];
      candidateRestrictions.push(selected);
    }
    
    const validation = validateRestrictions(pool, candidateRestrictions, config.statKey, dartLimit, restrictRng);
    if (validation.valid) {
      selectedRestrictions = candidateRestrictions;
      break;
    }
  }
}

  const finalPool = selectedRestrictions.length > 0 ? filterByRestrictions(pool, selectedRestrictions) : pool;

  const targetRng = seedrandom(dateStr + '-target');
  const hardLimit = getDartLimit('hard', density);
  const { target, ghostPath } = generateTarget(finalPool, config.statKey, targetRng, hardLimit, dartLimit);

  return {
    challengeNumber,
    date: dateStr,
    sport: 'MLB',
    season: displaySeason,
    seasonStart: config.seasonStart,
    seasonEnd: config.seasonEnd,
    statKey: config.statKey,
    statLabel: config.statLabel,
    targetScore: target,
    restrictions: selectedRestrictions.length > 0 ? selectedRestrictions : undefined,
    description: buildDescription(config, selectedRestrictions.length > 0 ? selectedRestrictions : undefined),
    ghostPath,
  };
}
