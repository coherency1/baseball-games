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
  // Batting scoring stats (hitter puzzles)
  { key: "HR",   label: "HRs",   type: "batting" },
  { key: "RBI",  label: "RBI",   type: "batting" },
  { key: "R",    label: "Runs",  type: "batting" },
  { key: "H",    label: "Hits",  type: "batting" },
  { key: "SB",   label: "SBs",   type: "batting" },
  { key: "BB",   label: "BBs",   type: "batting" },
  { key: "2B",   label: "2Bs",   type: "batting" },
  { key: "XBH",  label: "XBH",   type: "batting" },
  // Pitching scoring stats (pitcher puzzles)
  { key: "SO",   label: "Ks",    type: "pitching" },
  { key: "W",    label: "Wins",  type: "pitching" },
  { key: "SV",   label: "Saves", type: "pitching" },
  { key: "ERA",  label: "ERA",   type: "pitching", lowerIsBetter: true  },
  { key: "WHIP", label: "WHIP",  type: "pitching", lowerIsBetter: true  },
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

// Anti-double-jeopardy: do two category values overlap (share possible player-seasons)?
function catsOverlap(a, b) {
  // --- Col 1: TEAM / DIVISION / LEAGUE / ALL_TEAMS ---
  // These need containment-aware comparison: ALL_TEAMS > LEAGUE > DIVISION > TEAM.
  const COL1 = new Set([CATEGORY_TYPES.TEAM, CATEGORY_TYPES.DIVISION, CATEGORY_TYPES.LEAGUE, CATEGORY_TYPES.ALL_TEAMS]);
  if (COL1.has(a.type) && COL1.has(b.type)) {
    if (a.type === CATEGORY_TYPES.ALL_TEAMS || b.type === CATEGORY_TYPES.ALL_TEAMS) return true;
    if (a.type === b.type) return a.value === b.value;
    // Cross-type: extract whichever specific categories are present
    const tv = [a, b].find(x => x.type === CATEGORY_TYPES.TEAM)?.value;
    const dv = [a, b].find(x => x.type === CATEGORY_TYPES.DIVISION)?.value;
    const lv = [a, b].find(x => x.type === CATEGORY_TYPES.LEAGUE)?.value;
    if (tv && dv) return MLB_TEAMS[tv]?.division === dv;
    if (tv && lv) return MLB_TEAMS[tv]?.league === lv;
    if (dv && lv) return dv.startsWith(lv); // "AL East".startsWith("AL") → true
    return false;
  }

  // --- Col 2: YEAR_RANGE / YEAR_EXACT ---
  // Treat both as [lo, hi] intervals; overlap iff intervals intersect.
  const YEAR_TYPES = new Set([CATEGORY_TYPES.YEAR_EXACT, CATEGORY_TYPES.YEAR_RANGE]);
  if (YEAR_TYPES.has(a.type) && YEAR_TYPES.has(b.type)) {
    const aLo = a.type === CATEGORY_TYPES.YEAR_EXACT ? a.value : a.value[0];
    const aHi = a.type === CATEGORY_TYPES.YEAR_EXACT ? a.value : a.value[1];
    const bLo = b.type === CATEGORY_TYPES.YEAR_EXACT ? b.value : b.value[0];
    const bHi = b.type === CATEGORY_TYPES.YEAR_EXACT ? b.value : b.value[1];
    return aLo <= bHi && bLo <= aHi;
  }

  // Different column types never share player-seasons.
  if (a.type !== b.type) return false;

  // --- Col 3: BATS ---
  if (a.type === CATEGORY_TYPES.BATS) return a.value === b.value;

  // --- Col 3: POSITION ---
  if (a.type === CATEGORY_TYPES.POSITION) {
    // DH / UTL are "any" — only overlap with each other so rows can share
    // a DH row alongside an IF/OF row without being blocked.
    const ANY_POS = new Set(["DH", "UTL"]);
    const aIsAny = ANY_POS.has(a.value), bIsAny = ANY_POS.has(b.value);
    if (aIsAny && bIsAny) return true;
    if (aIsAny || bIsAny) return false;
    // Expand IF → {1B,2B,3B,SS} and OF → {OF,LF,CF,RF}, then intersect.
    const IF_SET = new Set(["1B", "2B", "3B", "SS"]);
    const OF_SET = new Set(["OF", "LF", "CF", "RF"]);
    const expand = v => v === "IF" ? IF_SET : v === "OF" ? OF_SET : new Set([v]);
    const aSet = expand(a.value), bSet = expand(b.value);
    for (const p of aSet) { if (bSet.has(p)) return true; }
    return false;
  }

  // --- Col 3: STAT_THRESHOLD ---
  // Two thresholds on the same stat share the same player population.
  if (a.type === CATEGORY_TYPES.STAT_THRESHOLD) return a.value.stat === b.value.stat;

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

// Era-aware year category generator.
//
// Range breakpoints are the same relative positions as the original 2008-2025
// distribution (fractions derived from that era's integer offsets), so the feel
// of the puzzles is preserved regardless of which era the user has selected:
//
//   range A  [~12%, ~71%]  weight 15   (like 2010-2020 in the default era)
//   range B  [~76%, 100%]  weight 20   (like 2021-2025)
//   range C  [  0%, ~47%]  weight  5   (like 2008-2016)
//   range D  [~53%, 100%]  weight  5   (like 2017-2025)
//
// Exact years use the same recency weights as before:
//   last year: 10%, 2nd last: 10%, years 3-5: 17%, 6-8: 10%, 9-11: 5%, 12+: 3%
function genCol2(eraStart, eraEnd, teamSelected = false) {
  const span = eraEnd - eraStart;
  // Map a [0,1] fraction to a year offset using Math.round so that for the
  // default 2008-2025 era (span=17) we get exactly the original breakpoints.
  const yr = (f) => eraStart + Math.round(span * f);

  // Four proportional ranges — degenerate ones (start >= end) are dropped.
  const rangeCands = [
    { v: [yr(0.118), yr(0.706)], w: 15 },
    { v: [yr(0.765), eraEnd],    w: 20 },
    { v: [eraStart, yr(0.471)],  w:  5 },
    { v: [yr(0.529), eraEnd],    w:  5 },
  ].filter(c => c.v[0] < c.v[1]);

  // Exact years, recency-weighted from most recent backward.
  const yearCands = [];
  const addYrs = (fromEnd, count, totalW) => {
    const n = Math.min(count, Math.max(0, span + 1 - fromEnd));
    if (n === 0 || totalW === 0) return;
    for (let i = 0; i < n; i++)
      yearCands.push({ y: eraEnd - fromEnd - i, w: totalW / n });
  };
  addYrs(0,  1, 10);
  addYrs(1,  1, 10);
  addYrs(2,  3, 17);
  addYrs(5,  3, 10);
  addYrs(8,  3,  5);
  const olderCount = Math.max(0, span - 10);
  if (olderCount > 0) addYrs(11, olderCount, 3);

  const rangeTotal = rangeCands.reduce((s, c) => s + c.w, 0);
  const yearTotal  = yearCands.reduce((s, c) => s + c.w, 0);
  const total = rangeTotal + yearTotal;

  if (total === 0)
    return { type: CATEGORY_TYPES.YEAR_RANGE, value: [eraStart, eraEnd], label: `${eraStart} to ${eraEnd}` };

  const r = Math.random() * total;
  let result = null;

  if (r < rangeTotal) {
    let acc = 0;
    for (const c of rangeCands) {
      acc += c.w;
      if (r < acc) { result = { type: CATEGORY_TYPES.YEAR_RANGE, value: c.v, label: `${c.v[0]} to ${c.v[1]}` }; break; }
    }
  } else {
    let acc = rangeTotal;
    for (const c of yearCands) {
      acc += c.w;
      if (r < acc) { result = { type: CATEGORY_TYPES.YEAR_EXACT, value: c.y, label: `${c.y}` }; break; }
    }
  }

  result = result ?? { type: CATEGORY_TYPES.YEAR_RANGE, value: [eraStart, eraEnd], label: `${eraStart} to ${eraEnd}` };

  // Single-team constraint: only the last year of the era may be exact alongside a
  // specific team (same rule as original: value < eraEnd - 1 falls back to a range).
  if (teamSelected && result.type === CATEGORY_TYPES.YEAR_EXACT && result.value < eraEnd - 1) {
    const eligible = rangeCands.filter(c => c.v[0] < c.v[1]);
    const total2 = eligible.reduce((s, c) => s + c.w, 0);
    if (total2 > 0) {
      const rr = Math.random() * total2;
      let acc = 0;
      for (const c of eligible) {
        acc += c.w;
        if (rr < acc) return { type: CATEGORY_TYPES.YEAR_RANGE, value: c.v, label: `${c.v[0]} to ${c.v[1]}` };
      }
    }
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

// Pitcher-specific column 3: role (starter/closer) or pitching stat threshold
function genPitcherCol3() {
  const r = Math.random();
  if (r < 0.40) {
    // Starter vs. closer/reliever split
    if (r < 0.22) {
      return { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "GS", min: 20 }, label: "SP (20+ GS)" };
    }
    return { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "SV", min: 10 }, label: "Closer (10+ SV)" };
  }
  // Stat thresholds
  const opts = [
    { stat: "SO",   min: 150, label: "150+ Ks"     },
    { stat: "SO",   min: 200, label: "200+ Ks"     },
    { stat: "W",    min: 12,  label: "12+ Wins"    },
    { stat: "W",    min: 15,  label: "15+ Wins"    },
    { stat: "SV",   min: 20,  label: "20+ Saves"   },
    { stat: "GS",   min: 28,  label: "28+ Starts"  },
    { stat: "IP",   min: 150, label: "150+ IP"     },
    { stat: "IP",   min: 180, label: "180+ IP"     },
  ];
  const o = opts[Math.floor(Math.random() * opts.length)];
  return { type: CATEGORY_TYPES.STAT_THRESHOLD, value: o, label: o.label };
}

export function generatePuzzle(playerSeasons, pitcherSeasons = [], numRows = 5, keepScoringStatKey = null) {
  const scoringStat = (keepScoringStatKey && SCORING_STATS.find(s => s.key === keepScoringStatKey))
    ?? SCORING_STATS[Math.floor(Math.random() * SCORING_STATS.length)];
  const isPitcherPuzzle = scoringStat.type === "pitching";

  // Pitcher puzzles use the pitcher pool; hitter puzzles exclude pitchers entirely.
  const seasonPool = isPitcherPuzzle
    ? pitcherSeasons
    : playerSeasons.filter(ps => ps.pos !== "P");

  // Derive era bounds from the pool so year categories stay within the active filter.
  let eraStart = Infinity, eraEnd = -Infinity;
  for (const ps of seasonPool) {
    if (ps.year < eraStart) eraStart = ps.year;
    if (ps.year > eraEnd)   eraEnd   = ps.year;
  }
  if (!isFinite(eraStart)) { eraStart = 2008; eraEnd = 2025; }

  const availableTeams = getAvailableTeams(seasonPool);
  const rows = [];
  // Track accepted rows as category triples for AND-based overlap detection.
  // A new row is only rejected if a player-season could satisfy BOTH it AND an
  // existing row simultaneously (all three columns must overlap at once).
  const usedRows = [];

  // Helper: returns true iff the same player-season could satisfy both rows.
  const rowsOverlap = (existing, cats) =>
    catsOverlap(existing[0], cats[0]) &&
    catsOverlap(existing[1], cats[1]) &&
    catsOverlap(existing[2], cats[2]);

  for (let i = 0; i < numRows; i++) {
    let bestRow = null;

    // Primary loop: 150 attempts at a valid, non-overlapping row
    for (let attempt = 0; attempt < 150; attempt++) {
      const c1 = genCol1(availableTeams);
      const c2 = genCol2(eraStart, eraEnd, c1.type === CATEGORY_TYPES.TEAM);
      const c3 = isPitcherPuzzle ? genPitcherCol3() : genCol3();
      const cats = [c1, c2, c3];

      // Reject only if a player-season could satisfy this AND an existing row
      if (usedRows.some(existing => rowsOverlap(existing, cats))) continue;

      const matches = findMatchingSeasons(cats, seasonPool);
      // Single-year rows require at least 8 valid answers to keep them fair.
      const minCount = cats[1].type === CATEGORY_TYPES.YEAR_EXACT ? 8 : 3;
      if (matches.length >= minCount && matches.length <= 15) {
        bestRow = { categories: cats, validAnswers: matches };
        break;
      }
    }

    // Secondary fallback: ALL_TEAMS + random col2/col3, up to 30 attempts
    if (!bestRow) {
      for (let fb = 0; fb < 30; fb++) {
        const cats = [
          { type: CATEGORY_TYPES.ALL_TEAMS, value: "all", label: "MLB" },
          genCol2(eraStart, eraEnd),
          isPitcherPuzzle ? genPitcherCol3() : genCol3(),
        ];
        if (usedRows.some(existing => rowsOverlap(existing, cats))) continue;
        const matches = findMatchingSeasons(cats, seasonPool);
        const minCount = cats[1].type === CATEGORY_TYPES.YEAR_EXACT ? 8 : 3;
        if (matches.length >= minCount) {
          bestRow = { categories: cats, validAnswers: matches };
          break;
        }
      }
    }

    // Last-resort hard fallback: guaranteed solvable, overlap check skipped.
    // Practically unreachable (requires all 180 attempts to fail).
    if (!bestRow) {
      const fallbackC3 = isPitcherPuzzle
        ? { type: CATEGORY_TYPES.STAT_THRESHOLD, value: { stat: "GS", min: 20 }, label: "SP (20+ GS)" }
        : { type: CATEGORY_TYPES.BATS, value: "R", label: "Right" };
      // Use a proportional mid-era range (same as range A in genCol2) for maximum coverage.
      const fbStart = eraStart + Math.round((eraEnd - eraStart) * 0.118);
      const fbEnd   = eraStart + Math.round((eraEnd - eraStart) * 0.706);
      const fbRange = fbStart < fbEnd ? [fbStart, fbEnd] : [eraStart, eraEnd];
      const cats = [
        { type: CATEGORY_TYPES.ALL_TEAMS, value: "all", label: "MLB" },
        { type: CATEGORY_TYPES.YEAR_RANGE, value: fbRange, label: `${fbRange[0]} to ${fbRange[1]}` },
        fallbackC3,
      ];
      bestRow = { categories: cats, validAnswers: findMatchingSeasons(cats, seasonPool) };
    }

    rows.push(bestRow);
    usedRows.push(bestRow.categories);
  }

  return { scoringStat, rows, isPitcherPuzzle, id: Date.now().toString(36) };
}

// Percentile within this row's valid answers.
// For normal stats (HR, SO, W…): highest value = 100th percentile.
// For lowerIsBetter stats (ERA, WHIP): lowest value = 100th percentile.
export function computePercentile(score, statKey, row, lowerIsBetter = false) {
  const scores = row.validAnswers
    .map(ps => ps[statKey] ?? null)
    .filter(v => v !== null && (lowerIsBetter ? v >= 0 : v > 0))
    .sort((a, b) => a - b);
  if (scores.length === 0) return 50;
  const min = scores[0];
  const max = scores[scores.length - 1];
  if (max === min) return 50;

  if (lowerIsBetter) {
    // Lower value → closer to 100th percentile
    return Math.min(100, Math.max(0, Math.round((1 - (score - min) / (max - min)) * 100)));
  }
  return Math.min(100, Math.round((score / max) * 100));
}

export function getTier(pct) {
  if (pct >= 95) return { name:"PLATINUM", bg:"linear-gradient(135deg,#1a0533 0%,#2d1b69 25%,#8b5cf6 50%,#c084fc 75%,#1a0533 100%)", border:"#8b5cf6", text:"#e9d5ff" };
  if (pct >= 90) return { name:"GOLD",     bg:"linear-gradient(135deg,#78350f 0%,#b45309 25%,#f59e0b 50%,#fbbf24 75%,#78350f 100%)", border:"#f59e0b", text:"#fef3c7" };
  if (pct >= 70) return { name:"SILVER",   bg:"linear-gradient(135deg,#374151 0%,#6b7280 25%,#9ca3af 50%,#d1d5db 75%,#374151 100%)", border:"#9ca3af", text:"#f3f4f6" };
  if (pct >= 50) return { name:"BRONZE",   bg:"linear-gradient(135deg,#451a03 0%,#78350f 25%,#b45309 50%,#d97706 75%,#451a03 100%)", border:"#b45309", text:"#fed7aa" };
  return { name:"", bg:"#1f2937", border:"#374151", text:"#9ca3af" };
}
