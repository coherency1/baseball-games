// ─────────────────────────────────────────────────────────────────────────────
// Deadeye — Core TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

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
}

export type StatKey = 'HR' | 'RBI' | 'H' | 'SB' | 'BB' | 'R' | 'XBH' | 'W' | 'SV' | 'K';

export interface Restriction {
  type: 'allstar' | 'hof' | 'award' | 'ws_winner';
  label: string;         // "Hall of Famers only"
  value?: string;        // e.g. "Gold Glove" for award type
}

export interface ChallengeConfig {
  season: number;
  statKey: StatKey;
  statLabel: string;
}

export interface DailyChallenge {
  challengeNumber: number;   // days since epoch start date
  date: string;              // "2026-02-27"
  sport: 'MLB';
  season: number;
  statKey: StatKey;
  statLabel: string;
  targetScore: number;       // sum of top 5 qualifying player-seasons
  restriction?: Restriction;
  description: string;       // "1998 MLB · Home Runs"
}

export type DartQuality = 'bullseye' | 'great' | 'good' | 'small';

export interface Dart {
  playerSeason: PlayerSeason;
  statValue: number;
  previousScore: number;
  newScore: number;           // may be negative in easy mode
  quality: DartQuality;
}

export type GameStatus = 'playing' | 'bust' | 'perfect' | 'standing';

export interface GameState {
  challenge: DailyChallenge;
  darts: Dart[];
  remainingScore: number;    // Math.abs in easy mode when negative
  status: GameStatus;
  hardMode: boolean;
}
