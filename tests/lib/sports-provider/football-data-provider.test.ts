import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FootballDataProvider } from "@/lib/sports-provider/football-data-provider";
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

function mockFetchJsonPerUrl(responses: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[url]),
      }),
    ),
  );
}

function makeProvider(): FootballDataProvider {
  return new FootballDataProvider("test-key", "2152,2154");
}

function makeSingleLeagueProvider(): FootballDataProvider {
  return new FootballDataProvider("test-key", "2152");
}

function matchFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    competition: { id: 2152 },
    homeTeam: { id: 10 },
    awayTeam: { id: 20 },
    utcDate: "2026-03-10T21:00:00Z",
    matchday: 5,
    status: "SCHEDULED",
    score: { fullTime: { home: null, away: null } },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syncCompetitions", () => {
  it("calls GET /competitions/:id per configured id with X-Auth-Token and accumulates results", async () => {
    vi.useFakeTimers();
    mockFetchJsonPerUrl({
      "https://api.football-data.org/v4/competitions/2152": {
        id: 2152,
        name: "Copa Libertadores",
        currentSeason: { startDate: "2026-02-04" },
        emblem: "https://example.com/lib.png",
      },
      "https://api.football-data.org/v4/competitions/2154": {
        id: 2154,
        name: "Copa Sudamericana",
        currentSeason: null,
        emblem: null,
      },
    });

    const resultPromise = makeProvider().syncCompetitions();
    await vi.advanceTimersByTimeAsync(6500);
    const result = await resultPromise;
    vi.useRealTimers();

    expect(result).toEqual(
      expect.arrayContaining([
        {
          externalId: "2152",
          name: "Copa Libertadores",
          slug: "copa-libertadores",
          season: "2026",
          logoUrl: "https://example.com/lib.png",
        },
        {
          externalId: "2154",
          name: "Copa Sudamericana",
          slug: "copa-sudamericana",
          season: "",
          logoUrl: null,
        },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it("sends X-Auth-Token header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 2152,
          name: "Copa Libertadores",
          currentSeason: { startDate: "2026-02-04" },
          emblem: null,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await makeSingleLeagueProvider().syncCompetitions();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.football-data.org/v4/competitions/2152",
      { headers: { "X-Auth-Token": "test-key" } },
    );
  });
});

describe("syncTeams", () => {
  it("calls GET /competitions/:id/teams and returns normalized ProviderTeam[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          teams: [
            {
              id: 10,
              name: "River Plate",
              crest: "https://example.com/river.png",
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeSingleLeagueProvider().syncTeams("2152");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.football-data.org/v4/competitions/2152/teams",
      { headers: { "X-Auth-Token": "test-key" } },
    );
    expect(result).toEqual([
      {
        externalId: "10",
        name: "River Plate",
        slug: "river-plate",
        logoUrl: "https://example.com/river.png",
      },
    ]);
  });
});

describe("syncMatches", () => {
  it("calls GET /competitions/:id/matches?season={season} and returns normalized ProviderMatch[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ matches: [matchFixture()] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeSingleLeagueProvider().syncMatches("2152", "2026");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.football-data.org/v4/competitions/2152/matches?season=2026",
      { headers: { "X-Auth-Token": "test-key" } },
    );
    expect(result).toEqual([
      {
        externalId: "1",
        externalCompetitionId: "2152",
        externalHomeTeamId: "10",
        externalAwayTeamId: "20",
        matchDate: "2026-03-10T21:00:00Z",
        round: "5",
        status: "scheduled",
        homeScore: null,
        awayScore: null,
      },
    ]);
  });
});

describe("updateLiveMatches", () => {
  it("calls GET /matches?status=LIVE and filters to configured league ids", async () => {
    mockFetchJson({
      matches: [
        matchFixture({ id: 1, competition: { id: 2152 }, status: "IN_PLAY" }),
        matchFixture({ id: 2, competition: { id: 9999 }, status: "IN_PLAY" }),
      ],
    });

    const result = await makeProvider().updateLiveMatches();

    expect(result).toEqual([
      expect.objectContaining({ externalId: "1", status: "live" }),
    ]);
  });
});

describe("updateFinishedMatches", () => {
  it("calls GET /competitions/:id/matches?status=FINISHED", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          matches: [
            matchFixture({
              status: "FINISHED",
              score: { fullTime: { home: 2, away: 1 } },
            }),
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result =
      await makeSingleLeagueProvider().updateFinishedMatches("2152");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.football-data.org/v4/competitions/2152/matches?status=FINISHED",
      { headers: { "X-Auth-Token": "test-key" } },
    );
    expect(result).toEqual([
      expect.objectContaining({
        status: "finished",
        homeScore: 2,
        awayScore: 1,
      }),
    ]);
  });

  it("throws SportsProviderError when the response shape fails Zod validation", async () => {
    mockFetchJson({ unexpected: "shape" });

    await expect(
      makeSingleLeagueProvider().updateFinishedMatches("2152"),
    ).rejects.toThrow(SportsProviderError);
  });
});

describe("status mapping", () => {
  it.each([
    ["SCHEDULED", "scheduled"],
    ["TIMED", "scheduled"],
    ["IN_PLAY", "live"],
    ["PAUSED", "live"],
    ["FINISHED", "finished"],
    ["AWARDED", "finished"],
    ["POSTPONED", "postponed"],
    ["SUSPENDED", "postponed"],
    ["CANCELLED", "cancelled"],
  ] as const)("maps status %s to %s", async (raw, expected) => {
    mockFetchJson({ matches: [matchFixture({ status: raw })] });

    const [match] = await makeSingleLeagueProvider().syncMatches(
      "2152",
      "2026",
    );

    expect(match.status).toBe(expected);
  });

  it("throws SportsProviderError for an unmapped status value", async () => {
    mockFetchJson({ matches: [matchFixture({ status: "SOME_UNKNOWN" })] });

    await expect(
      makeSingleLeagueProvider().syncMatches("2152", "2026"),
    ).rejects.toThrow(SportsProviderError);
  });
});

describe("error handling", () => {
  it("throws SportsProviderError immediately on network failure, without retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(makeSingleLeagueProvider().syncCompetitions()).rejects.toThrow(
      SportsProviderError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws SportsProviderError on non-ok HTTP response", async () => {
    mockFetchJson({}, false, 500);

    await expect(makeSingleLeagueProvider().syncCompetitions()).rejects.toThrow(
      SportsProviderError,
    );
  });
});

describe("throttling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays the 2nd and 3rd sequential calls by the 6.5s minimum interval", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 2152,
          name: "Copa Libertadores",
          currentSeason: { startDate: "2026-02-04" },
          emblem: null,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = makeSingleLeagueProvider();

    const first = provider.syncCompetitions();
    await vi.advanceTimersByTimeAsync(0);
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = provider.syncCompetitions();
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const third = provider.syncCompetitions();
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(500);
    await third;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not delay a call issued after the interval has already elapsed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 2152,
          name: "Copa Libertadores",
          currentSeason: { startDate: "2026-02-04" },
          emblem: null,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = makeSingleLeagueProvider();

    await provider.syncCompetitions();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(6500);

    const second = provider.syncCompetitions();
    await vi.advanceTimersByTimeAsync(0);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
