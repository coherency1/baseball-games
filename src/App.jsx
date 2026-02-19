import { useState, useEffect, useRef, useMemo } from "react";
import { MLB_TEAMS, DIVISIONS, getTeamLogoUrl } from "./teams.js";
import {
  CATEGORY_TYPES, SCORING_STATS,
  matchesCategory, findMatchingSeasons,
  generatePuzzle, computePercentile, getTier,
} from "./engine.js";
import PinpointChallenge from "./PinpointChallenge.jsx";
import { parseCSVText, buildPlayerSeasons, buildPitcherSeasons } from "./lahmanLoader.js";

// =====================================================================
// DATA LOADING — Lahman CSVs (public/lahman-folder/)
// =====================================================================
// Fetches and parses the three Lahman CSV files once, then buildPlayerSeasons
// re-filters cheaply whenever settings (startYear / endYear / minPA) change.

function useLahmanData() {
  // Raw parsed CSV rows — fetched and parsed once, never refetched
  const [raw, setRaw] = useState(null);
  const [csvLoading, setCsvLoading] = useState(true);
  const [csvError, setCsvError]   = useState(null);

  useEffect(() => {
    const base = "/lahman-folder";
    Promise.all([
      fetch(`${base}/People.csv`).then(r => r.text()),
      fetch(`${base}/Batting.csv`).then(r => r.text()),
      fetch(`${base}/Fielding.csv`).then(r => r.text()),
      fetch(`${base}/Pitching.csv`).then(r => r.text()),
    ])
      .then(([p, b, f, pit]) => {
        setRaw({
          people:   parseCSVText(p),
          batting:  parseCSVText(b),
          fielding: parseCSVText(f),
          pitching: parseCSVText(pit),
        });
        setCsvLoading(false);
      })
      .catch(e => { setCsvError(e.message); setCsvLoading(false); });
  }, []);

  return { raw, csvLoading, csvError };
}

// =====================================================================
// DATA FILTER PANEL
// =====================================================================

const ERA_PRESETS = [
  { label: "Modern",    startYear: 2015, endYear: 2025 },
  { label: "Since '00", startYear: 2000, endYear: 2025 },
  { label: "Since '90", startYear: 1990, endYear: 2025 },
  { label: "All-Time",  startYear: 1871, endYear: 2025 },
];

function DataFilterPanel({ settings, onChange, recordCount }) {
  const [open, setOpen] = useState(false);
  const { startYear, endYear, minPA } = settings;

  const set = (key, val) => onChange({ ...settings, [key]: val });

  const activePreset = ERA_PRESETS.find(
    p => p.startYear === startYear && p.endYear === endYear
  );

  return (
    <div style={{ marginBottom: "12px" }}>
      {/* Toggle row */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            padding: "5px 12px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.12)",
            background: open ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
          }}
        >
          <span style={{ fontSize: "10px" }}>{open ? "▲" : "▼"}</span>
          Filters
        </button>
        <span style={{
          fontSize: "11px", color: "rgba(255,255,255,0.3)",
          background: "rgba(255,255,255,0.05)", borderRadius: "5px", padding: "3px 8px",
        }}>
          {activePreset?.label ?? `${startYear}–${endYear}`}
          {" · "}
          {recordCount != null ? `${recordCount.toLocaleString()} player-seasons` : "loading…"}
        </span>
      </div>

      {/* Expanded panel */}
      {open && (
        <div style={{
          marginTop: "10px", padding: "14px 16px", borderRadius: "10px",
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        }}>
          {/* Era presets */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: "6px" }}>ERA PRESET</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {ERA_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => onChange({ ...settings, startYear: p.startYear, endYear: p.endYear })}
                  style={{
                    padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer",
                    fontSize: "12px", fontWeight: 600,
                    background: activePreset?.label === p.label
                      ? "#3b82f6" : "rgba(255,255,255,0.08)",
                    color: activePreset?.label === p.label
                      ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom year range */}
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: "4px" }}>START YEAR</div>
              <input
                type="number" min={1871} max={endYear} value={startYear}
                onChange={e => set("startYear", Math.min(+e.target.value, endYear))}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: "4px" }}>END YEAR</div>
              <input
                type="number" min={startYear} max={2025} value={endYear}
                onChange={e => set("endYear", Math.max(+e.target.value, startYear))}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: "4px" }}>MIN PA</div>
              <input
                type="number" min={1} max={700} value={minPA}
                onChange={e => set("minPA", Math.max(1, +e.target.value))}
                style={{ ...inputStyle, width: "70px" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "80px", padding: "6px 10px", borderRadius: "7px",
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(0,0,0,0.3)", color: "#fff",
  fontSize: "14px", fontFamily: "inherit", outline: "none",
};

// =====================================================================
// COMPONENTS
// =====================================================================

function TeamLogo({ team, size = 40 }) {
  const [imgError, setImgError] = useState(false);
  const info = MLB_TEAMS[team];
  if (!info) return (
    <div style={{ width:size,height:size,borderRadius:"50%",background:"#333",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.1)",flexShrink:0 }}>
      <span style={{ color:"#888",fontSize:size*0.28,fontWeight:800 }}>MLB</span>
    </div>
  );
  if (imgError) return (
    <div style={{ width:size,height:size,borderRadius:"50%",background:info.color,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.15)",flexShrink:0 }}>
      <span style={{ color:"#fff",fontSize:size*0.30,fontWeight:800,textShadow:"0 1px 2px rgba(0,0,0,0.5)",letterSpacing:"-0.03em" }}>{team}</span>
    </div>
  );
  return (
    <div style={{ width:size,height:size,borderRadius:Math.round(size*0.18),background:"rgba(255,255,255,0.93)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden" }}>
      <img
        src={getTeamLogoUrl(team)}
        alt={info.name}
        style={{ width:size*0.82,height:size*0.82,objectFit:"contain" }}
        onError={() => setImgError(true)}
      />
    </div>
  );
}

function MlbLogo({ size = 44 }) {
  const [imgError, setImgError] = useState(false);
  if (imgError) return (
    <div style={{ width:size,height:size,borderRadius:Math.round(size*0.18),background:"#1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.1)",flexShrink:0 }}>
      <span style={{ color:"#fff",fontSize:size*0.26,fontWeight:800 }}>MLB</span>
    </div>
  );
  return (
    <div style={{ width:size,height:size,borderRadius:Math.round(size*0.18),background:"rgba(255,255,255,0.93)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden" }}>
      <img
        src="https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png"
        alt="MLB"
        style={{ width:size*0.82,height:size*0.82,objectFit:"contain" }}
        onError={() => setImgError(true)}
      />
    </div>
  );
}

// -- Player Search Modal --
function PlayerSearchModal({ seasons, onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const playerIndex = useMemo(() => {
    const map = {};
    seasons.forEach(ps => {
      if (!map[ps.name]) map[ps.name] = { name:ps.name, minYear:ps.year, maxYear:ps.year };
      map[ps.name].minYear = Math.min(map[ps.name].minYear, ps.year);
      map[ps.name].maxYear = Math.max(map[ps.name].maxYear, ps.year);
    });
    return Object.values(map);
  }, [seasons]);

  const allFiltered = query.length >= 2
    ? playerIndex.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : [];
  const filtered = allFiltered.slice(0, 15);

  const playerYears = selectedPlayer
    ? [...new Set(seasons.filter(ps => ps.name === selectedPlayer).map(ps => ps.year))].sort((a,b)=>b-a)
    : [];

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }} onClick={onClose}>
      <div style={{ background:"#1a1d23",borderRadius:"16px",width:"100%",maxWidth:"400px",overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ color:"rgba(255,255,255,0.5)",fontSize:"12px",fontWeight:700,letterSpacing:"0.1em" }}>ADD PLAYER</span>
          <span onClick={onClose} style={{ color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:"14px" }}>Close</span>
        </div>

        {!selectedPlayer ? (<>
          <div style={{ padding:"12px 16px",position:"relative" }}>
            <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players..."
              style={{ width:"100%",padding:"12px 16px",borderRadius:"10px",border:"2px solid rgba(100,160,255,0.4)",background:"rgba(0,0,0,0.4)",color:"#fff",fontSize:"16px",outline:"none",boxSizing:"border-box" }} />
            {query && <span onClick={()=>setQuery("")} style={{ position:"absolute",right:"24px",top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:"14px",background:"rgba(255,255,255,0.1)",borderRadius:"50%",width:"20px",height:"20px",display:"flex",alignItems:"center",justifyContent:"center" }}>x</span>}
          </div>
          <div style={{ maxHeight:"300px",overflowY:"auto" }}>
            {filtered.map(p => (
              <div key={p.name} onClick={()=>setSelectedPlayer(p.name)} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.05)" }}
                onMouseOver={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                <span style={{ color:"#fff",fontSize:"15px",fontWeight:500 }}>{p.name}</span>
                <span style={{ color:"rgba(255,255,255,0.35)",fontSize:"13px" }}>{p.minYear} - {p.maxYear}</span>
              </div>
            ))}
            {query.length>=2 && allFiltered.length===0 && <div style={{ padding:"20px",textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:"14px" }}>No players found</div>}
            {allFiltered.length > 15 && <div style={{ padding:"10px 20px",textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:"12px",borderTop:"1px solid rgba(255,255,255,0.05)" }}>Showing 15 of {allFiltered.length} — type more to narrow results</div>}
          </div>
        </>) : (<>
          <div style={{ padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
              <span onClick={()=>{setSelectedPlayer(null);setSelectedYear(null);}} style={{ color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:"18px" }}>&larr;</span>
              <span style={{ color:"#fff",fontSize:"16px",fontWeight:600 }}>{selectedPlayer}</span>
            </div>
          </div>
          <div style={{ maxHeight:"300px",overflowY:"auto" }}>
            {playerYears.map(y => (
              <div key={y} onClick={()=>setSelectedYear(y)} style={{ padding:"12px 20px",cursor:"pointer",background:selectedYear===y?"rgba(59,130,246,0.8)":"transparent",color:selectedYear===y?"#fff":"rgba(255,255,255,0.7)",fontSize:"15px",fontWeight:selectedYear===y?700:400,borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:"8px" }}
                onMouseOver={e=>{if(selectedYear!==y)e.currentTarget.style.background="rgba(255,255,255,0.05)";}} onMouseOut={e=>{if(selectedYear!==y)e.currentTarget.style.background="transparent";}}>
                {selectedYear===y && <span style={{fontSize:"12px"}}>&#10003;</span>}{y}
              </div>
            ))}
          </div>
          <div style={{ padding:"12px 16px" }}>
            <button onClick={()=>{if(selectedPlayer&&selectedYear)onSelect(selectedPlayer,selectedYear);}} disabled={!selectedYear}
              style={{ width:"100%",padding:"14px",borderRadius:"10px",border:"none",background:selectedYear?"#22c55e":"rgba(255,255,255,0.1)",color:selectedYear?"#fff":"rgba(255,255,255,0.3)",fontSize:"15px",fontWeight:700,cursor:selectedYear?"pointer":"default" }}>
              Submit
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// -- Result Card --
function ResultCard({ playerName, year, team, score, statLabel, percentile, onClick }) {
  const tier = getTier(percentile);
  return (
    <div style={{ background:tier.bg,borderRadius:"12px",padding:"14px 18px",border:`1px solid ${tier.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",cursor:"pointer" }} onClick={onClick}>
      <div style={{ display:"flex",alignItems:"center",gap:"12px",minWidth:0 }}>
        <TeamLogo team={team} size={36} />
        <div>
          <div style={{ fontSize:"11px",color:tier.text,opacity:0.7,letterSpacing:"0.05em" }}>{playerName.split(" ")[0].toUpperCase()}</div>
          <div style={{ fontSize:"18px",fontWeight:800,color:tier.text }}>{playerName.split(" ").slice(1).join(" ").toUpperCase()}</div>
          <div style={{ fontSize:"11px",color:tier.text,opacity:0.6 }}>{year}</div>
        </div>
      </div>
      <div style={{ textAlign:"right",flexShrink:0 }}>
        <div style={{ fontSize:"22px",fontWeight:900,color:tier.text }}>{typeof score==="number"&&score%1!==0?score.toFixed(3):score} {statLabel}</div>
        <div style={{ fontSize:"11px",color:tier.text,opacity:0.7 }}>{percentile}<sup>th</sup> PERCENTILE</div>
      </div>
    </div>
  );
}

function IncorrectCard({ playerName, year, reason, onClick, showingTop5 }) {
  return (
    <div style={{ background:"rgba(239,68,68,0.1)",borderRadius:"12px",padding:"14px 18px",border:"1px solid rgba(239,68,68,0.3)",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer" }} onClick={onClick}>
      <div style={{ width:"36px",height:"36px",borderRadius:"50%",background:"rgba(239,68,68,0.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444",fontSize:"18px",fontWeight:800,flexShrink:0 }}>✕</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ color:"#fca5a5",fontWeight:700,fontSize:"15px" }}>{playerName} {year?`(${year})`:""}</div>
        <div style={{ color:"rgba(255,255,255,0.4)",fontSize:"12px",marginTop:"2px" }}>{reason}</div>
      </div>
      <div style={{ fontSize:"10px",color:"rgba(255,255,255,0.3)",fontWeight:600,flexShrink:0,letterSpacing:"0.04em" }}>
        {showingTop5 ? "▲ HIDE" : "▼ TOP 5"}
      </div>
    </div>
  );
}

function StatsPanel({ ps }) {
  if (!ps) return null;
  const stats = ps.pos === "P"
    ? [
        ["W",  ps.W],  ["L",  ps.L],  ["ERA", ps.ERA?.toFixed(2)],
        ["SO", ps.SO], ["BB", ps.BB], ["IP",  ps.IP],
        ["WHIP", ps.WHIP?.toFixed(3)], ["K/9", ps["K/9"]?.toFixed(1)],
        ["SV", ps.SV], ["G",  ps.G],  ["GS",  ps.GS],
      ]
    : [
        ["H",ps.H],["2B",ps["2B"]],["3B",ps["3B"]],["HR",ps.HR],
        ["RBI",ps.RBI],["R",ps.R],["XBH",ps.XBH],["SB",ps.SB],
        ["AVG",ps.AVG?.toFixed(3)],["OBP",ps.OBP?.toFixed(3)],
        ["SLG",ps.SLG?.toFixed(3)],["OPS",ps.OPS?.toFixed(3)],
        ["wRC+",ps["wRC+"]],["WAR",ps.WAR],
      ];
  const cols = ps.pos === "P" ? 6 : 7;
  return (
    <div style={{ display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:"1px",background:"rgba(255,255,255,0.05)",borderRadius:"8px",overflow:"hidden",marginTop:"8px" }}>
      {stats.map(([l,v])=>(
        <div key={l} style={{ background:"#1a1d23",padding:"6px 4px",textAlign:"center" }}>
          <div style={{ fontSize:"9px",color:"rgba(255,255,255,0.35)",letterSpacing:"0.05em" }}>{l}</div>
          <div style={{ fontSize:"13px",color:"#fff",fontWeight:700 }}>{v??"-"}</div>
        </div>
      ))}
    </div>
  );
}

// -- Top 5 answers for a row --
function Top5Panel({ validAnswers, scoringStatKey, scoringStatLabel, lowerIsBetter }) {
  const top5 = [...validAnswers]
    .filter(ps => (ps[scoringStatKey] ?? 0) > 0)
    .sort((a, b) => lowerIsBetter
      ? (a[scoringStatKey] || 0) - (b[scoringStatKey] || 0)
      : (b[scoringStatKey] || 0) - (a[scoringStatKey] || 0))
    .slice(0, 5);
  const fmt = v => typeof v === "number" && v % 1 !== 0 ? v.toFixed(3) : (v ?? "-");
  return (
    <div style={{ marginTop:"6px",background:"rgba(255,255,255,0.02)",borderRadius:"8px",overflow:"hidden",border:"1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ padding:"7px 12px",fontSize:"10px",color:"rgba(255,255,255,0.3)",letterSpacing:"0.1em",fontWeight:700,borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
        TOP 5 ANSWERS
      </div>
      {top5.map((ps, idx) => (
        <div key={`${ps.name}-${ps.year}`} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"7px 12px",borderBottom:idx<4?"1px solid rgba(255,255,255,0.04)":"none" }}>
          <span style={{ width:"16px",fontSize:"11px",color:"rgba(255,255,255,0.25)",fontWeight:700,flexShrink:0 }}>#{idx+1}</span>
          <TeamLogo team={ps.team} size={22} />
          <span style={{ flex:1,fontSize:"13px",color:"rgba(255,255,255,0.85)",fontWeight:600 }}>{ps.name}</span>
          <span style={{ fontSize:"11px",color:"rgba(255,255,255,0.35)",flexShrink:0 }}>{ps.year}</span>
          <span style={{ fontSize:"13px",fontWeight:800,color:"#f59e0b",minWidth:"52px",textAlign:"right",flexShrink:0 }}>
            {fmt(ps[scoringStatKey] || 0)} {scoringStatLabel}
          </span>
        </div>
      ))}
    </div>
  );
}

// -- Category Display for each column --
function CategoryDisplay({ category }) {
  const { type } = category;
  if (type === CATEGORY_TYPES.TEAM) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",minWidth:"70px" }}>
        <TeamLogo team={category.value} size={44} />
      </div>
    );
  }
  if (type === CATEGORY_TYPES.DIVISION && category.teams) {
    const top = category.teams.slice(0, 2);
    const bottom = category.teams.slice(2);
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"3px" }}>
        <div style={{ display:"flex",gap:"3px",justifyContent:"center" }}>
          {top.map(t => <TeamLogo key={t} team={t} size={22} />)}
        </div>
        <div style={{ display:"flex",gap:"3px",justifyContent:"center" }}>
          {bottom.map(t => <TeamLogo key={t} team={t} size={22} />)}
        </div>
        <span style={{ fontSize:"10px",color:"rgba(255,255,255,0.5)",fontWeight:600,textAlign:"center",marginTop:"2px" }}>{category.label}</span>
      </div>
    );
  }
  if (type === CATEGORY_TYPES.LEAGUE) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",minWidth:"70px" }}>
        <div style={{ width:44,height:44,borderRadius:Math.round(44*0.18),background:"rgba(255,255,255,0.93)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
          <span style={{ color:"#1a1d23",fontSize:18,fontWeight:900,letterSpacing:"-0.02em" }}>{category.value}</span>
        </div>
        <span style={{ fontSize:"10px",color:"rgba(255,255,255,0.5)",fontWeight:600 }}>{category.label}</span>
      </div>
    );
  }
  if (type === CATEGORY_TYPES.ALL_TEAMS) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",minWidth:"70px" }}>
        <MlbLogo size={44} />
      </div>
    );
  }
  if (type === CATEGORY_TYPES.YEAR_RANGE) {
    return (
      <div style={{ textAlign:"center",minWidth:"60px" }}>
        <div style={{ fontSize:"13px",fontWeight:800,color:"#fff" }}>{category.value[0]}</div>
        <div style={{ fontSize:"10px",color:"rgba(255,255,255,0.4)" }}>to</div>
        <div style={{ fontSize:"13px",fontWeight:800,color:"#fff" }}>{category.value[1]}</div>
      </div>
    );
  }
  if (type === CATEGORY_TYPES.YEAR_EXACT) {
    return <div style={{ textAlign:"center",minWidth:"60px" }}><div style={{ fontSize:"18px",fontWeight:800,color:"#fff" }}>{category.value}</div></div>;
  }
  // Position, Bats, Stat threshold
  let topLabel = "";
  if (type === CATEGORY_TYPES.POSITION) topLabel = "POSITION";
  if (type === CATEGORY_TYPES.BATS) topLabel = "BATS";
  const isAnyPos = type === CATEGORY_TYPES.POSITION && (category.value === "DH" || category.value === "UTL");
  return (
    <div style={{ textAlign:"center",minWidth:"80px" }}>
      {topLabel && <div style={{ fontSize:"9px",color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",marginBottom:"2px" }}>{topLabel}</div>}
      <div style={{ fontSize:"16px",fontWeight:800,color:"#fff" }}>{category.label}</div>
      {type === CATEGORY_TYPES.STAT_THRESHOLD && (
        <div style={{ fontSize:"8px",color:"#f59e0b",fontWeight:700,letterSpacing:"0.08em",background:"rgba(245,158,11,0.15)",borderRadius:"3px",padding:"2px 6px",marginTop:"3px",display:"inline-block" }}>SAME SEASON</div>
      )}
      {isAnyPos && (
        <div style={{ fontSize:"8px",color:"#60a5fa",fontWeight:700,letterSpacing:"0.08em",background:"rgba(96,165,250,0.12)",borderRadius:"3px",padding:"2px 6px",marginTop:"3px",display:"inline-block" }}>ANY POS</div>
      )}
    </div>
  );
}

// -- Puzzle Row --
function PuzzleRow({ row, rowIndex, scoringStat, submission, allRows, playerSeasons, pitcherSeasons, isPitcherPuzzle, onClickAdd, retryMode, wrongRowAttempts }) {
  const [showStats, setShowStats] = useState(false);
  const percentile = submission?.correct ? computePercentile(submission.score, scoringStat.key, row, scoringStat.lowerIsBetter) : 0;
  const seasonPool = isPitcherPuzzle ? pitcherSeasons : playerSeasons;
  const matchedSeason = submission?.correct ? seasonPool.find(ps => ps.name===submission.playerName && ps.year===submission.year) : null;

  if (submission?.correct) {
    return (
      <div style={{ marginBottom:"8px" }}>
        <ResultCard playerName={submission.playerName} year={submission.year} team={submission.team} score={submission.score} statLabel={scoringStat.label} percentile={percentile} onClick={()=>setShowStats(!showStats)} />
        {showStats && matchedSeason && <StatsPanel ps={matchedSeason} />}
        {showStats && <Top5Panel validAnswers={row.validAnswers} scoringStatKey={scoringStat.key} scoringStatLabel={scoringStat.label} lowerIsBetter={scoringStat.lowerIsBetter} />}
      </div>
    );
  }
  if (submission && !submission.correct) {
    return (
      <div style={{ marginBottom:"8px" }}>
        <IncorrectCard playerName={submission.playerName} year={submission.year} reason={submission.reason} onClick={()=>setShowStats(!showStats)} showingTop5={showStats} />
        {showStats && <Top5Panel validAnswers={row.validAnswers} scoringStatKey={scoringStat.key} scoringStatLabel={scoringStat.label} lowerIsBetter={scoringStat.lowerIsBetter} />}
      </div>
    );
  }
  return (
    <div style={{ marginBottom:"8px" }}>
      <div style={{ display:"flex",alignItems:"center",background:"#1a1d23",borderRadius:"12px",border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden" }}>
        {row.categories.map((cat,i) => (
          <div key={i} style={{ flex:1,padding:"12px 8px",display:"flex",alignItems:"center",justifyContent:"center",borderRight:i<2?"1px solid rgba(255,255,255,0.06)":"none" }}>
            <CategoryDisplay category={cat} />
          </div>
        ))}
        <button onClick={()=>onClickAdd(rowIndex)} style={{ padding:"16px 20px",background:"#22c55e",border:"none",color:"#fff",fontWeight:800,fontSize:"22px",cursor:"pointer",minWidth:"70px",alignSelf:"stretch",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2px" }}
          onMouseOver={e=>e.currentTarget.style.background="#16a34a"} onMouseOut={e=>e.currentTarget.style.background="#22c55e"}>
          <span>+</span><span style={{ fontSize:"9px",fontWeight:600,letterSpacing:"0.05em" }}>add player</span>
        </button>
      </div>
      {retryMode && wrongRowAttempts?.length > 0 && (
        <div style={{ display:"flex",gap:"6px",flexWrap:"wrap",padding:"5px 4px 0" }}>
          {wrongRowAttempts.map((a, idx) => (
            <span key={idx} style={{ fontSize:"11px",color:"rgba(239,68,68,0.7)",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",padding:"2px 8px",borderRadius:"4px" }}>
              ✗ {a.playerName} ({a.year})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// APP
// =====================================================================
export default function App() {
  const { raw, csvLoading, csvError } = useLahmanData();
  const [settings, setSettings] = useState({ startYear: 2008, endYear: 2025, minPA: 50 });

  // Re-filter instantly when settings change — no re-fetch
  const playerSeasons = useMemo(() =>
    raw ? buildPlayerSeasons(raw.people, raw.batting, raw.fielding, settings) : [],
    [raw, settings]
  );

  // Pitcher seasons — min 10 IP to exclude mop-up garbage appearances
  const pitcherSeasons = useMemo(() =>
    raw?.pitching ? buildPitcherSeasons(raw.people, raw.pitching, { ...settings, minIP: 10 }) : [],
    [raw, settings]
  );

  // Pinpoint needs career-accurate totals: include all stints regardless of PA
  // so short partial seasons (e.g. Ruiz's 2025 LAD cup with 4 SB in 23 PA)
  // aren't silently dropped from leaderboard aggregates.
  const pinpointSeasons = useMemo(() =>
    raw ? buildPlayerSeasons(raw.people, raw.batting, raw.fielding, { ...settings, minPA: 1 }) : [],
    [raw, settings]
  );
  const loading = csvLoading;

  const [puzzle, setPuzzle] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [wrongAttempts, setWrongAttempts] = useState({});
  const [retryMode, setRetryMode] = useState(false);
  const [activeRow, setActiveRow] = useState(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [activePage, setActivePage] = useState("statpad"); // "statpad" | "pinpoint"

  useEffect(() => {
    if (playerSeasons.length > 0) {
      setPuzzle(generatePuzzle(playerSeasons, pitcherSeasons, 5));
      setSubmissions({});
      setWrongAttempts({});
    }
  }, [playerSeasons, pitcherSeasons]);

  const totalScore = Object.values(submissions).reduce((s,sub) => s + (sub.correct ? sub.score : 0), 0);
  const totalGuesses = Object.keys(submissions).length
    + Object.values(wrongAttempts).reduce((s, arr) => s + arr.length, 0);

  const handlePlayerSelect = (playerName, year) => {
    if (activeRow === null || !puzzle) return;
    const row = puzzle.rows[activeRow];
    // Search the correct pool based on puzzle type (pitching vs. batting).
    // A player traded mid-season has multiple stints; pick the one satisfying
    // all row categories; fall back to the first if none do.
    const pool = puzzle.isPitcherPuzzle ? pitcherSeasons : playerSeasons;
    const allStints = pool.filter(p => p.name === playerName && p.year === year);
    const ps = allStints.find(s => row.categories.every(cat => matchesCategory(s, cat)))
            ?? allStints[0];
    if (!ps) {
      if (retryMode) {
        setWrongAttempts(prev => ({...prev, [activeRow]: [...(prev[activeRow]||[]), { playerName, year }]}));
      } else {
        setSubmissions(prev => ({...prev, [activeRow]: { playerName, year, correct:false, reason:"Player/year not found", score:0 }}));
      }
      setActiveRow(null); return;
    }
    const failedCats = row.categories.filter(cat => !matchesCategory(ps, cat));
    if (failedCats.length > 0) {
      if (retryMode) {
        setWrongAttempts(prev => ({...prev, [activeRow]: [...(prev[activeRow]||[]), { playerName, year }]}));
      } else {
        setSubmissions(prev => ({...prev, [activeRow]: { playerName, year, correct:false, reason:`Does not match: ${failedCats.map(c=>c.label).join(", ")}`, score:0 }}));
      }
      setActiveRow(null); return;
    }
    const score = ps[puzzle.scoringStat.key] || 0;
    setSubmissions(prev => ({...prev, [activeRow]: { playerName, year, team:ps.team, correct:true, score }}));
    setActiveRow(null);
  };

  const newGame = () => { setPuzzle(generatePuzzle(playerSeasons, pitcherSeasons, 5)); setSubmissions({}); setWrongAttempts({}); };

  if (csvError) return <div style={{ minHeight:"100vh",background:"#111318",color:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui",padding:"24px",textAlign:"center" }}>Failed to load Lahman CSVs: {csvError}<br/><span style={{color:"rgba(255,255,255,0.4)",fontSize:"13px"}}>Ensure public/lahman-folder/ contains People.csv, Batting.csv, Fielding.csv</span></div>;
  if (loading) return <div style={{ minHeight:"100vh",background:"#111318",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui" }}>Parsing Lahman database…</div>;
  if (!puzzle && activePage === "statpad") return null;

  return (
    <div style={{ minHeight:"100vh",background:"#111318",color:"#fff",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ maxWidth:"560px",margin:"0 auto",padding:"20px 16px" }}>
        {/* Title + Tab Bar */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px" }}>
          <div style={{ fontSize:"20px",fontWeight:800,letterSpacing:"-0.02em" }}>Baseball Games</div>
          <div style={{ display:"flex",gap:"4px",background:"rgba(255,255,255,0.05)",borderRadius:"10px",padding:"4px" }}>
            <button
              onClick={() => setActivePage("statpad")}
              style={{
                padding:"6px 16px",borderRadius:"7px",border:"none",cursor:"pointer",
                fontSize:"13px",fontWeight:700,
                background: activePage === "statpad" ? "rgba(255,255,255,0.12)" : "transparent",
                color: activePage === "statpad" ? "#fff" : "rgba(255,255,255,0.4)",
              }}
            >StatPad</button>
            <button
              onClick={() => setActivePage("pinpoint")}
              style={{
                padding:"6px 16px",borderRadius:"7px",border:"none",cursor:"pointer",
                fontSize:"13px",fontWeight:700,
                background: activePage === "pinpoint" ? "rgba(255,255,255,0.12)" : "transparent",
                color: activePage === "pinpoint" ? "#fff" : "rgba(255,255,255,0.4)",
              }}
            >Pinpoint</button>
          </div>
        </div>

        <DataFilterPanel
          settings={settings}
          onChange={setSettings}
          recordCount={playerSeasons.length}
        />

        {activePage === "statpad" ? (
          <>
            {/* Score Header */}
            <div style={{ display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"16px 0",marginBottom:"12px" }}>
              <div>
                <div style={{ fontSize:"36px",fontWeight:900,lineHeight:1 }}>{puzzle.scoringStat.label}</div>
                <div style={{ fontSize:"11px",color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",marginTop:"2px" }}>CATEGORY</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"42px",fontWeight:900,lineHeight:1 }}>{typeof totalScore==="number"&&totalScore%1!==0?totalScore.toFixed(1):totalScore}</div>
                <div style={{ fontSize:"11px",color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",marginTop:"2px" }}>TOTAL SCORE</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"42px",fontWeight:900,lineHeight:1 }}>{totalGuesses}</div>
                <div style={{ fontSize:"11px",color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",marginTop:"2px" }}>TOTAL GUESSES</div>
              </div>
            </div>

            <div style={{ height:"1px",background:"rgba(255,255,255,0.08)",marginBottom:"12px" }} />

            {puzzle.rows.map((row,i) => (
              <PuzzleRow key={`${puzzle.id}-${i}`} row={row} rowIndex={i} scoringStat={puzzle.scoringStat} submission={submissions[i]} allRows={puzzle.rows} playerSeasons={playerSeasons} pitcherSeasons={pitcherSeasons} isPitcherPuzzle={puzzle.isPitcherPuzzle} onClickAdd={setActiveRow} retryMode={retryMode} wrongRowAttempts={wrongAttempts[i]} />
            ))}

            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:"12px",marginTop:"24px",paddingBottom:"24px",flexWrap:"wrap" }}>
              <button onClick={newGame} style={{ padding:"10px 24px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"#fff",fontSize:"13px",fontWeight:600,cursor:"pointer" }}>New Game</button>
              <button onClick={()=>setRetryMode(r=>!r)} style={{ padding:"10px 20px",borderRadius:"8px",border:`1px solid ${retryMode?"rgba(34,197,94,0.5)":"rgba(255,255,255,0.15)"}`,background:retryMode?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.05)",color:retryMode?"#22c55e":"rgba(255,255,255,0.5)",fontSize:"13px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:"6px" }}>
                <span style={{ width:"14px",height:"14px",borderRadius:"50%",background:retryMode?"#22c55e":"rgba(255,255,255,0.2)",display:"inline-block",flexShrink:0 }} />
                Retries {retryMode?"ON":"OFF"}
              </button>
              <button onClick={()=>setShowHowTo(!showHowTo)} style={{ padding:"10px 20px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",fontSize:"13px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:"6px" }}>
                <span style={{ width:"18px",height:"18px",borderRadius:"50%",border:"1.5px solid rgba(255,255,255,0.4)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:800 }}>?</span>HOW TO PLAY
              </button>
            </div>

            {showHowTo && (
              <div style={{ background:"rgba(255,255,255,0.03)",borderRadius:"12px",padding:"20px",border:"1px solid rgba(255,255,255,0.06)",fontSize:"13px",color:"rgba(255,255,255,0.6)",lineHeight:1.7,marginBottom:"24px" }}>
                <p style={{margin:"0 0 10px"}}>Each puzzle has a scoring stat and 5 rows. Each row has 3 filters a player-season must satisfy.</p>
                <p style={{margin:"0 0 10px"}}>Column 1 is always a team, division, or league. Column 2 is a year or year range. Column 3 is a player attribute (position, handedness, or stat threshold).</p>
                <p style={{margin:"0 0 10px"}}>Click + to search for a player, pick their year, and submit. If correct, that season's stat is your score.</p>
                <p style={{margin:"0"}}>Tiers: below 50th = no tier, 50-70th = bronze, 70-90th = silver, 90-95th = gold, 95-100th = platinum.</p>
              </div>
            )}

            <div style={{ textAlign:"center",fontSize:"10px",color:"rgba(255,255,255,0.15)",padding:"12px 0 24px" }}>
              {playerSeasons.length.toLocaleString()} player-seasons loaded
            </div>

            {activeRow !== null && (
              <PlayerSearchModal
                key={activeRow}
                seasons={puzzle.isPitcherPuzzle ? pitcherSeasons : playerSeasons}
                onSelect={handlePlayerSelect}
                onClose={()=>setActiveRow(null)}
              />
            )}
          </>
        ) : (
          <PinpointChallenge playerSeasons={pinpointSeasons} />
        )}
      </div>
    </div>
  );
}
