import { afterEach, describe, expect, it, vi } from "vitest";

import { getDashboardData } from "@/features/dashboard/services/get-dashboard-data";
import { getAccuracyPercent } from "@/lib/predictions/accuracy";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

vi.mock("@/lib/predictions/accuracy", () => ({
  getAccuracyPercent: vi.fn(),
}));

const getAccuracyPercentMock = vi.mocked(getAccuracyPercent);

interface QueryResult {
  data: unknown;
  error: unknown;
}

const EMPTY: QueryResult = { data: [], error: null };

// Mimics the Supabase query builder: every filter method returns the same
// chainable object, and the object itself is thenable — matching the real
// PostgrestFilterBuilder, which resolves whether or not `.maybeSingle()` is
// the terminal call.
function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.gte = vi.fn(chain);
  builder.lt = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.not = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);

  return builder;
}

function setupTables(overrides: {
  users?: QueryResult;
  matches?: [today: QueryResult, upcoming: QueryResult];
  latestPredictions?: QueryResult;
}): void {
  let matchesCallCount = 0;

  fromMock.mockImplementation((table: string) => {
    if (table === "users") {
      return createBuilder(overrides.users ?? { data: null, error: null });
    }

    if (table === "matches") {
      matchesCallCount += 1;
      const [today, upcoming] = overrides.matches ?? [EMPTY, EMPTY];
      return createBuilder(matchesCallCount === 1 ? today : upcoming);
    }

    if (table === "predictions") {
      return createBuilder(overrides.latestPredictions ?? EMPTY);
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

getAccuracyPercentMock.mockResolvedValue(0);

afterEach(() => {
  vi.clearAllMocks();
  getAccuracyPercentMock.mockResolvedValue(0);
});

describe("getDashboardData", () => {
  it("returns zeroed stats and skips the users query when firebaseUid is null", async () => {
    setupTables({});

    const result = await getDashboardData(null);

    expect(result.stats).toEqual({
      moneySaved: 0,
      currentStreak: 0,
      level: 1,
      xpInLevel: 0,
      xpToNextLevel: 3000,
      accuracyPercent: 0,
    });
    expect(result.latestPredictions).toEqual([]);
    expect(fromMock).not.toHaveBeenCalledWith("users");
  });

  it("returns zeroed stats without inserting when firebase_uid has no users row", async () => {
    setupTables({ users: { data: null, error: null } });

    const result = await getDashboardData("missing-uid");

    expect(result.stats).toEqual({
      moneySaved: 0,
      currentStreak: 0,
      level: 1,
      xpInLevel: 0,
      xpToNextLevel: 3000,
      accuracyPercent: 0,
    });
    expect(result.latestPredictions).toEqual([]);
  });

  it("uses the accuracy percent returned by the shared getAccuracyPercent", async () => {
    setupTables({
      users: {
        data: { id: "user-1", money_saved: 4380, current_streak: 23, xp: 2340 },
        error: null,
      },
    });
    getAccuracyPercentMock.mockResolvedValue(67);

    const result = await getDashboardData("uid-1");

    expect(result.stats.accuracyPercent).toBe(67);
    expect(getAccuracyPercentMock).toHaveBeenCalledWith("user-1");
  });

  it("returns 0% accuracy when getAccuracyPercent resolves to 0", async () => {
    setupTables({
      users: {
        data: { id: "user-1", money_saved: 0, current_streak: 0, xp: 0 },
        error: null,
      },
    });
    getAccuracyPercentMock.mockResolvedValue(0);

    const result = await getDashboardData("uid-1");

    expect(result.stats.accuracyPercent).toBe(0);
  });

  it("computes level and xpInLevel from a fixed 3000 threshold", async () => {
    setupTables({
      users: {
        data: { id: "user-1", money_saved: 4380, current_streak: 23, xp: 2340 },
        error: null,
      },
    });

    const result = await getDashboardData("uid-1");

    expect(result.stats.moneySaved).toBe(4380);
    expect(result.stats.currentStreak).toBe(23);
    expect(result.stats.level).toBe(1);
    expect(result.stats.xpInLevel).toBe(2340);
    expect(result.stats.xpToNextLevel).toBe(3000);
  });

  it("segments matches into today and upcoming", async () => {
    setupTables({
      matches: [
        {
          data: [
            {
              id: "match-today",
              match_date: "2026-07-26T15:00:00.000Z",
              competitions: { name: "Brasileirão" },
              home_team: { name: "Flamengo" },
              away_team: { name: "Palmeiras" },
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "match-upcoming",
              match_date: "2026-08-01T15:00:00.000Z",
              competitions: { name: "Brasileirão" },
              home_team: { name: "Corinthians" },
              away_team: { name: "Santos" },
            },
          ],
          error: null,
        },
      ],
    });

    const result = await getDashboardData(null);

    expect(result.todayMatches).toEqual([
      {
        id: "match-today",
        competitionName: "Brasileirão",
        matchDate: "2026-07-26T15:00:00.000Z",
        homeTeamName: "Flamengo",
        homeTeamShort: "FLA",
        awayTeamName: "Palmeiras",
        awayTeamShort: "PAL",
        hasPrediction: false,
      },
    ]);
    expect(result.upcomingMatches).toEqual([
      {
        id: "match-upcoming",
        competitionName: "Brasileirão",
        matchDate: "2026-08-01T15:00:00.000Z",
        homeTeamName: "Corinthians",
        homeTeamShort: "COR",
        awayTeamName: "Santos",
        awayTeamShort: "SAN",
        hasPrediction: false,
      },
    ]);
  });

  it("renders an empty state (no rows, no error) when there are no matches", async () => {
    setupTables({});

    const result = await getDashboardData(null);

    expect(result.todayMatches).toEqual([]);
    expect(result.upcomingMatches).toEqual([]);
  });

  it("maps latest predictions ordered and limited by the query, without erroring on empty results", async () => {
    setupTables({
      users: {
        data: { id: "user-1", money_saved: 0, current_streak: 0, xp: 0 },
        error: null,
      },
      latestPredictions: {
        data: [
          {
            id: "pred-1",
            predicted_home_score: 2,
            predicted_away_score: 1,
            created_at: "2026-07-25T12:00:00.000Z",
            matches: {
              home_team: { name: "Flamengo" },
              away_team: { name: "Palmeiras" },
            },
          },
        ],
        error: null,
      },
    });

    const result = await getDashboardData("uid-1");

    expect(result.latestPredictions).toEqual([
      {
        id: "pred-1",
        matchLabel: "Flamengo vs Palmeiras",
        predictedScore: "2-1",
        createdAt: "2026-07-25T12:00:00.000Z",
      },
    ]);
  });

  it("propagates errors from any of the underlying queries", async () => {
    setupTables({
      users: { data: null, error: new Error("supabase down") },
    });

    await expect(getDashboardData("uid-1")).rejects.toThrow("supabase down");
  });
});
