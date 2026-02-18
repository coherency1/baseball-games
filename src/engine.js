// Puzzle engine: generation, validation, anti-double-jeopardy
// Column structure (strict):
//   Col 1: TEAM, DIVISION, LEAGUE, or ALL_TEAMS
//   Col 2: YEAR_RANGE or YEAR_EXACT
//   Col 3: POSITION, BATS, or STAT_THRESHOLD

import { MLB_TEAMS, DIVISIONS } from "./teams.js";

export const CATEGORY_TYPES = {
  TEAM: "team",
  DIVISION: "division",
  LEAGUE: "league",
  ALL_TEAMS: "all_teams",
  YEAR_RANGE: "year_range",
  YEAR_EXACT: "year_exact",
  POSITION: "position",
  BATS: "bats",
  STAT_THRESHOLD: "stat_threshold",
};

export const SCORING_STATS = [
  { key: "HR", label: "HRs" },
  { key: "RBI", label: "RBI" },
  { key: "R", label: "Runs" },
  { key: "H", label: "Hits" },
  { key: "SB", label: "SBs" },
  { key: "SO", label: "Ks" },
  { key: "BB", label: "BBs" },
  { key: "2B", label: "2Bs" },
  { key: "XBH", label: "XBH" },
];

export function matchesCategory(ps, cat) {
  switch (cat.type) {
    case CATEGORY_TYPES.TEAM: return ps.team === cat.value;
    case CATEGORY_TYPES.DIVISION: return MLB_TEAMS[ps.team]?.division === cat.value;
    case CATEGORY_TYPES.LEAGUE: return MLB_TEAMS[ps.team]?.league === cat.value;
    case CATEGORY_TYPES.ALL_TEAMS: return true;
    case CATEGORY_TYPES.YEAR_RANGE: return ps.year >= cat.value[0] && ps.year <= cat.value[1];
    case CATEGORY_TYPES.YEAR_EXACT: return ps.year === cat.value;
    case CATEGORY_TYPES.POSITION: {
      // DH and UTL are "any position" categories — every hitter qualifies
      if (cat.value === "DH" || cat.value === "UTL") return true;
      // IF umbrella covers all infield positions
      if (cat.value === "IF") return ["1B","2B","3B","SS","IF"].includes(ps.pos);
      // OF umbrella covers all outfield positions (data may store LF/RF/CF or normalised OF)
      if (cat.value === "OF") return ["OF","LF","RF","CF"].includes(ps.pos);
      // Specific outfield sub-positions
      if (cat.value === "LF" || cat.value === "RF" || cat.value === "CF") return ps.pos === cat.value;
      // Exact match for C, 1B, 2B, 3B, SS
      return ps.pos === cat.value;
    }
    case CATEGORY_TYPES.BATS: return ps.bats === cat.value;
    case CATEGORY_TYPES.STAT_THRESHOLD: return (ps[cat.value.stat] || 0) >= cat.value.min;
    default: return false;
  }
}

export function findMatchingSeasons(categories, playerSeasons) {
  return playerSeasons.filter(ps => categories.every(c => matchesCategory(ps, c)));
}

// Anti-double-jeopardy: check if two categories overlap
function catsOverlap(a, b) {
  // Unify YEAR_EXACT and YEAR_RANGE into interval comparison so that e.g.
  // YEAR_EXACT(2020) inside YEAR_RANGE([2018,2023]) is correctly detected as overlap.
  const YEAR_TYPES = new Set([CATEGORY_TYPES.YEAR_EXACT, CATEGORY_TYPES.YEAR_RANGE]);
  if (YEAR_TYPES.has(a.type) && YEAR_TYPES.has(b.type)) {
    const aLo = a.type === CATEGORY_TYPES.YEAR_EXACT ? a.value : a.value[0];
    const aHi = a.type === CATEGORY_TYPES.YEAR_EXACT ? a.value : a.value[1];
    const bLo = b.type === CATEGORY_TYPES.YEAR_EXACT ? b.value : b.value[0];
    const bHi = b.type === CATEGORY_TYPES.YEAR_EXACT ? b.value : b.value[1];
    return aLo <= bHi && bLo <= aHi;
  }

  if (a.type !== b.type) return false;

  if (a.type === CATEGORY_TYPES.TEAM)     return a.value === b.value;
  if (a.type === CATEGORY_TYPES.DIVISION) return a.value === b.value;
  if (a.type === CATEGORY_TYPES.LEAGUE)   return a.value === b.value;
  if (a.type === CATEGORY_TYPES.BATS)     return a.value === b.value;

  if (a.type === CATEGORY_TYPES.POSITION) {
    // DH and UTL are "any" categories. They only overlap with each other — not
    // with specific positions — so a DH row and an IF row can coexist (the
    // team+year constraints already prevent trivial same-player double-jeopardy).
    const ANY_POS = new Set(["DH", "UTL"]);
    const aIsAny = ANY_POS.has(a.value), bIsAny = ANY_POS.has(b.value);
    if (aIsAny && bIsAny) return true;
    if (aIsAny || bIsAny) return false;

    // IF expands to {1B,2B,3B,SS}; OF expands to {LF,CF,RF,OF}.
    // Use set intersection so IF vs 2B and OF vs LF are correctly detected.
    const IF_SET = new Set(["1B", "2B", "3B", "SS"]);
    const OF_SET = new Set(["OF", "LF", "CF", "RF"]);
    const expand = v => {
      if (v === "IF") return IF_SET;
      if (v === "OF") return OF_SET;
      return new Set([v]);
    };
    const aSet = expand(a.value);
    const bSet = expand(b.value);
    for (const p of aSet) { if (bSet.has(p)) return true; }
    return false;
  }

  // Two thresholds on the same stat always overlap (both define [min, ∞) on the same field).
  if (a.type === CATEGORY_TYPES.STAT_THRESHOLD) {
    return a.value.stat === b.value.stat;
  }

  return false;
}

// Only generate team categories for teams that exist in the dataset
function getAvailableTeams(playerSeasons) {
  return [...new Set(playerSeasons.map(ps => ps.team))].filter(t => MLB_TEAMS[t]);
}

function genCol1(availableTeams) {
  // Column 1: team (50%), division (30%), league (15%), all (5%)
  const r = Math.random();
  if (r < 0.50) {
    const k = availableTeams[Math.floor(Math.random() * availableTeams.length)];
    const t = MLB_TEAMS[k];
    return { type: CATEGORY_TYPES.TEAM, value: k, label: t.name, teamAbbr: k };
  }
  if (r < 0.80) {
    const d = DIVISIONS[Math.floor(Math.random() * DIVISIONS.length)];
    const teamsInDiv = Object.keys(MLB_TEAMS).filter(k => MLB_TEAMS[k].division === d && availableTeams.includes(k));
    return { type: CATEGORY_TYPES.DIVISION, value: d, label: d, teams: teamsInDiv };
  }
  if (r < 0.95) {
    const l = Math.random() > 0.5 ? "AL" : "NL";
    return { type: CATEGORY_TYPES.LEAGUE, value: l, label: l === "AL" ? "American League" : "National League" };
  }
  return { type: CATEGORY_TYPES.ALL_TEAMS, value: "all", label: "MLB" };
}

function genCol2(teamSelected = false) {
  // Predetermined probability distribution (all weights sum to 100):
  //   2025 exact        15%  │  2021-2025 range   20%
  //   2024 exact        15%  │  2008-2014 exact    3%  (÷7 per year)
  //   2010-2020 range   15%  │  2015-2017 exact    5%  (÷3 per year)
  //                          │  2018-2020 exact   10%  (÷3 per year)
  //                          │  2021-2023 exact   17%  (÷3 per year)
  const r = Math.random() * 100;

  let result;
  if (r < 15) {
    result = { type: CATEGORY_TYPES.YEAR_EXACT, value: 2025, label: "2025" };
  } else if (r < 30) {
    result = { type: CATEGORY_TYPES.YEAR_EXACT, value: 2024, label: "2024" };
  } else if (r < 45) {
    result = { type: CATEGORY_TYPES.YEAR_RANGE, value: [2010, 2020], label: "2010 to 2020" };
  } else if (r < 65) {
    result = { type: CATEGORY_TYPES.YEAR_RANGE, value: [2021, 2025], label: "2021 to 2025" };
  } else if (r < 68) {
    // 2008-2014: 3% across 7 years
    const yrs = [2008, 2009, 2010, 2011, 2012, 2013, 2014];
    const y = yrs[Math.min(Math.floor((r - 65) * 7 / 3), 6)];
    result = { type: CATEGORY_TYPES.YEAR_EXACT, value: y, label: `${y}` };
  } else if (r < 73) {
    // 2015-2017: 5% across 3 years
    const yrs = [2015, 2016, 2017];
    const y = yrs[Math.min(Math.floor((r - 68) * 3 / 5), 2)];
    result = { type: CATEGORY_TYPES.YEAR_EXACT, value: y, label: `${y}` };
  } else if (r < 83) {
    // 2018-2020: 10% across 3 years
    const yrs = [2018, 2019, 2020];
    const y = yrs[Math.min(Math.floor((r - 73) * 3 / 10), 2)];
    result = { type: CATEGORY_TYPES.YEAR_EXACT, value: y, label: `${y}` };
  } else {
    // 2021-2023: remaining 17% across 3 years
    const yrs = [2021, 2022, 2023];
    const y = yrs[Math.min(Math.floor((r - 83) * 3 / 17), 2)];
    result = { type: CATEGORY_TYPES.YEAR_EXACT, value: y, label: `${y}` };
  }

  // Single-team constraint: exact years before 2024 must fall back to a range.
  // Redistribute proportionally between the two defined ranges (15% and 20%).
  if (teamSelected && result.type === CATEGORY_TYPES.YEAR_EXACT && result.value < 2024) {
    return Math.random() < (15 / 35)
      ? { type: CATEGORY_TYPES.YEAR_RANGE, value: [2010, 2020], label: "2010 to 2020" }
      : { type: CATEGORY_TYPES.YEAR_RANGE, value: [2021, 2025], label: "2021 to 2025" };
  }

  return result;
}

function genCol3() {
  // Column 3: position (35%), bats (25%), stat threshold (40%)
  const r = Math.random();
  if (r < 0.35) {
    // DH and UTL are "any position" — intentionally broad, used as easier rows.
    const positions = ["OF","IF","1B","2B","3B","SS","C","DH","UTL"];
    const p = positions[Math.floor(Math.random() * positions.length)];
    const labels = { OF:"Outfield", IF:"Infield", C:"Catcher", DH:"DH", UTL:"Utility", "1B":"1B", "2B":"2B", "3B":"3B", SS:"SS" };
    return { type: CATEGORY_TYPES.POSITION, value: p, label: labels[p] || p };
  }
  if (r < 0.60) {
    const b = ["L","R","S"][Math.floor(Math.random() * 3)];
    const labels = { L:"Left", R:"Right", S:"Switch" };
    return { type: CATEGORY_TYPES.BATS, value: b, label: labels[b], sublabel: "BATS" };
  }
  const opts = [
    { stat:"HR", min:30, label:"30+ HR" },
    { stat:"HR", min:40, label:"40+ HR" },
    { stat:"RBI", min:100, label:"100+ RBI" },
    { stat:"SB", min:20, label:"20+ SB" },
    { stat:"SB", min:40, label:"40+ SB" },
    { stat:"H", min:180, label:"180+ Hits" },
    { stat:"AVG", min:.300, label:".300+ AVG" },
  ];
  const o = opts[Math.floor(Math.random() * opts.length)];
  return { type: CATEGORY_TYPES.STAT_THRESHOLD, value: o, label: o.label };
}

export function generatePuzzle(playerSeasons, numRows = 5) {
  // Exclude pitchers: their batting stats are outliers that pollute answer pools
  // and skew scoring distributions. The full playerSeasons is still used by the
  // UI for player search so pitchers remain searchable.
  const hitterSeasons = playerSeasons.filter(ps => ps.pos !== "P");

  const scoringStat = SCORING_STATS[Math.floor(Math.random() * SCORING_STATS.length)];
  const availableTeams = getAvailableTeams(hitterSeasons);
  const rows = [];
  const allUsedCats = [];

  for (let i = 0; i < numRows; i++) {
    let bestRow = null;

    // Primary loop: 150 attempts at a valid, non-overlapping row
    for (let attempt = 0; attempt < 150; attempt++) {
      const c1 = genCol1(availableTeams);
      const c2 = genCol2(c1.type === CATEGORY_TYPES.TEAM);
      const c3 = genCol3();
      const cats = [c1, c2, c3];

      // Anti-double-jeopardy check
      const hasOverlap = allUsedCats.some(existing =>
        cats.some(cat => catsOverlap(existing, cat))
      );
      if (hasOverlap) continue;

      const matches = findMatchingSeasons(cats, hitterSeasons);
      if (matches.length >= 3 && matches.length <= 15) {
        bestRow = { categories: cats, validAnswers: matches };
        break;
      }
    }

    // Secondary fallback: ALL_TEAMS + random col2/col3, up to 30 attempts
    if (!bestRow) {
      for (let fb = 0; fb < 30; fb++) {
        const cats = [
          { type: CATEGORY_TYPES.ALL_TEAMS, value: "all", label: "MLB" },
          genCol2(),
          genCol3(),
        ];
        const hasOverlap = allUsedCats.some(existing =>
          cats.some(cat => catsOverlap(existing, cat))
        );
        if (hasOverlap) continue;
        const matches = findMatchingSeasons(cats, hitterSeasons);
        if (matches.length >= 3) {
          bestRow = { categories: cats, validAnswers: matches };
          break;
        }
      }
    }

    // Last-resort hard fallback: guaranteed solvable, overlap check skipped.
    // Practically unreachable (requires all 180 attempts to fail).
    if (!bestRow) {
      const cats = [
        { type: CATEGORY_TYPES.ALL_TEAMS, value: "all", label: "MLB" },
        { type: CATEGORY_TYPES.YEAR_RANGE, value: [2010, 2020], label: "2010 to 2020" },
        { type: CATEGORY_TYPES.BATS, value: "R", label: "Right" },
      ];
      bestRow = { categories: cats, validAnswers: findMatchingSeasons(cats, hitterSeasons) };
    }

    rows.push(bestRow);
    allUsedCats.push(...bestRow.categories);
  }

  return { scoringStat, rows, id: Date.now().toString(36) };
}

// Percentile computation across all valid answers
export function computePercentile(score, statKey, allRows) {
  const allScores = [];
  allRows.forEach(row => {
    row.validAnswers.forEach(ps => {
      const val = ps[statKey] || 0;
      if (val > 0) allScores.push(val);
    });
  });
  if (allScores.length === 0) return 50;
  allScores.sort((a, b) => a - b);
  const rank = allScores.filter(s => s <= score).length;
  return Math.round((rank / allScores.length) * 100);
}

export function getTier(pct) {
  if (pct >= 95) return { name:"PLATINUM", bg:"linear-gradient(135deg,#1a0533 0%,#2d1b69 25%,#8b5cf6 50%,#c084fc 75%,#1a0533 100%)", border:"#8b5cf6", text:"#e9d5ff" };
  if (pct >= 90) return { name:"GOLD",     bg:"linear-gradient(135deg,#78350f 0%,#b45309 25%,#f59e0b 50%,#fbbf24 75%,#78350f 100%)", border:"#f59e0b", text:"#fef3c7" };
  if (pct >= 70) return { name:"SILVER",   bg:"linear-gradient(135deg,#374151 0%,#6b7280 25%,#9ca3af 50%,#d1d5db 75%,#374151 100%)", border:"#9ca3af", text:"#f3f4f6" };
  if (pct >= 50) return { name:"BRONZE",   bg:"linear-gradient(135deg,#451a03 0%,#78350f 25%,#b45309 50%,#d97706 75%,#451a03 100%)", border:"#b45309", text:"#fed7aa" };
  return { name:"", bg:"#1f2937", border:"#374151", text:"#9ca3af" };
}
