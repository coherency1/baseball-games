import { describe, it, expect } from "vitest";
import { buildLeaderboardsFromData } from "../PinpointChallenge.jsx";

describe("buildLeaderboardsFromData", () => {
  it("keeps players with same full name separate by playerID", () => {
    const seasons = [
      { playerID: "gwynnto01", name: "Tony Gwynn", year: 1984, pos: "OF", H: 3141, HR: 0, RBI: 0, R: 0, SB: 0, BB: 0, "2B": 0, "3B": 0, WAR: 0 },
      { playerID: "gwynnto02", name: "Tony Gwynn", year: 2000, pos: "OF", H: 381, HR: 0, RBI: 0, R: 0, SB: 0, BB: 0, "2B": 0, "3B": 0, WAR: 0 },
      { playerID: "other01", name: "Other Player", year: 2001, pos: "OF", H: 3500, HR: 0, RBI: 0, R: 0, SB: 0, BB: 0, "2B": 0, "3B": 0, WAR: 0 },
    ];

    const categories = buildLeaderboardsFromData(seasons, 10);
    const hits = categories.find(c => c.id === "all_time_hits");
    expect(hits).toBeTruthy();

    const gwynns = hits.players.filter(p => p.name === "Tony Gwynn");
    expect(gwynns).toHaveLength(2);
    expect(gwynns.map(g => g.value).sort((a, b) => a - b)).toEqual([381, 3141]);
  });
});
