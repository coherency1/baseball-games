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
  XBH: number;           // 2B + 3B + HR
  // Rate stats ×1000 (e.g., .356 AVG → 356; batters only, pitchers get 0)
  AVG: number;
  OBP: number;
  OPS: number;
  // Pitching counting stats (role=pitcher only; 0 otherwise)
  W: number;
  SV: number;
  K: number;             // pitcher strikeouts
  // Attribute flags from enrichment CSVs
  isAllStar: boolean;           // appeared in All-Star Game that yearID
  careerAllStars: number;       // total career All-Star appearances
  isHOF: boolean;               // inducted into Hall of Fame
  awards: string[];             // e.g. ["Gold Glove", "Most Valuable Player"]
  wonWorldSeries: boolean;      // player's team won World Series that year
  isRookie: boolean;            // first qualifying season for this playerID
}

export type StatKey = 'HR' | 'RBI' | 'H' | 'SB' | 'BB' | 'R' | 'XBH' | 'W' | 'SV' | 'K' | 'AVG' | 'OBP' | 'OPS';

export interface Restriction {
  type: 'allstar' | 'hof' | 'award' | 'ws_winner' | 'rookie' | 'league' | 'division' | 'mvp' | 'cy_young' | 'silver_slugger' | 'gold_glove';
  label: string;         // "Hall of Famers only"
  value?: string;        // e.g. "Gold Glove" for award type
}

export interface ChallengeConfig {
  season?: number;           // single year (mutually exclusive with range)
  seasonStart?: number;      // range start
  seasonEnd?: number;        // range end
  statKey: StatKey;
  statLabel: string;
  threshold?: number;        // minimum stat value to qualify (e.g., 40 for 40+ HR)
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
  restriction?: Restriction;
  description: string;       // "1998 MLB · Home Runs" or "2010–2025 MLB · Strikeouts"
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

export interface GameState {
  challenge: DailyChallenge;
  darts: Dart[];
  remainingScore: number;    // distance from 0 (always positive)
  status: GameStatus;
  mode: GameMode;
  dartLimit: number;         // Infinity for Easy, 5-10 for Normal/Hard
  strikes: number;           // Easy mode: overshoot count (3 = bust)
}
