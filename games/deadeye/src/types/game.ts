// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Core TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

export type GameMode = 'easy' | 'normal' | 'hard';

export type StatDensity = 'sparse' | 'standard' | 'dense';

export interface PlayerSeason {
  id: string;            // "aaronha01-1957"
  playerID: string;
  name: string;          // "Hank Aaron"
  teamID: string;        // normalized (NYY not NYA); "NYY/BOS" if traded mid-season
  yearID: number;
  role: 'batter' | 'pitcher';
  // Batting counting stats
  HR: number;
  RBI: number;
  H: number;
  SB: number;
  BB: number;
  R: number;
  TB: number;            // total bases: H + 2B + 2×3B + 3×HR
  SO: number;            // batting strikeouts (batter only; 0 for pitchers)
  // Rate stats ×1000 (e.g., .356 AVG → 356; batters only, pitchers get 0)
  AVG: number;
  OBP: number;
  // Pitching counting stats (role=pitcher only; 0 otherwise)
  SV: number;
  K: number;             // pitcher strikeouts
  // Attribute flags from enrichment CSVs
  isAllStar: boolean;           // appeared in All-Star Game that yearID
  careerAllStars: number;       // total career All-Star appearances
  isHOF: boolean;               // inducted into Hall of Fame
  awards: string[];             // e.g. ["Gold Glove", "Most Valuable Player"]
  wonWorldSeries: boolean;      // player's team won World Series that year
  isRookie: boolean;            // first qualifying season for this playerID
  // Stat leader flags (led MLB that yearID)
  ledHR: boolean;
  ledH: boolean;
  ledSB: boolean;
  ledRBI: boolean;
  ledR: boolean;
  ledK: boolean;                // pitcher K leader
  // Positional award flags
  goldGloveIF: boolean;         // Gold Glove at 1B/2B/3B/SS
  goldGloveOF: boolean;         // Gold Glove at OF/RF/LF/CF
  goldGloveP: boolean;          // Gold Glove as pitcher
  hasCareerGoldGlove: boolean;
  hasCareerGoldGloveIF: boolean;
  hasCareerGoldGloveOF: boolean;
  hasCareerGoldGloveP: boolean;
  hasCareerMVP: boolean;
  hasCareerCyYoung: boolean;
  hasCareerSilverSlugger: boolean;
  // Voting & ring
  rotyVotes: boolean;           // received ROTY votes
  hasRing: boolean;             // appeared in WS for winning team
}

export type StatKey = 'HR' | 'RBI' | 'H' | 'SB' | 'BB' | 'R' | 'TB' | 'SO' | 'SV' | 'K' | 'AVG' | 'OBP';

export interface Restriction {
  type: 'allstar' | 'hof' | 'award' | 'ws_winner' | 'rookie' | 'league' | 'division'
    | 'mvp' | 'cy_young' | 'silver_slugger' | 'gold_glove' | 'gold_glove_season'
    | 'mvp_season' | 'cy_young_season' | 'silver_slugger_season'
    | 'gg_infield' | 'gg_outfield' | 'gg_pitcher'
    | 'gg_infield_season' | 'gg_outfield_season' | 'gg_pitcher_season'
    | 'roty_votes' | 'ws_ring';
  label: string;         // "Hall of Famers only"
  value?: string;        // e.g. "Gold Glove" for award type
}

export interface ChallengeConfig {
  season?: number;           // single year (mutually exclusive with range)
  seasonStart?: number;      // range start
  seasonEnd?: number;        // range end
  statKey: StatKey;          // stat used for scoring
  statLabel: string;
  threshold?: number;        // minimum stat value to qualify (e.g., 40 for 40+ HR)
  thresholdStatKey?: StatKey; // optional decoupled stat for the threshold filter (e.g. filter by 40+ HR, score by RBI)
  thresholdStatLabel?: string;
}

export interface GhostStep {
  name: string;
  yearID: number;
  teamID: string;
  statValue: number;
}

export interface DailyChallenge {
  challengeNumber: number;   // days since epoch start date
  date: string;              // "2026-02-27"
  sport: 'MLB';
  season: number;            // primary/display year (end year for ranges)
  seasonStart?: number;      // set for multi-year range challenges
  seasonEnd?: number;        // set for multi-year range challenges
  statKey: StatKey;
  statLabel: string;
  targetScore: number;       // validated target (not trivially solvable)
  restrictions?: Restriction[];
  description: string;       // "1998 MLB · Home Runs" or "2010–2025 MLB · Strikeouts" (Legacy share text)
  threshold?: number;        // e.g. 40
  thresholdStatKey?: StatKey; // e.g. "HR"
  thresholdStatLabel?: string; // e.g. "Home Runs"
  ghostPath?: GhostStep[];   // pre-computed valid solution path for post-game display
}

export type DartQuality = 'bullseye' | 'great' | 'normal' | 'miss';

export interface Dart {
  playerSeason: PlayerSeason;
  statValue: number;
  previousScore: number;
  newScore: number;           // may be negative in easy mode
  quality: DartQuality;
}

export type GameStatus = 'playing' | 'bust' | 'perfect' | 'standing' | 'out_of_darts';

export type SecretBadge = 'scenic_route' | 'franchise_bonus';

export interface GameState {
  challenge: DailyChallenge;
  darts: Dart[];
  remainingScore: number;    // distance from 0 (always positive)
  status: GameStatus;
  mode: GameMode;
  dartLimit: number;         // Infinity for Easy, 5-10 for Normal/Hard
  strikes: number;           // Easy mode: overshoot count (3 = bust)
  starRating?: number;       // 0-5 stars
  badges?: SecretBadge[];    // awarded at game over
}
