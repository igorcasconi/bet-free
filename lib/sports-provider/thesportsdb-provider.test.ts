import { afterEach, describe, expect, it, vi } from "vitest";

import { TheSportsDBProvider } from "@/lib/sports-provider/thesportsdb-provider";
import { SportsProviderError } from "@/lib/sports-provider/types";

function mockFetchJson(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

function makeProvider(): TheSportsDBProvider {
  return new TheSportsDBProvider("test-key", "4328,4335");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syncCompetitions", () => {
  it("filters by configured league ids and normalizes to ProviderCompetition", async () => {
    mockFetchJson({
      leagues: [
        {
          idLeague: "4328",
          strLeague: "English Premier League",
          strCurrentSeason: "2023/2024",
          strLogo: "https://example.com/logo.png",
        },
        {
          idLeague: "9999",
          strLeague: "Not Configured League",
          strCurrentSeason: "2023/2024",
          strLogo: null,
        },
      ],
    });

    const result = await makeProvider().syncCompetitions();

    expect(result).toEqual([
      {
        externalId: "4328",
        name: "English Premier League",
        slug: "english-premier-league",
        season: "2023/2024",
        logoUrl: "https://example.com/logo.png",
      },
    ]);
  });
});

describe("syncTeams", () => {
  it("returns normalized ProviderTeam[] for a competition", async () => {
    mockFetchJson({
      teams: [
        {
          idTeam: "133604",
          strTeam: "Manchester United",
          strTeamBadge: "https://example.com/badge.png",
        },
      ],
    });

    const result = await makeProvider().syncTeams("4328");

    expect(result).toEqual([
      {
        externalId: "133604",
        name: "Manchester United",
        slug: "manchester-united",
        logoUrl: "https://example.com/badge.png",
      },
    ]);
  });

  it("returns an empty array when the API returns teams: null", async () => {
    mockFetchJson({ teams: null });

    const result = await makeProvider().syncTeams("4328");

    expect(result).toEqual([]);
  });
});

describe("syncMatches", () => {
  it("returns normalized ProviderMatch[] with ISO 8601 matchDate", async () => {
    mockFetchJson({
      events: [
        {
          idEvent: "441613",
          idLeague: "4328",
          idHomeTeam: "133602",
          idAwayTeam: "133604",
          dateEvent: "2024-01-30",
          strTime: "15:00:00",
          strStatus: "Not Started",
          intRound: "24",
          intHomeScore: null,
          intAwayScore: null,
        },
      ],
    });

    const result = await makeProvider().syncMatches("4328", "2023-2024");

    expect(result).toEqual([
      {
        externalId: "441613",
        externalCompetitionId: "4328",
        externalHomeTeamId: "133602",
        externalAwayTeamId: "133604",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "scheduled",
        homeScore: null,
        awayScore: null,
      },
    ]);
  });
});

describe("updateLiveMatches", () => {
  it("returns normalized ProviderMatch[] for today's fixtures", async () => {
    mockFetchJson({
      events: [
        {
          idEvent: "441614",
          idLeague: "4328",
          idHomeTeam: "133602",
          idAwayTeam: "133604",
          dateEvent: "2024-01-30",
          strTime: "15:00:00",
          strStatus: "1H",
          intRound: "24",
          intHomeScore: "1",
          intAwayScore: "0",
        },
      ],
    });

    const result = await makeProvider().updateLiveMatches();

    expect(result).toEqual([
      expect.objectContaining({
        externalId: "441614",
        status: "live",
        homeScore: 1,
        awayScore: 0,
      }),
    ]);
  });
});

describe("updateFinishedMatches", () => {
  it("returns normalized ProviderMatch[] for a competition's past events", async () => {
    mockFetchJson({
      events: [
        {
          idEvent: "441615",
          idLeague: "4328",
          idHomeTeam: "133602",
          idAwayTeam: "133604",
          dateEvent: "2024-01-30",
          strTime: "15:00:00",
          strStatus: "Match Finished",
          intRound: "24",
          intHomeScore: "2",
          intAwayScore: "1",
        },
      ],
    });

    const result = await makeProvider().updateFinishedMatches("4328");

    expect(result).toEqual([
      {
        externalId: "441615",
        externalCompetitionId: "4328",
        externalHomeTeamId: "133602",
        externalAwayTeamId: "133604",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "finished",
        homeScore: 2,
        awayScore: 1,
      },
    ]);
  });

  it("throws SportsProviderError when the response shape fails Zod validation", async () => {
    mockFetchJson({ unexpected: "shape" });

    await expect(makeProvider().updateFinishedMatches("4328")).rejects.toThrow(
      SportsProviderError,
    );
  });

  it("throws SportsProviderError immediately on network failure, without retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(makeProvider().updateFinishedMatches("4328")).rejects.toThrow(
      SportsProviderError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("status mapping", () => {
  it.each([
    ["Not Started", "scheduled"],
    ["1H", "live"],
    ["2H", "live"],
    ["HT", "live"],
    ["ET", "live"],
    ["Live", "live"],
    ["Match Finished", "finished"],
    ["FT", "finished"],
    ["AET", "finished"],
    ["Awarded", "finished"],
    ["Postponed", "postponed"],
    ["Cancelled", "cancelled"],
    ["Abandoned", "cancelled"],
  ] as const)("maps strStatus %s to %s", async (raw, expected) => {
    mockFetchJson({
      events: [
        {
          idEvent: "1",
          idLeague: "4328",
          idHomeTeam: "1",
          idAwayTeam: "2",
          dateEvent: "2024-01-30",
          strTime: "15:00:00",
          strStatus: raw,
          intRound: null,
          intHomeScore: null,
          intAwayScore: null,
        },
      ],
    });

    const [match] = await makeProvider().syncMatches("4328", "2023-2024");

    expect(match.status).toBe(expected);
  });

  it("throws SportsProviderError for an unmapped status value", async () => {
    mockFetchJson({
      events: [
        {
          idEvent: "1",
          idLeague: "4328",
          idHomeTeam: "1",
          idAwayTeam: "2",
          dateEvent: "2024-01-30",
          strTime: "15:00:00",
          strStatus: "Some Unknown Status",
          intRound: null,
          intHomeScore: null,
          intAwayScore: null,
        },
      ],
    });

    await expect(
      makeProvider().syncMatches("4328", "2023-2024"),
    ).rejects.toThrow(SportsProviderError);
  });
});

describe("error handling", () => {
  it("throws SportsProviderError when the response shape fails Zod validation", async () => {
    mockFetchJson({ unexpected: "shape" });

    await expect(makeProvider().syncCompetitions()).rejects.toThrow(
      SportsProviderError,
    );
  });

  it("throws SportsProviderError immediately on network failure, without retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(makeProvider().syncCompetitions()).rejects.toThrow(
      SportsProviderError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws SportsProviderError on non-ok HTTP response", async () => {
    mockFetchJson({}, false, 500);

    await expect(makeProvider().syncCompetitions()).rejects.toThrow(
      SportsProviderError,
    );
  });
});
