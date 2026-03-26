import { describe, it, expect } from "vitest";
import { matchesCategory, findMatchingSeasons, generatePuzzle, CATEGORY_TYPES, SCORING_STATS } from "../engine.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mkPS = (overrides = {}) => ({
  name: "Test Player",
  team: "NYY",
  year: 2022,
  pos: "OF",
  bats: "R",
  HR: 30, RBI: 90, R: 80, H: 150, SB: 5, BB: 60, SO: 100, "2B": 25, XBH: 40,
  AVG: 0.280, OBP: 0.360, SLG: 0.500, OPS: 0.860, PA: 600, AB: 550,
  ...overrides,
});

// ─── matchesCategory — TEAM ───────────────────────────────────────────────────

describe("matchesCategory — TEAM", () => {
  const cat = { type: CATEGORY_TYPES.TEAM, value: "NYY" };

  it("matches when team equals category value", () => {
    expect(matchesCategory(mkPS({ team: "NYY" }), cat)).toBe(true);
  });

  it("rejects when team differs", () => {
    expect(matchesCategory(mkPS({ team: "BOS" }), cat)).toBe(false);
  });

  it("is case-sensitive (abbr must match exactly)", () => {
    expect(matchesCategory(mkPS({ team: "nyy" }), cat)).toBe(false);
  });
});

// ─── matchesCategory — DIVISION ───────────────────────────────────────────────

describe("matchesCategory — DIVISION", () => {
  const cat = { type: CATEGORY_TYPES.DIVISION, value: "AL East" };

  it("accepts a team in the specified division", () => {
    expect(matchesCategory(mkPS({ team: "NYY" }), cat)).toBe(true); // NYY ∈ AL East
    expect(matchesCategory(mkPS({ team: "BOS" }), cat)).toBe(true); // BOS ∈ AL East
  });

  it("rejects a team from a different division", () => {
    expect(matchesCategory(mkPS({ team: "HOU" }), cat)).toBe(false); // AL West
    expect(matchesCategory(mkPS({ team: "LAD" }), cat)).toBe(false); // NL West
  });

  it("returns false for team abbreviation not in MLB_TEAMS", () => {
    expect(matchesCategory(mkPS({ team: "XYZ" }), cat)).toBe(false);
  });
});

// ─── matchesCategory — LEAGUE ─────────────────────────────────────────────────

describe("matchesCategory — LEAGUE", () => {
  it("accepts AL team for AL league", () => {
    const cat = { type: CATEGORY_TYPES.LEAGUE, value: "AL" };
    expect(matchesCategory(mkPS({ team: "NYY" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ team: "HOU" }), cat)).toBe(true);
  });

  it("rejects NL team for AL league", () => {
    const cat = { type: CATEGORY_TYPES.LEAGUE, value: "AL" };
    expect(matchesCategory(mkPS({ team: "LAD" }), cat)).toBe(false);
    expect(matchesCategory(mkPS({ team: "ATL" }), cat)).toBe(false);
  });

  it("accepts NL team for NL league", () => {
    const cat = { type: CATEGORY_TYPES.LEAGUE, value: "NL" };
    expect(matchesCategory(mkPS({ team: "LAD" }), cat)).toBe(true);
  });

  it("rejects AL team for NL league", () => {
    const cat = { type: CATEGORY_TYPES.LEAGUE, value: "NL" };
    expect(matchesCategory(mkPS({ team: "NYY" }), cat)).toBe(false);
  });
});

// ─── matchesCategory — ALL_TEAMS ─────────────────────────────────────────────

describe("matchesCategory — ALL_TEAMS", () => {
  const cat = { type: CATEGORY_TYPES.ALL_TEAMS, value: "all" };

  it("always returns true regardless of team", () => {
    expect(matchesCategory(mkPS({ team: "NYY" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ team: "LAD" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ team: "XYZ" }), cat)).toBe(true);
  });
});

// ─── matchesCategory — YEAR_RANGE ────────────────────────────────────────────

describe("matchesCategory — YEAR_RANGE", () => {
  const cat = { type: CATEGORY_TYPES.YEAR_RANGE, value: [2010, 2020] };

  it("accepts year exactly at lower bound", () => {
    expect(matchesCategory(mkPS({ year: 2010 }), cat)).toBe(true);
  });

  it("accepts year exactly at upper bound", () => {
    expect(matchesCategory(mkPS({ year: 2020 }), cat)).toBe(true);
  });

  it("accepts year in the middle of the range", () => {
    expect(matchesCategory(mkPS({ year: 2015 }), cat)).toBe(true);
  });

  it("rejects year one below lower bound", () => {
    expect(matchesCategory(mkPS({ year: 2009 }), cat)).toBe(false);
  });

  it("rejects year one above upper bound", () => {
    expect(matchesCategory(mkPS({ year: 2021 }), cat)).toBe(false);
  });
});

// ─── matchesCategory — YEAR_EXACT ────────────────────────────────────────────

describe("matchesCategory — YEAR_EXACT", () => {
  const cat = { type: CATEGORY_TYPES.YEAR_EXACT, value: 2024 };

  it("accepts exactly the target year", () => {
    expect(matchesCategory(mkPS({ year: 2024 }), cat)).toBe(true);
  });

  it("rejects adjacent years", () => {
    expect(matchesCategory(mkPS({ year: 2023 }), cat)).toBe(false);
    expect(matchesCategory(mkPS({ year: 2025 }), cat)).toBe(false);
  });
});

// ─── matchesCategory — POSITION ──────────────────────────────────────────────

describe("matchesCategory — POSITION", () => {
  it("exact position match (C, 1B, 2B, 3B, SS)", () => {
    const cat = { type: CATEGORY_TYPES.POSITION, value: "SS" };
    expect(matchesCategory(mkPS({ pos: "SS" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "2B" }), cat)).toBe(false);
  });

  it("OF umbrella accepts OF, LF, RF, CF", () => {
    const cat = { type: CATEGORY_TYPES.POSITION, value: "OF" };
    expect(matchesCategory(mkPS({ pos: "OF" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "LF" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "RF" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "CF" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "1B" }), cat)).toBe(false);
  });

  it("IF umbrella accepts 1B, 2B, 3B, SS, IF", () => {
    const cat = { type: CATEGORY_TYPES.POSITION, value: "IF" };
    expect(matchesCategory(mkPS({ pos: "1B" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "2B" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "3B" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "SS" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "IF" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "OF" }), cat)).toBe(false);
    expect(matchesCategory(mkPS({ pos: "C"  }), cat)).toBe(false);
  });

  it("DH is 'any position' — all hitters qualify", () => {
    const cat = { type: CATEGORY_TYPES.POSITION, value: "DH" };
    for (const pos of ["OF", "1B", "2B", "3B", "SS", "C", "DH", "IF", "LF", "RF", "CF"]) {
      expect(matchesCategory(mkPS({ pos }), cat), `DH cat should accept pos=${pos}`).toBe(true);
    }
  });

  it("UTL is 'any position' — all hitters qualify", () => {
    const cat = { type: CATEGORY_TYPES.POSITION, value: "UTL" };
    for (const pos of ["OF", "1B", "2B", "SS", "C", "DH"]) {
      expect(matchesCategory(mkPS({ pos }), cat), `UTL cat should accept pos=${pos}`).toBe(true);
    }
  });

  it("specific outfield sub-position (LF) only accepts that sub-position", () => {
    const cat = { type: CATEGORY_TYPES.POSITION, value: "LF" };
    expect(matchesCategory(mkPS({ pos: "LF" }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ pos: "RF" }), cat)).toBe(false);
    expect(matchesCategory(mkPS({ pos: "CF" }), cat)).toBe(false);
    expect(matchesCategory(mkPS({ pos: "OF" }), cat)).toBe(false);
  });
});

// ─── matchesCategory — BATS ───────────────────────────────────────────────────

describe("matchesCategory — BATS", () => {
  it("matches correct batting hand", () => {
    expect(matchesCategory(mkPS({ bats: "R" }), { type: CATEGORY_TYPES.BATS, value: "R" })).toBe(true);
    expect(matchesCategory(mkPS({ bats: "L" }), { type: CATEGORY_TYPES.BATS, value: "L" })).toBe(true);
    expect(matchesCategory(mkPS({ bats: "S" }), { type: CATEGORY_TYPES.BATS, value: "S" })).toBe(true);
  });

  it("rejects wrong batting hand", () => {
    expect(matchesCategory(mkPS({ bats: "L" }), { type: CATEGORY_TYPES.BATS, value: "R" })).toBe(false);
    expect(matchesCategory(mkPS({ bats: "R" }), { type: CATEGORY_TYPES.BATS, value: "S" })).toBe(false);
  });
});

// ─── matchesCategory — STAT_THRESHOLD ────────────────────────────────────────

describe("matchesCategory — STAT_THRESHOLD", () => {
  it("accepts when stat meets the threshold exactly", () => {
    const cat = { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "HR", min: 30 } };
    expect(matchesCategory(mkPS({ HR: 30 }), cat)).toBe(true);
  });

  it("accepts when stat exceeds the threshold", () => {
    const cat = { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "HR", min: 30 } };
    expect(matchesCategory(mkPS({ HR: 62 }), cat)).toBe(true);
  });

  it("rejects when stat is one below threshold", () => {
    const cat = { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "HR", min: 30 } };
    expect(matchesCategory(mkPS({ HR: 29 }), cat)).toBe(false);
  });

  it("treats missing stat as 0 (does not throw)", () => {
    const cat = { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "HR", min: 1 } };
    const ps = mkPS();
    delete ps.HR;
    expect(matchesCategory(ps, cat)).toBe(false);
  });

  it("works for AVG threshold", () => {
    const cat = { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "AVG", min: 0.300 } };
    expect(matchesCategory(mkPS({ AVG: 0.300 }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ AVG: 0.299 }), cat)).toBe(false);
  });

  it("works for RBI threshold", () => {
    const cat = { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "RBI", min: 100 } };
    expect(matchesCategory(mkPS({ RBI: 100 }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ RBI:  99 }), cat)).toBe(false);
  });

  it("works for SB threshold", () => {
    const cat = { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "SB", min: 40 } };
    expect(matchesCategory(mkPS({ SB: 40 }), cat)).toBe(true);
    expect(matchesCategory(mkPS({ SB: 39 }), cat)).toBe(false);
  });
});

// ─── matchesCategory — unknown type ──────────────────────────────────────────

describe("matchesCategory — unknown category type", () => {
  it("returns false for an unrecognised type", () => {
    const cat = { type: "UNKNOWN_TYPE", value: "whatever" };
    expect(matchesCategory(mkPS(), cat)).toBe(false);
  });
});

// ─── findMatchingSeasons ──────────────────────────────────────────────────────

describe("findMatchingSeasons", () => {
  const seasons = [
    mkPS({ name: "Aaron Judge",   team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 62 }),
    mkPS({ name: "Shohei Ohtani", team: "LAA", year: 2021, pos: "DH", bats: "L", HR: 46 }),
    mkPS({ name: "Freddie Freeman", team: "LAD", year: 2022, pos: "1B", bats: "L", HR: 21 }),
    mkPS({ name: "Jose Ramirez",  team: "CLE", year: 2022, pos: "3B", bats: "S", HR: 29 }),
    mkPS({ name: "Paul Goldschmidt", team: "STL", year: 2022, pos: "1B", bats: "R", HR: 35 }),
  ];

  it("returns all seasons that match all three categories", () => {
    const cats = [
      { type: CATEGORY_TYPES.ALL_TEAMS, value: "all" },
      { type: CATEGORY_TYPES.YEAR_EXACT, value: 2022 },
      { type: CATEGORY_TYPES.BATS, value: "R" },
    ];
    const matches = findMatchingSeasons(cats, seasons);
    const names = matches.map(s => s.name);
    expect(names).toContain("Aaron Judge");
    expect(names).toContain("Paul Goldschmidt");
    expect(names).not.toContain("Shohei Ohtani");   // wrong year + bats
    expect(names).not.toContain("Freddie Freeman");  // bats L
    expect(names).not.toContain("Jose Ramirez");     // bats S
  });

  it("returns empty array when no season matches", () => {
    const cats = [
      { type: CATEGORY_TYPES.TEAM, value: "BOS" },
      { type: CATEGORY_TYPES.YEAR_EXACT, value: 2022 },
      { type: CATEGORY_TYPES.BATS, value: "R" },
    ];
    expect(findMatchingSeasons(cats, seasons)).toHaveLength(0);
  });

  it("filters correctly on stat threshold", () => {
    const cats = [
      { type: CATEGORY_TYPES.ALL_TEAMS, value: "all" },
      { type: CATEGORY_TYPES.YEAR_EXACT, value: 2022 },
      { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "HR", min: 30 } },
    ];
    const matches = findMatchingSeasons(cats, seasons);
    const names = matches.map(s => s.name);
    expect(names).toContain("Aaron Judge");        // 62 HR
    expect(names).toContain("Paul Goldschmidt");   // 35 HR
    expect(names).not.toContain("Jose Ramirez");   // 29 HR < 30
    expect(names).not.toContain("Freddie Freeman");// 21 HR < 30
  });
});

// ─── SCORING_STATS ────────────────────────────────────────────────────────────

describe("SCORING_STATS", () => {
  it("has 13 stat categories (8 batting + 5 pitching)", () => {
    expect(SCORING_STATS).toHaveLength(13);
  });

  it("each entry has key and label", () => {
    for (const s of SCORING_STATS) {
      expect(s.key).toBeTruthy();
      expect(s.label).toBeTruthy();
    }
  });

  it("contains the expected stat keys", () => {
    const keys = SCORING_STATS.map(s => s.key);
    expect(keys).toContain("HR");
    expect(keys).toContain("RBI");
    expect(keys).toContain("R");
    expect(keys).toContain("H");
    expect(keys).toContain("SB");
    expect(keys).toContain("SO");
    expect(keys).toContain("BB");
    expect(keys).toContain("2B");
    expect(keys).toContain("XBH");
  });
});

// ─── generatePuzzle — answer quality ─────────────────────────────────────────
//
// Synthetic dataset: 30 MLB teams × 10 years (2010-2019)
//   Pitchers:  4 starters (GS≥28, IP≥180, W≥13, SO≥160) +
//              3 closers  (SV≥25, GS=0) per team per year  →  2 100 seasons
//   Hitters:   8 per team per year across varied positions, hands, stats → 2 400 seasons
//
// With these counts, any reasonable (col1 × col2 × col3) combination produced by
// the generator can find 8–15 matching seasons in the primary loop, or falls back
// to the secondary (ALL_TEAMS, no max cap) which always has ≥8.

const ALL_TEAMS = [
  "NYY","BOS","BAL","TBR","TOR",  // AL East
  "CLE","DET","MIN","CWS","KCR",  // AL Central
  "HOU","OAK","SEA","LAA","TEX",  // AL West
  "ATL","NYM","PHI","MIA","WSN",  // NL East
  "CHC","STL","MIL","CIN","PIT",  // NL Central
  "LAD","SFG","ARI","COL","SDP",  // NL West
];
const TEST_YEARS = Array.from({ length: 10 }, (_, i) => 2010 + i);

const syntheticPitchers = ALL_TEAMS.flatMap(team =>
  TEST_YEARS.flatMap(year => [
    // 4 starters — span stats to cover all pitcher col3 thresholds
    ...Array.from({ length: 4 }, (_, i) => ({
      name: `SP_${team}_${year}_${i}`, team, year,
      GS: 28 + i, IP: 180 + i * 10, W: 13 + i * 2, SO: 160 + i * 20, SV: 0,
      ERA: 2.80 + i * 0.40, WHIP: 1.10 + i * 0.08,
    })),
    // 3 closers — SV thresholds well above both 10 and 20
    ...Array.from({ length: 3 }, (_, i) => ({
      name: `CL_${team}_${year}_${i}`, team, year,
      GS: 0, IP: 55 + i * 5, W: 2 + i, SO: 55 + i * 10, SV: 25 + i * 10,
      ERA: 2.50 + i * 0.50, WHIP: 0.90 + i * 0.10,
    })),
  ])
);

const syntheticHitters = ALL_TEAMS.flatMap(team =>
  TEST_YEARS.flatMap(year =>
    Array.from({ length: 8 }, (_, i) => ({
      name: `H_${team}_${year}_${i}`, team, year,
      pos:  ["OF", "OF", "1B", "2B", "3B", "SS", "C",  "OF"][i],
      bats: ["R",  "L",  "S",  "R",  "L",  "R",  "R",  "L" ][i],
      HR:   [42,   37,   31,   26,   33,   21,   23,   35  ][i],
      SB:   [6,    9,    46,   44,   22,   32,   7,    4   ][i],
      RBI:  [108,  100,  90,   85,   96,   72,   78,   112 ][i],
      H:    [188,  182,  170,  168,  164,  150,  152,  192 ][i],
      BB:   [82,   76,   42,   55,   66,   50,   45,   86  ][i],
      "2B": [38,   35,   22,   25,   32,   20,   25,   40  ][i],
      XBH:  [58,   52,   30,   36,   50,   38,   40,   62  ][i],
      AVG:  [.308, .302, .312, .288, .298, .268, .272, .320][i],
      R:    [95,   88,   65,   72,   85,   68,   75,   98  ][i],
      PA: 600,
    }))
  )
);

describe("generatePuzzle — answer quality (≥8 per row)", () => {
  it("10 random puzzles all have ≥8 valid answers per row", () => {
    for (let p = 0; p < 10; p++) {
      const puzzle = generatePuzzle(syntheticHitters, syntheticPitchers, 5);
      for (let r = 0; r < puzzle.rows.length; r++) {
        expect(
          puzzle.rows[r].validAnswers.length,
          `puzzle ${p} row ${r} (scoring: ${puzzle.scoringStat.key})`
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("SV-scoring puzzle rows each have ≥8 valid answers", () => {
    for (let p = 0; p < 5; p++) {
      const puzzle = generatePuzzle(syntheticHitters, syntheticPitchers, 5, "SV");
      for (let r = 0; r < puzzle.rows.length; r++) {
        expect(
          puzzle.rows[r].validAnswers.length,
          `SV puzzle ${p} row ${r}`
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("W-scoring puzzle rows each have ≥8 valid answers", () => {
    for (let p = 0; p < 5; p++) {
      const puzzle = generatePuzzle(syntheticHitters, syntheticPitchers, 5, "W");
      for (let r = 0; r < puzzle.rows.length; r++) {
        expect(
          puzzle.rows[r].validAnswers.length,
          `W puzzle ${p} row ${r}`
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("SO-scoring puzzle rows each have ≥8 valid answers", () => {
    for (let p = 0; p < 5; p++) {
      const puzzle = generatePuzzle(syntheticHitters, syntheticPitchers, 5, "SO");
      for (let r = 0; r < puzzle.rows.length; r++) {
        expect(
          puzzle.rows[r].validAnswers.length,
          `SO puzzle ${p} row ${r}`
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("ERA-scoring puzzle rows each have ≥8 valid answers", () => {
    for (let p = 0; p < 5; p++) {
      const puzzle = generatePuzzle(syntheticHitters, syntheticPitchers, 5, "ERA");
      for (let r = 0; r < puzzle.rows.length; r++) {
        expect(
          puzzle.rows[r].validAnswers.length,
          `ERA puzzle ${p} row ${r}`
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("HR-scoring hitter puzzle rows each have ≥8 valid answers", () => {
    for (let p = 0; p < 5; p++) {
      const puzzle = generatePuzzle(syntheticHitters, syntheticPitchers, 5, "HR");
      for (let r = 0; r < puzzle.rows.length; r++) {
        expect(
          puzzle.rows[r].validAnswers.length,
          `HR puzzle ${p} row ${r}`
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });
});

describe("generatePuzzle — role-compatible col3 for pitcher puzzles", () => {
  it("SV-scoring puzzle never generates IP or GS as col3 constraint", () => {
    for (let p = 0; p < 10; p++) {
      const puzzle = generatePuzzle(syntheticHitters, syntheticPitchers, 5, "SV");
      for (const row of puzzle.rows) {
        const col3 = row.categories[2];
        if (col3.type === CATEGORY_TYPES.STAT_THRESHOLD) {
          expect(
            col3.value.stat,
            `SV puzzle col3 should not use starter stat "${col3.value.stat}"`
          ).not.toMatch(/^(IP|GS|W)$/);
        }
      }
    }
  });

  it("W-scoring puzzle never generates SV as col3 constraint", () => {
    for (let p = 0; p < 10; p++) {
      const puzzle = generatePuzzle(syntheticHitters, syntheticPitchers, 5, "W");
      for (const row of puzzle.rows) {
        const col3 = row.categories[2];
        if (col3.type === CATEGORY_TYPES.STAT_THRESHOLD) {
          expect(
            col3.value.stat,
            `W puzzle col3 should not use closer stat "${col3.value.stat}"`
          ).not.toBe("SV");
        }
      }
    }
  });

  it("SO-scoring puzzle never generates SV as col3 constraint", () => {
    for (let p = 0; p < 10; p++) {
      const puzzle = generatePuzzle(syntheticHitters, syntheticPitchers, 5, "SO");
      for (const row of puzzle.rows) {
        const col3 = row.categories[2];
        if (col3.type === CATEGORY_TYPES.STAT_THRESHOLD) {
          expect(
            col3.value.stat,
            `SO puzzle col3 should not use closer stat "${col3.value.stat}"`
          ).not.toBe("SV");
        }
      }
    }
  });
});
