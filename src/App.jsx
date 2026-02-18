import { useState, useEffect, useRef, useMemo } from "react";
import { MLB_TEAMS, DIVISIONS, getTeamLogoUrl } from "./teams.js";
import {
  CATEGORY_TYPES, SCORING_STATS,
  matchesCategory, findMatchingSeasons,
  generatePuzzle, computePercentile, getTier,
} from "./engine.js";

// =====================================================================
// DATA LOADING
// =====================================================================
// Loads from /statpad_data.json in the public folder.
// To swap data: replace public/statpad_data.json with new data from
// generate_data_v5.py and restart the dev server.

function usePlayerData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/statpad_data.json")
      .then(r => r.json())
      .then(d => {
        // Compute XBH if missing
        d.forEach(ps => {
          if (ps.XBH == null) ps.XBH = (ps["2B"]||0) + (ps["3B"]||0) + (ps.HR||0);
        });
        setData(d);
        setLoading(false);
      })
      .catch(e => { console.error("Failed to load data:", e); setLoading(false); });
  }, []);
  return { data, loading };
}

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
    <img
      src={getTeamLogoUrl(team)}
      alt={info.name}
      style={{ width:size,height:size,objectFit:"contain",flexShrink:0 }}
      onError={() => setImgError(true)}
    />
  );
}

// -- Player Search Modal --
function PlayerSearchModal({ playerSeasons, onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const playerIndex = useMemo(() => {
    const map = {};
    playerSeasons.forEach(ps => {
      if (!map[ps.name]) map[ps.name] = { name:ps.name, minYear:ps.year, maxYear:ps.year };
      map[ps.name].minYear = Math.min(map[ps.name].minYear, ps.year);
      map[ps.name].maxYear = Math.max(map[ps.name].maxYear, ps.year);
    });
    return Object.values(map);
  }, [playerSeasons]);

  const allFiltered = query.length >= 2
    ? playerIndex.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : [];
  const filtered = allFiltered.slice(0, 15);

  const playerYears = selectedPlayer
    ? [...new Set(playerSeasons.filter(ps => ps.name === selectedPlayer).map(ps => ps.year))].sort((a,b)=>b-a)
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

function IncorrectCard({ playerName, year, reason }) {
  return (
    <div style={{ background:"rgba(239,68,68,0.1)",borderRadius:"12px",padding:"14px 18px",border:"1px solid rgba(239,68,68,0.3)",display:"flex",alignItems:"center",gap:"12px" }}>
      <div style={{ width:"36px",height:"36px",borderRadius:"50%",background:"rgba(239,68,68,0.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444",fontSize:"18px",fontWeight:800,flexShrink:0 }}>X</div>
      <div>
        <div style={{ color:"#fca5a5",fontWeight:700,fontSize:"15px" }}>{playerName} {year?`(${year})`:""}</div>
        <div style={{ color:"rgba(255,255,255,0.4)",fontSize:"12px",marginTop:"2px" }}>{reason}</div>
      </div>
    </div>
  );
}

function StatsPanel({ ps }) {
  if (!ps) return null;
  const stats = [["H",ps.H],["2B",ps["2B"]],["3B",ps["3B"]],["HR",ps.HR],["RBI",ps.RBI],["R",ps.R],["XBH",ps.XBH],["SB",ps.SB],["AVG",ps.AVG?.toFixed(3)],["OBP",ps.OBP?.toFixed(3)],["SLG",ps.SLG?.toFixed(3)],["OPS",ps.OPS?.toFixed(3)],["wRC+",ps["wRC+"]],["WAR",ps.WAR]];
  return (
    <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"1px",background:"rgba(255,255,255,0.05)",borderRadius:"8px",overflow:"hidden",marginTop:"8px" }}>
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
function Top5Panel({ validAnswers, scoringStatKey, scoringStatLabel }) {
  const top5 = [...validAnswers]
    .sort((a, b) => (b[scoringStatKey] || 0) - (a[scoringStatKey] || 0))
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
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",minWidth:"70px" }}>
        <div style={{ display:"flex",gap:"2px",flexWrap:"wrap",justifyContent:"center" }}>
          {category.teams.slice(0,3).map(t => <TeamLogo key={t} team={t} size={22} />)}
        </div>
        <span style={{ fontSize:"10px",color:"rgba(255,255,255,0.5)",fontWeight:600 }}>{category.label}</span>
      </div>
    );
  }
  if (type === CATEGORY_TYPES.LEAGUE) {
    // Show 3 team logos from that league
    const leagueTeams = Object.keys(MLB_TEAMS).filter(k=>MLB_TEAMS[k].league===category.value).slice(0,3);
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",minWidth:"70px" }}>
        <div style={{ display:"flex",gap:"2px" }}>{leagueTeams.map(t=><TeamLogo key={t} team={t} size={20} />)}</div>
        <span style={{ fontSize:"10px",color:"rgba(255,255,255,0.5)",fontWeight:600 }}>{category.label}</span>
      </div>
    );
  }
  if (type === CATEGORY_TYPES.ALL_TEAMS) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",minWidth:"70px" }}>
        <div style={{ width:44,height:44,borderRadius:"50%",background:"#1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.1)" }}>
          <span style={{ color:"#fff",fontSize:12,fontWeight:800 }}>MLB</span>
        </div>
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
  return (
    <div style={{ textAlign:"center",minWidth:"80px" }}>
      {topLabel && <div style={{ fontSize:"9px",color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",marginBottom:"2px" }}>{topLabel}</div>}
      <div style={{ fontSize:"16px",fontWeight:800,color:"#fff" }}>{category.label}</div>
      {type === CATEGORY_TYPES.STAT_THRESHOLD && (
        <div style={{ fontSize:"8px",color:"#f59e0b",fontWeight:700,letterSpacing:"0.08em",background:"rgba(245,158,11,0.15)",borderRadius:"3px",padding:"2px 6px",marginTop:"3px",display:"inline-block" }}>SAME SEASON</div>
      )}
    </div>
  );
}

// -- Puzzle Row --
function PuzzleRow({ row, rowIndex, scoringStat, submission, allRows, playerSeasons, onClickAdd, retryMode, wrongRowAttempts }) {
  const [showStats, setShowStats] = useState(false);
  const percentile = submission?.correct ? computePercentile(submission.score, scoringStat.key, allRows) : 0;
  const matchedSeason = submission?.correct ? playerSeasons.find(ps => ps.name===submission.playerName && ps.year===submission.year) : null;

  if (submission?.correct) {
    return (
      <div style={{ marginBottom:"8px" }}>
        <ResultCard playerName={submission.playerName} year={submission.year} team={submission.team} score={submission.score} statLabel={scoringStat.label} percentile={percentile} onClick={()=>setShowStats(!showStats)} />
        {showStats && matchedSeason && <StatsPanel ps={matchedSeason} />}
        {showStats && <Top5Panel validAnswers={row.validAnswers} scoringStatKey={scoringStat.key} scoringStatLabel={scoringStat.label} />}
      </div>
    );
  }
  if (submission && !submission.correct) {
    return <div style={{ marginBottom:"8px" }}><IncorrectCard playerName={submission.playerName} year={submission.year} reason={submission.reason} /></div>;
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
  const { data: playerSeasons, loading } = usePlayerData();
  const [puzzle, setPuzzle] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [wrongAttempts, setWrongAttempts] = useState({});
  const [retryMode, setRetryMode] = useState(false);
  const [activeRow, setActiveRow] = useState(null);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    if (playerSeasons.length > 0) setPuzzle(generatePuzzle(playerSeasons, 5));
  }, [playerSeasons]);

  const totalScore = Object.values(submissions).reduce((s,sub) => s + (sub.correct ? sub.score : 0), 0);
  const totalGuesses = Object.keys(submissions).length
    + Object.values(wrongAttempts).reduce((s, arr) => s + arr.length, 0);

  const handlePlayerSelect = (playerName, year) => {
    if (activeRow === null || !puzzle) return;
    const row = puzzle.rows[activeRow];
    const ps = playerSeasons.find(p => p.name === playerName && p.year === year);
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

  const newGame = () => { setPuzzle(generatePuzzle(playerSeasons, 5)); setSubmissions({}); setWrongAttempts({}); };

  if (loading) return <div style={{ minHeight:"100vh",background:"#111318",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui" }}>Loading data...</div>;
  if (!puzzle) return null;

  return (
    <div style={{ minHeight:"100vh",background:"#111318",color:"#fff",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ maxWidth:"560px",margin:"0 auto",padding:"20px 16px" }}>
        <div style={{ fontSize:"20px",fontWeight:800,letterSpacing:"-0.02em",marginBottom:"4px" }}>StatpadGame.com</div>

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
          <PuzzleRow key={`${puzzle.id}-${i}`} row={row} rowIndex={i} scoringStat={puzzle.scoringStat} submission={submissions[i]} allRows={puzzle.rows} playerSeasons={playerSeasons} onClickAdd={setActiveRow} retryMode={retryMode} wrongRowAttempts={wrongAttempts[i]} />
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
      </div>

      {activeRow !== null && (
        <PlayerSearchModal key={activeRow} playerSeasons={playerSeasons} onSelect={handlePlayerSelect} onClose={()=>setActiveRow(null)} />
      )}
    </div>
  );
}
