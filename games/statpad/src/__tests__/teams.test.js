import { describe, it, expect } from "vitest";
import { MLB_TEAMS, DIVISIONS } from "../teams.js";
import { LAHMAN_TO_GAME } from "../lahmanLoader.js";

// ESPN_ABBR is not exported, so derive coverage from getTeamLogoUrl output.
// Instead we re-derive the expected ESPN overrides by reading the module source.
// The exported functions are enough for functional verification.
import { getTeamLogoUrl, getTeamDarkLogoUrl } from "../teams.js";

// ─── MLB_TEAMS integrity ─────────────────────────────────────────────────────

describe("MLB_TEAMS — completeness", () => {
  const teams = Object.entries(MLB_TEAMS);

  it("has exactly 30 teams", () => {
    expect(teams).toHaveLength(30);
  });

  it("every team has required fields", () => {
    for (const [abbr, t] of teams) {
      expect(t.name,   `${abbr} missing name`).toBeTruthy();
      expect(t.city,   `${abbr} missing city`).toBeTruthy();
      expect(t.division, `${abbr} missing division`).toBeTruthy();
      expect(t.league,   `${abbr} missing league`).toBeTruthy();
      expect(t.color,  `${abbr} missing color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.alt,    `${abbr} missing alt`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("league values are only AL or NL", () => {
    for (const [abbr, t] of teams) {
      expect(["AL", "NL"], `${abbr} has invalid league`).toContain(t.league);
    }
  });

  it("division values are one of the six MLB divisions", () => {
    for (const [abbr, t] of teams) {
      expect(DIVISIONS, `${abbr} has invalid division`).toContain(t.division);
    }
  });

  it("league prefix matches division prefix (AL teams in AL divisions)", () => {
    for (const [abbr, t] of teams) {
      expect(t.division.startsWith(t.league), `${abbr}: league/division mismatch`).toBe(true);
    }
  });

  it("each division has exactly 5 teams", () => {
    const counts = {};
    for (const t of Object.values(MLB_TEAMS)) {
      counts[t.division] = (counts[t.division] || 0) + 1;
    }
    for (const div of DIVISIONS) {
      expect(counts[div], `${div} should have 5 teams`).toBe(5);
    }
  });

  it("AL has 15 teams and NL has 15 teams", () => {
    const al = Object.values(MLB_TEAMS).filter(t => t.league === "AL");
    const nl = Object.values(MLB_TEAMS).filter(t => t.league === "NL");
    expect(al).toHaveLength(15);
    expect(nl).toHaveLength(15);
  });
});

describe("MLB_TEAMS — specific team assertions", () => {
  it("CLE is Guardians (not Indians)", () => {
    expect(MLB_TEAMS.CLE.name).toBe("Guardians");
  });

  it("MIA is Marlins (not Marlins/Florida)", () => {
    expect(MLB_TEAMS.MIA.name).toBe("Marlins");
    expect(MLB_TEAMS.MIA.city).toBe("Miami");
  });

  it("WSN is Nationals (Washington)", () => {
    expect(MLB_TEAMS.WSN.name).toBe("Nationals");
    expect(MLB_TEAMS.WSN.city).toBe("Washington");
  });

  it("OAK is Athletics", () => {
    expect(MLB_TEAMS.OAK.name).toBe("Athletics");
  });

  it("LAA and LAD are distinct teams in the same city", () => {
    expect(MLB_TEAMS.LAA.name).toBe("Angels");
    expect(MLB_TEAMS.LAD.name).toBe("Dodgers");
    expect(MLB_TEAMS.LAA.city).toBe(MLB_TEAMS.LAD.city); // both "Los Angeles"
    expect(MLB_TEAMS.LAA.division).not.toBe(MLB_TEAMS.LAD.division);
  });

  it("CHC and CHW are distinct teams in the same city", () => {
    expect(MLB_TEAMS.CHC.city).toBe(MLB_TEAMS.CHW.city);
    expect(MLB_TEAMS.CHC.division).not.toBe(MLB_TEAMS.CHW.division);
  });

  it("NYY and NYM are distinct teams in the same city", () => {
    expect(MLB_TEAMS.NYY.city).toBe(MLB_TEAMS.NYM.city);
    expect(MLB_TEAMS.NYY.league).not.toBe(MLB_TEAMS.NYM.league);
  });
});

// ─── DIVISIONS array ─────────────────────────────────────────────────────────

describe("DIVISIONS array", () => {
  it("has exactly 6 entries", () => {
    expect(DIVISIONS).toHaveLength(6);
  });

  it("contains all six division strings", () => {
    expect(DIVISIONS).toContain("AL East");
    expect(DIVISIONS).toContain("AL Central");
    expect(DIVISIONS).toContain("AL West");
    expect(DIVISIONS).toContain("NL East");
    expect(DIVISIONS).toContain("NL Central");
    expect(DIVISIONS).toContain("NL West");
  });
});

// ─── LAHMAN_TO_GAME → MLB_TEAMS consistency ──────────────────────────────────

describe("LAHMAN_TO_GAME — all mapped teams exist in MLB_TEAMS", () => {
  const entries = Object.entries(LAHMAN_TO_GAME);

  it("every non-null mapping resolves to a valid MLB_TEAMS key", () => {
    for (const [lahman, game] of entries) {
      if (game === null) continue; // defunct franchise (e.g. MON) — skip
      expect(MLB_TEAMS[game], `LAHMAN_TO_GAME["${lahman}"] = "${game}" not in MLB_TEAMS`).toBeDefined();
    }
  });

  it("null entries are only for known defunct franchises", () => {
    const nullEntries = entries.filter(([, v]) => v === null).map(([k]) => k);
    // Currently only MON (Expos) should be null
    expect(nullEntries).toEqual(["MON"]);
  });

  it("historical Tampa Bay IDs both map to TBR", () => {
    expect(LAHMAN_TO_GAME["TBA"]).toBe("TBR");
    expect(LAHMAN_TO_GAME["TBD"]).toBe("TBR");
  });

  it("historical Angels IDs all map to LAA", () => {
    expect(LAHMAN_TO_GAME["LAA"]).toBe("LAA");
    expect(LAHMAN_TO_GAME["ANA"]).toBe("LAA");
    expect(LAHMAN_TO_GAME["CAL"]).toBe("LAA");
  });

  it("historical Marlins ID maps to MIA", () => {
    expect(LAHMAN_TO_GAME["FLO"]).toBe("MIA");
  });

  it("historical Yankees ID maps to NYY", () => {
    expect(LAHMAN_TO_GAME["NYA"]).toBe("NYY");
  });

  it("historical White Sox ID maps to CHW", () => {
    expect(LAHMAN_TO_GAME["CHA"]).toBe("CHW");
  });

  it("CLG (Cleveland Guardians rebrand ID) maps to CLE", () => {
    expect(LAHMAN_TO_GAME["CLG"]).toBe("CLE");
  });

  it("both OAK and ATH map to OAK (A's franchise)", () => {
    expect(LAHMAN_TO_GAME["OAK"]).toBe("OAK");
    expect(LAHMAN_TO_GAME["ATH"]).toBe("OAK");
  });

  it("all 30 current teams are reachable from LAHMAN_TO_GAME", () => {
    const reachable = new Set(Object.values(LAHMAN_TO_GAME).filter(Boolean));
    for (const abbr of Object.keys(MLB_TEAMS)) {
      expect(reachable, `${abbr} is not reachable from any LAHMAN_TO_GAME entry`).toContain(abbr);
    }
  });
});

// ─── ESPN logo URL generation ─────────────────────────────────────────────────

describe("getTeamLogoUrl / getTeamDarkLogoUrl", () => {
  it("returns a well-formed URL for a standard abbreviation", () => {
    const url = getTeamLogoUrl("NYY");
    expect(url).toMatch(/^https:\/\/a\.espncdn\.com\/i\/teamlogos\/mlb\/500\//);
    expect(url).toContain("nyy");
  });

  it("applies ESPN override for TBR → tb", () => {
    expect(getTeamLogoUrl("TBR")).toContain("/tb.png");
  });

  it("applies ESPN override for WSN → wsh", () => {
    expect(getTeamLogoUrl("WSN")).toContain("/wsh.png");
  });

  it("applies ESPN override for KCR → kc", () => {
    expect(getTeamLogoUrl("KCR")).toContain("/kc.png");
  });

  it("applies ESPN override for SFG → sf", () => {
    expect(getTeamLogoUrl("SFG")).toContain("/sf.png");
  });

  it("applies ESPN override for SDP → sd", () => {
    expect(getTeamLogoUrl("SDP")).toContain("/sd.png");
  });

  it("dark logo URL uses scoreboard path", () => {
    const url = getTeamDarkLogoUrl("NYY");
    expect(url).toContain("/scoreboard/");
  });

  it("falls back to lowercase for unknown abbreviation", () => {
    expect(getTeamLogoUrl("XYZ")).toContain("/xyz.png");
  });

  it("generates logos for all 30 teams without throwing", () => {
    for (const abbr of Object.keys(MLB_TEAMS)) {
      expect(() => getTeamLogoUrl(abbr)).not.toThrow();
      expect(() => getTeamDarkLogoUrl(abbr)).not.toThrow();
    }
  });
});
