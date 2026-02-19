import { describe, it, expect } from "vitest";
import { matchesCategory, findMatchingSeasons, CATEGORY_TYPES, SCORING_STATS } from "../engine.js";

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
  it("has 9 stat categories", () => {
    expect(SCORING_STATS).toHaveLength(9);
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
