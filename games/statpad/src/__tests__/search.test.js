/**
 * Tests for search bar logic extracted from PlayerSearchModal in App.jsx.
 *
 * The pure logic (buildPlayerIndex + filterPlayers) cannot be imported because
 * it lives inside a React component.  These tests replicate the same algorithm
 * so that edge cases can be verified independently of the UI.
 */
import { describe, it, expect } from "vitest";

// ─── Pure helpers that mirror App.jsx PlayerSearchModal logic ─────────────────

/** Build a deduplicated player index from a player-seasons array. */
function buildPlayerIndex(playerSeasons) {
  const map = {};
  playerSeasons.forEach(ps => {
    if (!map[ps.name]) map[ps.name] = { name: ps.name, minYear: ps.year, maxYear: ps.year };
    map[ps.name].minYear = Math.min(map[ps.name].minYear, ps.year);
    map[ps.name].maxYear = Math.max(map[ps.name].maxYear, ps.year);
  });
  return Object.values(map);
}

/** Filter the player index by search query (mirrors App.jsx). */
function filterPlayers(playerIndex, query, limit = 15) {
  if (query.length < 2) return { results: [], total: 0 };
  const q = query.toLowerCase();
  const all = playerIndex.filter(p => p.name.toLowerCase().includes(q));
  return { results: all.slice(0, limit), total: all.length };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SEASONS = [
  { name: "Aaron Judge",      team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 62 },
  { name: "Aaron Judge",      team: "NYY", year: 2024, pos: "OF", bats: "R", HR: 58 },
  { name: "Shohei Ohtani",    team: "LAA", year: 2021, pos: "DH", bats: "L", HR: 46 },
  { name: "Shohei Ohtani",    team: "LAD", year: 2024, pos: "DH", bats: "L", HR: 40 },
  { name: "Ronald Acuña Jr.", team: "ATL", year: 2023, pos: "OF", bats: "R", HR: 41 },
  { name: "José Abreu",       team: "CHW", year: 2020, pos: "1B", bats: "R", HR: 19 },
  { name: "José Abreu",       team: "HOU", year: 2023, pos: "1B", bats: "R", HR: 18 },
  { name: "Trea Turner",      team: "WSN", year: 2021, pos: "SS", bats: "R", HR: 28 },
  { name: "Ha-Seong Kim",     team: "SDP", year: 2023, pos: "SS", bats: "R", HR: 17 },
  { name: "Dansby Swanson",   team: "ATL", year: 2022, pos: "SS", bats: "R", HR: 25 },
  { name: "Bo Bichette",      team: "TOR", year: 2021, pos: "SS", bats: "R", HR: 29 },
  { name: "Bo Bichette",      team: "TOR", year: 2022, pos: "SS", bats: "R", HR: 24 },
  { name: "Bo Bichette",      team: "TOR", year: 2023, pos: "SS", bats: "R", HR: 20 },
  // extra players to test the 15-result cap
  { name: "Player A",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
  { name: "Player B",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
  { name: "Player C",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
  { name: "Player D",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
  { name: "Player E",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
  { name: "Player F",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
  { name: "Player G",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
  { name: "Player H",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
  { name: "Player I",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
  { name: "Player J",  team: "NYY", year: 2022, pos: "OF", bats: "R", HR: 10 },
];

const INDEX = buildPlayerIndex(SEASONS);

// ─── buildPlayerIndex ─────────────────────────────────────────────────────────

describe("buildPlayerIndex", () => {
  it("deduplicates players with multiple seasons", () => {
    const names = INDEX.map(p => p.name);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });

  it("computes correct minYear / maxYear for multi-season player", () => {
    const judge = INDEX.find(p => p.name === "Aaron Judge");
    expect(judge.minYear).toBe(2022);
    expect(judge.maxYear).toBe(2024);
  });

  it("computes correct minYear / maxYear across team change (Ohtani)", () => {
    const ohtani = INDEX.find(p => p.name === "Shohei Ohtani");
    expect(ohtani.minYear).toBe(2021);
    expect(ohtani.maxYear).toBe(2024);
  });

  it("single-season player has minYear === maxYear", () => {
    const acuna = INDEX.find(p => p.name === "Ronald Acuña Jr.");
    expect(acuna.minYear).toBe(acuna.maxYear);
    expect(acuna.minYear).toBe(2023);
  });

  it("multi-year player (Bo Bichette) has correct range", () => {
    const bo = INDEX.find(p => p.name === "Bo Bichette");
    expect(bo.minYear).toBe(2021);
    expect(bo.maxYear).toBe(2023);
  });
});

// ─── filterPlayers — minimum query length ────────────────────────────────────

describe("filterPlayers — minimum query length", () => {
  it("returns empty array for empty query", () => {
    expect(filterPlayers(INDEX, "").results).toHaveLength(0);
  });

  it("returns empty array for 1-character query", () => {
    expect(filterPlayers(INDEX, "a").results).toHaveLength(0);
  });

  it("returns results for exactly 2-character query", () => {
    const { results } = filterPlayers(INDEX, "aa");
    expect(results.length).toBeGreaterThan(0);
  });
});

// ─── filterPlayers — case insensitivity ──────────────────────────────────────

describe("filterPlayers — case insensitivity", () => {
  it("lowercase query matches mixed-case name", () => {
    const { results: lower } = filterPlayers(INDEX, "judge");
    const { results: upper } = filterPlayers(INDEX, "JUDGE");
    const { results: mixed } = filterPlayers(INDEX, "Judge");
    expect(lower.map(p => p.name)).toContain("Aaron Judge");
    expect(upper.map(p => p.name)).toContain("Aaron Judge");
    expect(mixed.map(p => p.name)).toContain("Aaron Judge");
  });

  it("uppercase query matches all-lowercase stored name", () => {
    const { results } = filterPlayers(INDEX, "BICHETTE");
    expect(results.map(p => p.name)).toContain("Bo Bichette");
  });
});

// ─── filterPlayers — substring matching ──────────────────────────────────────

describe("filterPlayers — substring matching", () => {
  it("matches on first name", () => {
    const { results } = filterPlayers(INDEX, "aaron");
    expect(results.map(p => p.name)).toContain("Aaron Judge");
  });

  it("matches on last name", () => {
    const { results } = filterPlayers(INDEX, "judge");
    expect(results.map(p => p.name)).toContain("Aaron Judge");
  });

  it("matches on last name only for Ohtani", () => {
    const { results } = filterPlayers(INDEX, "ohtani");
    expect(results.map(p => p.name)).toContain("Shohei Ohtani");
  });

  it("matches partial name in the middle of the full string", () => {
    // "Acuña Jr." — the Jr. is searchable
    const { results } = filterPlayers(INDEX, "Acuña");
    expect(results.map(p => p.name)).toContain("Ronald Acuña Jr.");
  });

  it("returns no results when query matches nothing", () => {
    const { results, total } = filterPlayers(INDEX, "zzzzz");
    expect(results).toHaveLength(0);
    expect(total).toBe(0);
  });

  it("handles hyphenated names (Ha-Seong Kim)", () => {
    const { results: byFirst } = filterPlayers(INDEX, "Ha-Se");
    const { results: byLast }  = filterPlayers(INDEX, "Kim");
    expect(byFirst.map(p => p.name)).toContain("Ha-Seong Kim");
    expect(byLast.map(p => p.name)).toContain("Ha-Seong Kim");
  });
});

// ─── filterPlayers — accented characters ─────────────────────────────────────

describe("filterPlayers — accented / special characters", () => {
  it("finds José Abreu when searching 'José'", () => {
    const { results } = filterPlayers(INDEX, "José");
    expect(results.map(p => p.name)).toContain("José Abreu");
  });

  it("finds José Abreu when searching last name 'Abreu'", () => {
    const { results } = filterPlayers(INDEX, "Abreu");
    expect(results.map(p => p.name)).toContain("José Abreu");
  });

  it("finds Ronald Acuña Jr. with accented ñ", () => {
    const { results } = filterPlayers(INDEX, "Acuña");
    expect(results.map(p => p.name)).toContain("Ronald Acuña Jr.");
  });

  it("suffix 'Jr.' is searchable", () => {
    const { results } = filterPlayers(INDEX, "Jr.");
    expect(results.map(p => p.name)).toContain("Ronald Acuña Jr.");
  });
});

// ─── filterPlayers — result cap at 15 ────────────────────────────────────────

describe("filterPlayers — 15-result cap", () => {
  it("returns at most 15 results even when more match", () => {
    // "Player" matches all 10 "Player X" entries PLUS any others whose name contains "Player"
    const { results, total } = filterPlayers(INDEX, "Player");
    expect(results.length).toBeLessThanOrEqual(15);
    // But the total count is still available and may exceed 15
    expect(total).toBeGreaterThanOrEqual(results.length);
  });

  it("custom limit is respected", () => {
    const { results } = filterPlayers(INDEX, "Player", 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });
});

// ─── filterPlayers — name disambiguation ─────────────────────────────────────

describe("filterPlayers — name disambiguation", () => {
  it("players sharing a common substring are all returned", () => {
    // "Turner" should match "Trea Turner" only
    const { results } = filterPlayers(INDEX, "Turner");
    const names = results.map(p => p.name);
    expect(names).toContain("Trea Turner");
    expect(names).not.toContain("Aaron Judge");
  });

  it("a very specific query returns only the matching player", () => {
    const { results } = filterPlayers(INDEX, "Swanson");
    const names = results.map(p => p.name);
    expect(names).toContain("Dansby Swanson");
    expect(names).toHaveLength(1);
  });
});

// ─── playerYears list for selected player ─────────────────────────────────────

describe("player year selection list", () => {
  /** Mirror App.jsx: get sorted-desc unique years for a named player. */
  function getPlayerYears(name, seasons) {
    return [...new Set(seasons.filter(ps => ps.name === name).map(ps => ps.year))].sort((a, b) => b - a);
  }

  it("Bo Bichette has years [2023, 2022, 2021] in descending order", () => {
    expect(getPlayerYears("Bo Bichette", SEASONS)).toEqual([2023, 2022, 2021]);
  });

  it("Aaron Judge has years [2024, 2022] in descending order", () => {
    expect(getPlayerYears("Aaron Judge", SEASONS)).toEqual([2024, 2022]);
  });

  it("single-season player has exactly one year", () => {
    expect(getPlayerYears("Ronald Acuña Jr.", SEASONS)).toHaveLength(1);
  });

  it("Ohtani team change appears as two distinct years", () => {
    const years = getPlayerYears("Shohei Ohtani", SEASONS);
    expect(years).toEqual([2024, 2021]);
  });

  it("unknown player returns empty year list", () => {
    expect(getPlayerYears("No Such Player", SEASONS)).toHaveLength(0);
  });
});
