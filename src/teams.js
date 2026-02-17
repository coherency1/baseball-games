// MLB team metadata: logos, colors, divisions
// Logo source: ESPN CDN (free, public, no auth required)
// Pattern: https://a.espncdn.com/i/teamlogos/mlb/500/{abbr}.png
//   where abbr is the lowercase ESPN abbreviation
// Dark variant: https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/{abbr}.png

// ESPN uses slightly different abbreviations for some teams:
//   CHW -> chw, WSN -> wsh, TBR -> tb, KCR -> kc, SFG -> sf, SDP -> sd
const ESPN_ABBR = {
  NYY:"nyy",NYM:"nym",BOS:"bos",TOR:"tor",BAL:"bal",TBR:"tb",
  CHC:"chc",CHW:"chw",STL:"stl",MIL:"mil",CIN:"cin",PIT:"pit",
  LAD:"lad",LAA:"laa",SFG:"sf",SDP:"sd",ARI:"ari",COL:"col",
  ATL:"atl",PHI:"phi",WSN:"wsh",MIA:"mia",
  HOU:"hou",TEX:"tex",SEA:"sea",OAK:"oak",
  CLE:"cle",MIN:"min",DET:"det",KCR:"kc",
};

export function getTeamLogoUrl(abbr) {
  const espn = ESPN_ABBR[abbr] || abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${espn}.png`;
}

export function getTeamDarkLogoUrl(abbr) {
  const espn = ESPN_ABBR[abbr] || abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${espn}.png`;
}

export const MLB_TEAMS = {
  NYY: { name:"Yankees",     city:"New York",      division:"AL East",    league:"AL", color:"#003087", alt:"#E4002B" },
  BOS: { name:"Red Sox",     city:"Boston",        division:"AL East",    league:"AL", color:"#BD3039", alt:"#0C2340" },
  TBR: { name:"Rays",        city:"Tampa Bay",     division:"AL East",    league:"AL", color:"#092C5C", alt:"#8FBCE6" },
  TOR: { name:"Blue Jays",   city:"Toronto",       division:"AL East",    league:"AL", color:"#134A8E", alt:"#1D2D5C" },
  BAL: { name:"Orioles",     city:"Baltimore",     division:"AL East",    league:"AL", color:"#DF4601", alt:"#27251F" },
  CLE: { name:"Guardians",   city:"Cleveland",     division:"AL Central", league:"AL", color:"#00385D", alt:"#E50022" },
  MIN: { name:"Twins",       city:"Minnesota",     division:"AL Central", league:"AL", color:"#002B5C", alt:"#D31145" },
  CHW: { name:"White Sox",   city:"Chicago",       division:"AL Central", league:"AL", color:"#27251F", alt:"#C4CED4" },
  KCR: { name:"Royals",      city:"Kansas City",   division:"AL Central", league:"AL", color:"#004687", alt:"#BD9B60" },
  DET: { name:"Tigers",      city:"Detroit",       division:"AL Central", league:"AL", color:"#0C2340", alt:"#FA4616" },
  HOU: { name:"Astros",      city:"Houston",       division:"AL West",   league:"AL", color:"#002D62", alt:"#EB6E1F" },
  TEX: { name:"Rangers",     city:"Texas",         division:"AL West",   league:"AL", color:"#003278", alt:"#C0111F" },
  SEA: { name:"Mariners",    city:"Seattle",       division:"AL West",   league:"AL", color:"#0C2C56", alt:"#005C5C" },
  LAA: { name:"Angels",      city:"Los Angeles",   division:"AL West",   league:"AL", color:"#BA0021", alt:"#003263" },
  OAK: { name:"Athletics",   city:"Oakland",       division:"AL West",   league:"AL", color:"#003831", alt:"#EFB21E" },
  ATL: { name:"Braves",      city:"Atlanta",       division:"NL East",   league:"NL", color:"#CE1141", alt:"#13274F" },
  PHI: { name:"Phillies",    city:"Philadelphia",  division:"NL East",   league:"NL", color:"#E81828", alt:"#002D72" },
  NYM: { name:"Mets",        city:"New York",      division:"NL East",   league:"NL", color:"#002D72", alt:"#FF5910" },
  MIA: { name:"Marlins",     city:"Miami",         division:"NL East",   league:"NL", color:"#00A3E0", alt:"#EF3340" },
  WSN: { name:"Nationals",   city:"Washington",    division:"NL East",   league:"NL", color:"#AB0003", alt:"#14225A" },
  MIL: { name:"Brewers",     city:"Milwaukee",     division:"NL Central",league:"NL", color:"#12284B", alt:"#FFC52F" },
  CHC: { name:"Cubs",        city:"Chicago",       division:"NL Central",league:"NL", color:"#0E3386", alt:"#CC3433" },
  CIN: { name:"Reds",        city:"Cincinnati",    division:"NL Central",league:"NL", color:"#C6011F", alt:"#000000" },
  PIT: { name:"Pirates",     city:"Pittsburgh",    division:"NL Central",league:"NL", color:"#27251F", alt:"#FDB827" },
  STL: { name:"Cardinals",   city:"St. Louis",     division:"NL Central",league:"NL", color:"#C41E3A", alt:"#0C2340" },
  LAD: { name:"Dodgers",     city:"Los Angeles",   division:"NL West",   league:"NL", color:"#005A9C", alt:"#EF3E42" },
  SDP: { name:"Padres",      city:"San Diego",     division:"NL West",   league:"NL", color:"#2F241D", alt:"#FFC425" },
  ARI: { name:"D-backs",     city:"Arizona",       division:"NL West",   league:"NL", color:"#A71930", alt:"#E3D4AD" },
  SFG: { name:"Giants",      city:"San Francisco", division:"NL West",   league:"NL", color:"#FD5A1E", alt:"#27251F" },
  COL: { name:"Rockies",     city:"Colorado",      division:"NL West",   league:"NL", color:"#333366", alt:"#C4CED4" },
};

export const DIVISIONS = ["AL East","AL Central","AL West","NL East","NL Central","NL West"];
