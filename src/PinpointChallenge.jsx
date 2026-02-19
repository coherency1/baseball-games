import { useState, useEffect, useRef, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DATA — derived directly from playerSeasons (no separate fetch needed)
// ─────────────────────────────────────────────────────────────────────────────
function buildLeaderboardsFromData(playerSeasons, topN = 150) {
  if (!playerSeasons.length) return [];

  const years = [...new Set(playerSeasons.map(p => p.year))].sort((a, b) => a - b);
  const era   = `${years[0]}–${years[years.length - 1]}`;

  const batters  = playerSeasons.filter(ps => ps.pos !== "P");
  const pitchers = playerSeasons.filter(ps => ps.pos === "P");

  function aggregate(seasons, statKeys) {
    const map = {};
    for (const ps of seasons) {
      if (!map[ps.name]) map[ps.name] = Object.fromEntries(statKeys.map(k => [k, 0]));
      for (const k of statKeys) map[ps.name][k] += ps[k] || 0;
    }
    return map;
  }

  const batMap = aggregate(batters,  ["HR","RBI","R","H","SB","BB","2B","3B","WAR"]);
  const pitMap = aggregate(pitchers, ["SO"]);

  function makeRanked(careerMap, stat, roundDec = 0) {
    const sorted = Object.entries(careerMap)
      .sort(([, a], [, b]) => b[stat] - a[stat])
      .slice(0, topN)
      .map(([name, s]) => ({
        name,
        value: roundDec ? Math.round(s[stat] * 10 ** roundDec) / 10 ** roundDec
                        : Math.round(s[stat]),
      }));

    // Competition ranking (1224): players with the same stat value share the same rank.
    // Ranks after a tied group skip accordingly (two at #1 → next is #3).
    let rank = 1;
    return sorted.map((entry, i) => {
      if (i > 0 && entry.value !== sorted[i - 1].value) rank = i + 1;
      return { rank, name: entry.name, value: entry.value };
    });
  }

  const cat = (id, label, stat, statType, careerMap, roundDec = 0) => ({
    id, label, era, stat, statLabel: stat, statType, minimum: null,
    players: makeRanked(careerMap, stat, roundDec),
  });

  return [
    cat("all_time_hr",       "Home Run Leaders",             "HR",  "batting",  batMap),
    cat("all_time_rbi",      "RBI Leaders",                  "RBI", "batting",  batMap),
    cat("all_time_hits",     "Hits Leaders",                 "H",   "batting",  batMap),
    cat("all_time_runs",     "Runs Scored Leaders",          "R",   "batting",  batMap),
    cat("all_time_bb_bat",   "Walks Leaders (Batters)",      "BB",  "batting",  batMap),
    cat("all_time_sb",       "Stolen Base Leaders",          "SB",  "batting",  batMap),
    cat("all_time_2b",       "Doubles Leaders",              "2B",  "batting",  batMap),
    cat("all_time_3b",       "Triples Leaders",              "3B",  "batting",  batMap),
    cat("all_time_war_bat",  "WAR Leaders (Batters)",        "WAR", "batting",  batMap, 1),
    cat("all_time_so_pitch", "Strikeout Leaders (Pitchers)", "SO",  "pitching", pitMap),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function pickRandomCategory(categories, excludeId = null) {
  const pool = categories.length > 1
    ? categories.filter(c => c.id !== excludeId)
    : categories;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildPlayerNamesByType(leaderboards) {
  const batting = new Set();
  const pitching = new Set();
  leaderboards.forEach(cat => {
    const target = cat.statType === "pitching" ? pitching : batting;
    cat.players.forEach(p => target.add(p.name));
  });
  return {
    batting:  Array.from(batting).sort(),
    pitching: Array.from(pitching).sort(),
  };
}

function getSuggestions(allNames, query) {
  if (query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  const scored = allNames
    .filter(name => {
      const n = name.toLowerCase();
      if (n.startsWith(q)) return true;
      if (n.includes(q)) return true;
      const parts = n.split(" ");
      return parts.length > 1 && parts[parts.length - 1].startsWith(q);
    })
    .map(name => {
      const n = name.toLowerCase();
      const score = n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2;
      return { name, score };
    })
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return scored.slice(0, 8).map(s => s.name);
}

function formatValue(value, statLabel) {
  if (typeof value !== "number") return String(value);
  const rateStats = ["ERA", "WHIP", "K/9", "BB/9", "AVG", "OBP", "SLG", "OPS", "wRC+", "WAR"];
  if (rateStats.some(r => statLabel && statLabel.includes(r))) {
    return value % 1 !== 0 ? value.toFixed(1) : String(value);
  }
  return value.toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StrikeIndicators({ strikes, max = 3 }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ fontSize: "20px", opacity: i < strikes ? 1 : 0.22 }}>
          {i < strikes ? "🔴" : "⚾"}
        </span>
      ))}
    </div>
  );
}

function CategoryChip({ category }) {
  if (!category) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span style={{
        fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
        background: "rgba(245,158,11,0.15)", color: "#f59e0b",
        border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: "4px", padding: "3px 8px",
      }}>
        {category.era || "ALL-TIME"}
      </span>
      <span style={{ fontSize: "17px", fontWeight: 900, color: "#fff", letterSpacing: "-0.01em" }}>
        {category.label}
      </span>
      {category.minimum && (
        <span style={{
          fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 600,
          background: "rgba(255,255,255,0.06)", borderRadius: "4px", padding: "3px 8px",
        }}>
          {category.minimum}
        </span>
      )}
    </div>
  );
}

function CorrectCard({ guess, statLabel }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      background: "rgba(34,197,94,0.08)",
      border: "1px solid rgba(34,197,94,0.22)",
      borderRadius: "10px", padding: "11px 14px",
    }}>
      <div style={{
        width: "42px", height: "42px", borderRadius: "50%", flexShrink: 0,
        background: "rgba(34,197,94,0.14)", border: "2px solid rgba(34,197,94,0.38)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "13px", fontWeight: 900, color: "#22c55e",
      }}>
        #{guess.rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "15px", fontWeight: 700, color: "#fff",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {guess.name}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>
          +{guess.rank} pts
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "18px", fontWeight: 900, color: "#22c55e" }}>
          {formatValue(guess.value, statLabel)}
        </div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", letterSpacing: "0.05em" }}>
          {statLabel}
        </div>
      </div>
    </div>
  );
}

function FeaturedGuessCard({ guess, statLabel }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "14px",
      background: "rgba(34,197,94,0.12)",
      border: "1px solid rgba(34,197,94,0.38)",
      borderRadius: "12px", padding: "16px 18px",
      boxShadow: "0 0 24px rgba(34,197,94,0.1)",
    }}>
      <div style={{
        width: "56px", height: "56px", borderRadius: "50%", flexShrink: 0,
        background: "rgba(34,197,94,0.18)", border: "2px solid rgba(34,197,94,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "14px", fontWeight: 900, color: "#22c55e",
      }}>
        #{guess.rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em", marginBottom: "3px" }}>
          LAST GUESS
        </div>
        <div style={{
          fontSize: "18px", fontWeight: 900, color: "#fff",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {guess.name}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
          +{guess.rank} pts
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "24px", fontWeight: 900, color: "#22c55e" }}>
          {formatValue(guess.value, statLabel)}
        </div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", letterSpacing: "0.05em" }}>
          {statLabel}
        </div>
      </div>
    </div>
  );
}

function NearMissCard({ guess, statLabel }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      background: "rgba(245,158,11,0.07)",
      border: "1px solid rgba(245,158,11,0.22)",
      borderRadius: "10px", padding: "11px 14px",
    }}>
      <div style={{
        width: "42px", height: "42px", borderRadius: "50%", flexShrink: 0,
        background: "rgba(245,158,11,0.14)", border: "2px solid rgba(245,158,11,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", fontWeight: 900, color: "#f59e0b",
      }}>
        #{guess.rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "15px", fontWeight: 700, color: "#fcd34d",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {guess.name}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>
          outside top 100
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "18px", fontWeight: 900, color: "#f59e0b" }}>
          {formatValue(guess.value, statLabel)}
        </div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", letterSpacing: "0.05em" }}>
          {statLabel}
        </div>
      </div>
    </div>
  );
}

function StrikeCard({ guess }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      background: "rgba(239,68,68,0.07)",
      border: "1px solid rgba(239,68,68,0.22)",
      borderRadius: "10px", padding: "11px 14px",
    }}>
      <div style={{
        width: "42px", height: "42px", borderRadius: "50%", flexShrink: 0,
        background: "rgba(239,68,68,0.14)", border: "2px solid rgba(239,68,68,0.28)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "16px", color: "#ef4444", fontWeight: 800,
      }}>
        ✕
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "15px", fontWeight: 700, color: "#fca5a5",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {guess.name}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>
          not in top 150
        </div>
      </div>
    </div>
  );
}

function AutocompleteInput({ query, suggestions, onQueryChange, onSelect, disabled }) {
  const inputRef = useRef(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  useEffect(() => setHighlightIdx(-1), [suggestions]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        onSelect(suggestions[highlightIdx]);
      } else if (suggestions.length === 1) {
        onSelect(suggestions[0]);
      } else if (query.trim()) {
        // allow submitting free text even if not in suggestions
        onSelect(query.trim());
      }
    } else if (e.key === "Escape") {
      onQueryChange("");
    }
  };

  const canGuess = !disabled && query.trim().length >= 2;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a player name..."
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            flex: 1, padding: "12px 16px", borderRadius: "10px",
            border: "2px solid rgba(100,160,255,0.35)",
            background: disabled ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.35)",
            color: disabled ? "rgba(255,255,255,0.25)" : "#fff",
            fontSize: "16px", outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => {
            if (!canGuess) return;
            if (highlightIdx >= 0 && suggestions[highlightIdx]) {
              onSelect(suggestions[highlightIdx]);
            } else if (suggestions.length > 0) {
              onSelect(suggestions[0]);
            } else {
              onSelect(query.trim());
            }
          }}
          disabled={!canGuess}
          style={{
            padding: "12px 20px", borderRadius: "10px", border: "none", cursor: canGuess ? "pointer" : "default",
            background: canGuess ? "#3b82f6" : "rgba(255,255,255,0.07)",
            color: canGuess ? "#fff" : "rgba(255,255,255,0.25)",
            fontSize: "14px", fontWeight: 700, flexShrink: 0, transition: "background 0.15s",
          }}
        >
          Guess
        </button>
      </div>

      {suggestions.length > 0 && !disabled && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: "#1a1d23", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px", overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {suggestions.map((name, idx) => (
            <div
              key={name}
              onMouseDown={() => onSelect(name)}
              onMouseEnter={() => setHighlightIdx(idx)}
              style={{
                padding: "11px 16px", cursor: "pointer", fontSize: "15px",
                color: highlightIdx === idx ? "#fff" : "rgba(255,255,255,0.75)",
                background: highlightIdx === idx ? "rgba(59,130,246,0.22)" : "transparent",
                borderBottom: idx < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GameOverCard({ guesses, strikes, score, onPlayAgain }) {
  const correctCount = guesses.filter(g => !g.isStrike).length;
  const bestRank = guesses
    .filter(g => !g.isStrike)
    .reduce((best, g) => (g.rank > best ? g.rank : best), 0);

  return (
    <div style={{
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      borderRadius: "16px", padding: "28px 24px",
      border: "1px solid rgba(255,255,255,0.1)",
      textAlign: "center", marginBottom: "20px",
    }}>
      <div style={{ fontSize: "36px", marginBottom: "6px" }}>⚾</div>
      <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff", marginBottom: "4px" }}>
        Game Over
      </div>
      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginBottom: "22px" }}>
        {strikes} strike{strikes !== 1 ? "s" : ""} used
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "36px", marginBottom: "26px" }}>
        <div>
          <div style={{ fontSize: "38px", fontWeight: 900, color: "#3b82f6", lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginTop: "4px" }}>TOTAL SCORE</div>
        </div>
        <div>
          <div style={{ fontSize: "38px", fontWeight: 900, color: "#22c55e", lineHeight: 1 }}>{correctCount}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginTop: "4px" }}>CORRECT</div>
        </div>
        <div>
          <div style={{ fontSize: "38px", fontWeight: 900, color: "#f59e0b", lineHeight: 1 }}>{bestRank || "—"}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginTop: "4px" }}>BEST RANK</div>
        </div>
      </div>

      <button
        onClick={onPlayAgain}
        style={{
          padding: "12px 36px", borderRadius: "10px", border: "none", cursor: "pointer",
          background: "#3b82f6", color: "#fff", fontSize: "15px", fontWeight: 700,
        }}
      >
        Play Again
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PinpointChallenge({ playerSeasons = [] }) {
  const leaderboards     = useMemo(() => buildLeaderboardsFromData(playerSeasons), [playerSeasons]);
  const playerNamesByType = useMemo(() => buildPlayerNamesByType(leaderboards), [leaderboards]);

  const [category, setCategory]         = useState(null);
  const [lastCategoryId, setLastCatId]  = useState(null);
  const [guesses, setGuesses]           = useState([]);
  const [strikes, setStrikes]           = useState(0);
  const [score, setScore]               = useState(0);
  const [gameOver, setGameOver]         = useState(false);
  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState([]);
  const [dupFlash, setDupFlash]         = useState(false);

  const MAX_STRIKES = 3;

  // Ref always holds the current category id so the leaderboards effect
  // can read it without stale-closure issues.
  const currentCatIdRef = useRef(null);

  const changeCategory = (cat) => {
    currentCatIdRef.current = cat.id;
    setCategory(cat);
    setLastCatId(cat.id);
  };

  // On initial data load: pick random category.
  // On filter change (leaderboards rebuilt): always pick a NEW random category
  // (excluding the current one) so the full player-pool reload is obvious to the user.
  useEffect(() => {
    if (leaderboards.length === 0) return;
    const prevId = currentCatIdRef.current;
    const cat = pickRandomCategory(leaderboards, prevId ?? undefined);
    changeCategory(cat);
    if (prevId) {
      setGuesses([]);
      setStrikes(0);
      setScore(0);
      setGameOver(false);
      setQuery("");
      setSuggestions([]);
    }
  }, [leaderboards]);

  // Autocomplete suggestions — scoped to the current category's statType
  useEffect(() => {
    const names = category?.statType === "pitching"
      ? playerNamesByType.pitching
      : playerNamesByType.batting;
    setSuggestions(getSuggestions(names, query));
  }, [query, playerNamesByType, category]);

  const guessedNames = useMemo(
    () => new Set(guesses.map(g => g.name.toLowerCase())),
    [guesses]
  );

  const handleGuess = (playerName) => {
    if (!playerName || !playerName.trim() || !category || gameOver) return;
    const name = playerName.trim();

    // Duplicate guard
    if (guessedNames.has(name.toLowerCase())) {
      setQuery("");
      setSuggestions([]);
      setDupFlash(true);
      setTimeout(() => setDupFlash(false), 1200);
      return;
    }

    setQuery("");
    setSuggestions([]);

    // Lookup in current category (case-insensitive)
    const match = category.players.find(
      p => p.name.toLowerCase() === name.toLowerCase()
    );

    if (match && match.rank <= 100) {
      // Correct — adds rank to score
      setGuesses(prev => [...prev, {
        name: match.name,
        rank: match.rank,
        value: match.value,
        isStrike: false,
        isNearMiss: false,
      }]);
      setScore(prev => prev + match.rank);
    } else if (match && match.rank > 100) {
      // Near-miss (rank 101–150) — strike, but shows rank + value
      const newStrikes = strikes + 1;
      setGuesses(prev => [...prev, {
        name: match.name,
        rank: match.rank,
        value: match.value,
        isStrike: true,
        isNearMiss: true,
      }]);
      setStrikes(newStrikes);
      if (newStrikes >= MAX_STRIKES) setGameOver(true);
    } else {
      // Not in top 150 — full strike
      const newStrikes = strikes + 1;
      setGuesses(prev => [...prev, { name, rank: null, value: null, isStrike: true, isNearMiss: false }]);
      setStrikes(newStrikes);
      if (newStrikes >= MAX_STRIKES) setGameOver(true);
    }
  };

  const handlePlayAgain = () => {
    const cat = pickRandomCategory(leaderboards, lastCategoryId);
    changeCategory(cat);
    setGuesses([]);
    setStrikes(0);
    setScore(0);
    setGameOver(false);
    setQuery("");
    setSuggestions([]);
    setDupFlash(false);
  };

  if (!category) return null;

  const correctGuesses  = guesses.filter(g => !g.isStrike);
  const strikeGuesses   = guesses.filter(g => g.isStrike);
  const sortedCorrect   = [...correctGuesses].sort((a, b) => a.rank - b.rank);
  const lastCorrectGuess = correctGuesses.length > 0 ? correctGuesses[correctGuesses.length - 1] : null;

  return (
    <div style={{ paddingBottom: "48px" }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: "14px", gap: "12px",
      }}>
        <CategoryChip category={category} />
        <button
          onClick={handlePlayAgain}
          style={{
            padding: "7px 14px", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.13)",
            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)",
            fontSize: "12px", fontWeight: 600, cursor: "pointer", flexShrink: 0,
          }}
        >
          New Game
        </button>
      </div>

      {/* ── SCORE BAR ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.04)", borderRadius: "12px",
        padding: "14px 18px", marginBottom: "16px",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div>
          <div style={{ fontSize: "30px", fontWeight: 900, lineHeight: 1, color: "#3b82f6" }}>
            {score}
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", letterSpacing: "0.1em", marginTop: "3px" }}>
            TOTAL SCORE
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "30px", fontWeight: 900, lineHeight: 1, color: "#22c55e" }}>
            {correctGuesses.length}
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", letterSpacing: "0.1em", marginTop: "3px" }}>
            CORRECT
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <StrikeIndicators strikes={strikes} max={MAX_STRIKES} />
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", letterSpacing: "0.1em", marginTop: "5px" }}>
            STRIKES
          </div>
        </div>
      </div>

      {/* ── GAME OVER ── */}
      {gameOver && (
        <GameOverCard
          guesses={guesses}
          strikes={strikes}
          score={score}
          onPlayAgain={handlePlayAgain}
        />
      )}

      {/* ── INPUT ── */}
      {!gameOver && (
        <div style={{ marginBottom: "20px" }}>
          <AutocompleteInput
            query={query}
            suggestions={suggestions}
            onQueryChange={setQuery}
            onSelect={handleGuess}
            disabled={gameOver}
          />
          {dupFlash && (
            <div style={{
              marginTop: "8px", textAlign: "center",
              fontSize: "12px", color: "#f59e0b",
            }}>
              Already guessed!
            </div>
          )}
          {!dupFlash && (
            <div style={{
              marginTop: "8px", textAlign: "center",
              fontSize: "11px", color: "rgba(255,255,255,0.2)",
            }}>
              Rank 100 = 100 pts · ranks 101–150 are strikes · target borderline top-100 players
            </div>
          )}
        </div>
      )}

      {/* ── CORRECT GUESSES BOARD ── */}
      {lastCorrectGuess && (
        <div style={{ marginBottom: "4px" }}>
          <FeaturedGuessCard guess={lastCorrectGuess} statLabel={category.statLabel} />
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "14px 0" }} />
          <div style={{
            fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.22)",
            letterSpacing: "0.1em", padding: "4px 0 10px",
          }}>
            IN THE TOP 100
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {sortedCorrect.map(g => (
              <CorrectCard key={g.name} guess={g} statLabel={category.statLabel} />
            ))}
          </div>
        </div>
      )}

      {/* ── STRIKE BOARD ── */}
      {strikeGuesses.length > 0 && (
        <div style={{ marginTop: sortedCorrect.length > 0 ? "12px" : "4px" }}>
          <div style={{
            fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.22)",
            letterSpacing: "0.1em", padding: "4px 0 10px",
          }}>
            WRONG GUESSES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {strikeGuesses.map((g, i) => (
              g.isNearMiss
                ? <NearMissCard key={`${g.name}-${i}`} guess={g} statLabel={category.statLabel} />
                : <StrikeCard key={`${g.name}-${i}`} guess={g} />
            ))}
          </div>
        </div>
      )}

      {/* ── HOW TO PLAY ── */}
      <div style={{
        marginTop: "30px", background: "rgba(255,255,255,0.02)", borderRadius: "12px",
        padding: "16px 18px", border: "1px solid rgba(255,255,255,0.05)",
        fontSize: "12px", color: "rgba(255,255,255,0.38)", lineHeight: 1.75,
      }}>
        <strong style={{ color: "rgba(255,255,255,0.55)" }}>How to Play</strong><br />
        Name MLB players who appear in the top 100 for this all-time stat category. Each correct guess scores points equal to that player's rank — rank 100 is worth the most (100 pts). Players ranked 101–150 count as strikes but reveal their rank and stat value. Target borderline players close to rank 100 for maximum score. Three strikes ends the game.
      </div>

    </div>
  );
}
