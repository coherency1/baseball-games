import { describe, it, expect } from "vitest";
import { parseCSVText, buildPlayerSeasons, LAHMAN_TO_GAME } from "../lahmanLoader.js";

// ─── parseCSVText ─────────────────────────────────────────────────────────────

describe("parseCSVText — basic parsing", () => {
  it("parses a simple CSV with header and rows", () => {
    const csv = "name,age,team\nAaron Judge,32,NYY\nShohei Ohtani,30,LAD";
    const rows = parseCSVText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: "Aaron Judge", age: "32", team: "NYY" });
    expect(rows[1]).toEqual({ name: "Shohei Ohtani", age: "30", team: "LAD" });
  });

  it("returns an empty array for a header-only CSV", () => {
    expect(parseCSVText("name,age,team")).toHaveLength(0);
  });

  it("skips blank lines between rows", () => {
    const csv = "a,b\n1,2\n\n3,4\n\n";
    const rows = parseCSVText(csv);
    expect(rows).toHaveLength(2);
  });
});

describe("parseCSVText — BOM stripping", () => {
  it("strips a UTF-8 BOM (\\uFEFF) from the start", () => {
    const csv = "\uFEFFname,age\nJudge,32";
    const rows = parseCSVText(csv);
    expect(rows).toHaveLength(1);
    // Header should be "name", not "\uFEFFname"
    expect(Object.keys(rows[0])[0]).toBe("name");
  });
});

describe("parseCSVText — CRLF line endings", () => {
  it("handles Windows-style CRLF line endings", () => {
    const csv = "name,age\r\nAaron Judge,32\r\nShohei Ohtani,30";
    const rows = parseCSVText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Aaron Judge");
    expect(rows[1].name).toBe("Shohei Ohtani");
  });

  it("handles mixed LF and CRLF endings", () => {
    const csv = "name,age\r\nJudge,32\nOhtani,30";
    const rows = parseCSVText(csv);
    expect(rows).toHaveLength(2);
  });
});

describe("parseCSVText — header whitespace trimming", () => {
  it("trims whitespace from header names", () => {
    const csv = " name , age , team \nJudge,32,NYY";
    const rows = parseCSVText(csv);
    expect(rows[0]).toHaveProperty("name");
    expect(rows[0]).toHaveProperty("age");
    expect(rows[0]).toHaveProperty("team");
  });
});

describe("parseCSVText — missing values", () => {
  it("uses empty string for missing trailing columns", () => {
    const csv = "a,b,c\n1,2";  // row has 2 values, header has 3
    const rows = parseCSVText(csv);
    expect(rows[0].c).toBe("");
  });
});

// ─── buildPlayerSeasons — helpers ────────────────────────────────────────────

/** Build minimal People, Batting, Fielding row arrays for testing. */
function makePeople(overrides = {}) {
  return [{
    playerID:  "testpl01",
    nameFirst: "Test",
    nameLast:  "Player",
    bats:      "R",
    ...overrides,
  }];
}

function makeBatting(overrides = {}) {
  return [{
    playerID: "testpl01",
    yearID:   "2022",
    teamID:   "NYA",   // Yankees (Lahman ID)
    stint:    "1",
    AB: "500", H: "140", "2B": "25", "3B": "3", HR: "30",
    RBI: "90", R: "80", SB: "10", BB: "60", SO: "100",
    HBP: "5", SF: "4", SH: "0",
    ...overrides,
  }];
}

function makeFielding(overrides = {}) {
  return [{
    playerID: "testpl01",
    yearID:   "2022",
    teamID:   "NYA",
    POS: "OF",
    G: "140",
    ...overrides,
  }];
}

const DEFAULT_SETTINGS = { startYear: 2008, endYear: 2025, minPA: 1 };

// ─── buildPlayerSeasons — team mapping ───────────────────────────────────────

describe("buildPlayerSeasons — Lahman → game team mapping", () => {
  it("maps NYA → NYY", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "NYA" }), makeFielding({ teamID: "NYA" }), DEFAULT_SETTINGS);
    expect(records).toHaveLength(1);
    expect(records[0].team).toBe("NYY");
  });

  it("maps CHA → CHW", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "CHA" }), makeFielding({ teamID: "CHA" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("CHW");
  });

  it("maps TBA → TBR", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "TBA" }), makeFielding({ teamID: "TBA" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("TBR");
  });

  it("maps TBD → TBR", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "TBD" }), makeFielding({ teamID: "TBD" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("TBR");
  });

  it("maps ANA → LAA", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "ANA" }), makeFielding({ teamID: "ANA" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("LAA");
  });

  it("maps CAL → LAA", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "CAL" }), makeFielding({ teamID: "CAL" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("LAA");
  });

  it("maps FLO → MIA", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "FLO" }), makeFielding({ teamID: "FLO" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("MIA");
  });

  it("maps CLG → CLE", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "CLG" }), makeFielding({ teamID: "CLG" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("CLE");
  });

  it("maps ATH → OAK", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "ATH" }), makeFielding({ teamID: "ATH" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("OAK");
  });

  it("maps WAS → WSN", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "WAS" }), makeFielding({ teamID: "WAS" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("WSN");
  });

  it("maps NYN → NYM", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "NYN" }), makeFielding({ teamID: "NYN" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("NYM");
  });

  it("maps LAN → LAD", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "LAN" }), makeFielding({ teamID: "LAN" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("LAD");
  });

  it("maps SLN → STL", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "SLN" }), makeFielding({ teamID: "SLN" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("STL");
  });

  it("maps KCA → KCR", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "KCA" }), makeFielding({ teamID: "KCA" }), DEFAULT_SETTINGS);
    expect(records[0].team).toBe("KCR");
  });

  it("skips defunct franchise MON (null in LAHMAN_TO_GAME)", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "MON" }), makeFielding({ teamID: "MON" }), DEFAULT_SETTINGS);
    expect(records).toHaveLength(0);
  });

  it("skips rows with unknown teamID not in LAHMAN_TO_GAME", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ teamID: "ZZZ" }), makeFielding({ teamID: "ZZZ" }), DEFAULT_SETTINGS);
    expect(records).toHaveLength(0);
  });
});

// ─── buildPlayerSeasons — year filtering ─────────────────────────────────────

describe("buildPlayerSeasons — year range filtering", () => {
  it("includes rows within startYear–endYear range", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ yearID: "2015" }), makeFielding({ yearID: "2015" }), { ...DEFAULT_SETTINGS, startYear: 2010, endYear: 2020 });
    expect(records).toHaveLength(1);
  });

  it("excludes rows before startYear", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ yearID: "2005" }), makeFielding({ yearID: "2005" }), { ...DEFAULT_SETTINGS, startYear: 2010, endYear: 2020 });
    expect(records).toHaveLength(0);
  });

  it("excludes rows after endYear", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ yearID: "2025" }), makeFielding({ yearID: "2025" }), { ...DEFAULT_SETTINGS, startYear: 2010, endYear: 2020 });
    expect(records).toHaveLength(0);
  });

  it("includes row on startYear boundary", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ yearID: "2010" }), makeFielding({ yearID: "2010" }), { ...DEFAULT_SETTINGS, startYear: 2010, endYear: 2020 });
    expect(records).toHaveLength(1);
  });

  it("includes row on endYear boundary", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting({ yearID: "2020" }), makeFielding({ yearID: "2020" }), { ...DEFAULT_SETTINGS, startYear: 2010, endYear: 2020 });
    expect(records).toHaveLength(1);
  });
});

// ─── buildPlayerSeasons — PA filter ──────────────────────────────────────────

describe("buildPlayerSeasons — minPA filter", () => {
  // PA = AB + BB + HBP + SF + SH
  // default batting fixture: AB=500, BB=60, HBP=5, SF=4, SH=0 → PA=569

  it("includes row when PA meets minPA", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting(), makeFielding(), { ...DEFAULT_SETTINGS, minPA: 50 });
    expect(records).toHaveLength(1);
  });

  it("excludes row when PA is below minPA", () => {
    // Very small AB, only 2 PA total
    const records = buildPlayerSeasons(
      makePeople(),
      makeBatting({ AB: "1", BB: "1", HBP: "0", SF: "0", SH: "0" }),
      makeFielding(),
      { ...DEFAULT_SETTINGS, minPA: 50 }
    );
    expect(records).toHaveLength(0);
  });

  it("includes row when minPA is 1 (counting stat leaderboard mode)", () => {
    const records = buildPlayerSeasons(
      makePeople(),
      makeBatting({ AB: "1", BB: "0", HBP: "0", SF: "0", SH: "0" }),
      makeFielding(),
      { ...DEFAULT_SETTINGS, minPA: 1 }
    );
    expect(records).toHaveLength(1);
  });

  it("excludes row with 0 PA regardless of minPA setting", () => {
    // minPA: 1 still excludes 0-PA rows (pure bench/roster fillers)
    const records = buildPlayerSeasons(
      makePeople(),
      makeBatting({ AB: "0", BB: "0", HBP: "0", SF: "0", SH: "0" }),
      makeFielding(),
      { ...DEFAULT_SETTINGS, minPA: 1 }
    );
    expect(records).toHaveLength(0);
  });

  it("computes PA correctly from all five components (AB+BB+HBP+SF+SH)", () => {
    // AB=10, BB=2, HBP=1, SF=1, SH=1 → PA=15
    const records = buildPlayerSeasons(
      makePeople(),
      makeBatting({ AB: "10", H: "3", "2B": "0", "3B": "0", HR: "0",
                    RBI: "2", R: "1", SB: "0", BB: "2", SO: "5",
                    HBP: "1", SF: "1", SH: "1" }),
      makeFielding(),
      { ...DEFAULT_SETTINGS, minPA: 15 }
    );
    expect(records).toHaveLength(1);
    expect(records[0].PA).toBe(15);
  });
});

// ─── buildPlayerSeasons — stats calculation ───────────────────────────────────

describe("buildPlayerSeasons — computed stats", () => {
  const records = buildPlayerSeasons(
    makePeople(),
    // AB=400, H=120, 2B=25, 3B=3, HR=20, BB=40, HBP=5, SF=3, SH=0
    makeBatting({ AB: "400", H: "120", "2B": "25", "3B": "3", HR: "20",
                  RBI: "75", R: "70", SB: "8", BB: "40", SO: "90",
                  HBP: "5", SF: "3", SH: "0" }),
    makeFielding(),
    DEFAULT_SETTINGS
  );
  const r = records[0];

  it("computes AVG = H/AB", () => {
    expect(r.AVG).toBeCloseTo(120 / 400, 3);
  });

  it("computes OBP = (H+BB+HBP)/(AB+BB+HBP+SF)", () => {
    expect(r.OBP).toBeCloseTo((120 + 40 + 5) / (400 + 40 + 5 + 3), 3);
  });

  it("computes SLG = TB/AB", () => {
    const tb = 120 + 25 + 2 * 3 + 3 * 20; // H + 2B + 2*3B + 3*HR
    expect(r.SLG).toBeCloseTo(tb / 400, 3);
  });

  it("computes OPS = OBP + SLG", () => {
    expect(r.OPS).toBeCloseTo(r.OBP + r.SLG, 2);
  });

  it("computes XBH = 2B + 3B + HR", () => {
    expect(r.XBH).toBe(25 + 3 + 20);
  });

  it("computes PA = AB + BB + HBP + SF + SH", () => {
    expect(r.PA).toBe(400 + 40 + 5 + 3 + 0);
  });
});

// ─── buildPlayerSeasons — position logic ─────────────────────────────────────

describe("buildPlayerSeasons — position assignment", () => {
  it("uses the position with the most games played when a player has multiple", () => {
    const fielding = [
      { playerID: "testpl01", yearID: "2022", teamID: "NYA", POS: "1B", G: "80" },
      { playerID: "testpl01", yearID: "2022", teamID: "NYA", POS: "3B", G: "60" },
    ];
    const records = buildPlayerSeasons(makePeople(), makeBatting(), fielding, DEFAULT_SETTINGS);
    expect(records[0].pos).toBe("1B");
  });

  it("normalises LF, CF, RF to OF", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting(), makeFielding({ POS: "LF", G: "130" }), DEFAULT_SETTINGS);
    expect(records[0].pos).toBe("OF");
  });

  it("falls back to DH when player has no fielding record", () => {
    const records = buildPlayerSeasons(makePeople(), makeBatting(), [], DEFAULT_SETTINGS);
    expect(records[0].pos).toBe("DH");
  });

  it("two-way player classified as P in Fielding falls back to non-P position", () => {
    // Simulate Ohtani: mostly pitched but also played OF
    const fielding = [
      { playerID: "testpl01", yearID: "2022", teamID: "NYA", POS: "P",  G: "28" },
      { playerID: "testpl01", yearID: "2022", teamID: "NYA", POS: "OF", G: "157" },
    ];
    const records = buildPlayerSeasons(makePeople(), makeBatting(), fielding, DEFAULT_SETTINGS);
    expect(records[0].pos).toBe("OF");
  });

  it("two-way player with only P fielding rows falls back to DH", () => {
    const fielding = [
      { playerID: "testpl01", yearID: "2022", teamID: "NYA", POS: "P", G: "28" },
    ];
    const records = buildPlayerSeasons(makePeople(), makeBatting(), fielding, DEFAULT_SETTINGS);
    expect(records[0].pos).toBe("DH");
  });
});

// ─── buildPlayerSeasons — batting hand normalisation ─────────────────────────

describe("buildPlayerSeasons — batting hand normalisation", () => {
  it("maps L → L", () => {
    const records = buildPlayerSeasons(makePeople({ bats: "L" }), makeBatting(), makeFielding(), DEFAULT_SETTINGS);
    expect(records[0].bats).toBe("L");
  });

  it("maps R → R", () => {
    const records = buildPlayerSeasons(makePeople({ bats: "R" }), makeBatting(), makeFielding(), DEFAULT_SETTINGS);
    expect(records[0].bats).toBe("R");
  });

  it("maps B (both) → S (switch)", () => {
    const records = buildPlayerSeasons(makePeople({ bats: "B" }), makeBatting(), makeFielding(), DEFAULT_SETTINGS);
    expect(records[0].bats).toBe("S");
  });

  it("unknown bats value defaults to R", () => {
    const records = buildPlayerSeasons(makePeople({ bats: "X" }), makeBatting(), makeFielding(), DEFAULT_SETTINGS);
    expect(records[0].bats).toBe("R");
  });
});

// ─── buildPlayerSeasons — player name handling ────────────────────────────────

describe("buildPlayerSeasons — player name handling", () => {
  it("skips batting rows with no matching playerID in People", () => {
    const people = makePeople({ playerID: "judge001" });
    const batting = makeBatting({ playerID: "UNKNOWN" });
    const records = buildPlayerSeasons(people, batting, [], DEFAULT_SETTINGS);
    expect(records).toHaveLength(0);
  });

  it("concatenates nameFirst + nameLast correctly", () => {
    const records = buildPlayerSeasons(
      makePeople({ nameFirst: "Aaron", nameLast: "Judge" }),
      makeBatting(),
      makeFielding(),
      DEFAULT_SETTINGS
    );
    expect(records[0].name).toBe("Aaron Judge");
  });

  it("handles player with only a last name (no first name)", () => {
    const records = buildPlayerSeasons(
      makePeople({ nameFirst: "", nameLast: "Judge" }),
      makeBatting(),
      makeFielding(),
      DEFAULT_SETTINGS
    );
    expect(records[0].name).toBe("Judge");
  });
});
