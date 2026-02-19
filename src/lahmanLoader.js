// lahmanLoader.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure data helpers: CSV parsing + Lahman → statpad player-season transform.
// No React here — consumed by useLahmanData() in App.jsx.
// ─────────────────────────────────────────────────────────────────────────────

// Lahman teamID → game abbreviation. null = defunct franchise (skip row).
export const LAHMAN_TO_GAME = {
  // AL East
  NYA:"NYY", BOS:"BOS", TOR:"TOR", BAL:"BAL", TBA:"TBR", TBD:"TBR",
  // AL Central
  CHA:"CHW", MIN:"MIN", DET:"DET", CLE:"CLE", CLG:"CLE", KCA:"KCR",
  // AL West
  OAK:"OAK", ATH:"OAK", SEA:"SEA", HOU:"HOU", TEX:"TEX",
  LAA:"LAA", ANA:"LAA", CAL:"LAA",
  // NL East
  NYN:"NYM", PHI:"PHI", ATL:"ATL", MIA:"MIA", FLO:"MIA",
  WAS:"WSN", MON:null,
  // NL Central
  CHN:"CHC", SLN:"STL", MIL:"MIL", CIN:"CIN", PIT:"PIT",
  // NL West
  LAN:"LAD", SFN:"SFG", SDN:"SDP", ARI:"ARI", COL:"COL",
};

const BATS_NORM = { L:"L", R:"R", B:"S" };
const OF_SUBS   = new Set(["LF","CF","RF"]);
const VALID_POS = new Set(["C","1B","2B","3B","SS","OF","P","DH"]);

// ── CSV parser ────────────────────────────────────────────────────────────────
// Handles UTF-8 BOM and CRLF. Lahman CSVs don't use quoted commas so a
// simple split is sufficient and avoids a library dependency.
export function parseCSVText(raw) {
  const text = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = line.split(",");
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

// ── Main transform ────────────────────────────────────────────────────────────
// Takes pre-parsed CSV row arrays + settings; returns the player-season array
// the rest of the app uses. Cheap to re-run when only settings change because
// the CSV parsing (the slow part) happens once upstream in useLahmanData.
export function buildPlayerSeasons(people, batting, fielding, settings) {
  const { startYear, endYear, minPA } = settings;

  // People.csv → name map + batting-hand map
  const nameMap = {}, batsMap = {};
  for (const row of people) {
    const pid = row.playerID;
    if (!pid) continue;
    nameMap[pid] = `${(row.nameFirst || "").trim()} ${(row.nameLast || "").trim()}`.trim();
    batsMap[pid] = BATS_NORM[row.bats] || "R";
  }

  // Fielding.csv → primary position per (playerID, yearID, teamID)
  // "Primary" = position with the most games played that season+team.
  const posMap = {}; // `pid|year|team` → [pos, games]
  for (const row of fielding) {
    const year = +row.yearID;
    if (year < startYear || year > endYear) continue;
    let pos = (row.POS || "").trim().toUpperCase();
    if (OF_SUBS.has(pos)) pos = "OF";
    if (!VALID_POS.has(pos)) continue;
    const key = `${row.playerID}|${row.yearID}|${row.teamID}`;
    const g = parseInt(row.G, 10) || 0;
    if (!posMap[key] || g > posMap[key][1]) posMap[key] = [pos, g];
  }

  // Batting.csv → one record per player-team-stint
  const records = [];
  for (const row of batting) {
    const year = +row.yearID;
    if (year < startYear || year > endYear) continue;

    const gameTeam = LAHMAN_TO_GAME[row.teamID];
    if (!gameTeam) continue;                    // defunct franchise

    const name = nameMap[row.playerID];
    if (!name) continue;

    const ab  = +row.AB  || 0;
    const h   = +row.H   || 0;
    const dbl = +row["2B"] || 0;
    const trp = +row["3B"] || 0;
    const hr  = +row.HR  || 0;
    const rbi = +row.RBI || 0;
    const r   = +row.R   || 0;
    const sb  = +row.SB  || 0;
    const bb  = +row.BB  || 0;
    const so  = +row.SO  || 0;
    const hbp = +row.HBP || 0;
    const sf  = +row.SF  || 0;
    const sh  = +row.SH  || 0;

    const pa = ab + bb + hbp + sf + sh;
    if (pa < minPA) continue;

    const avg = ab > 0 ? +(h / ab).toFixed(3) : 0;
    const obpD = ab + bb + hbp + sf;
    const obp  = obpD > 0 ? +((h + bb + hbp) / obpD).toFixed(3) : 0;
    const tb   = h + dbl + 2 * trp + 3 * hr;
    const slg  = ab > 0 ? +(tb / ab).toFixed(3) : 0;
    const ops  = +(obp + slg).toFixed(3);

    const posKey = `${row.playerID}|${row.yearID}|${row.teamID}`;
    const pos    = posMap[posKey]?.[0] ?? "DH";
    const bats   = batsMap[row.playerID] || "R";

    records.push({
      name, team: gameTeam, year, pos, bats,
      HR: hr, RBI: rbi, R: r, H: h, SB: sb, BB: bb,
      SO: so, "2B": dbl, "3B": trp, PA: pa, AB: ab,
      AVG: avg, OBP: obp, SLG: slg, OPS: ops,
      "wRC+": 100, WAR: 0.0,
      XBH: dbl + trp + hr,
    });
  }

  return records;
}
