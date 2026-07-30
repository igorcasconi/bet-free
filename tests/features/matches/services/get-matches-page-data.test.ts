import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock, getUpcomingMatchesPageMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getUpcomingMatchesPageMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

vi.mock("@/features/matches/services/get-upcoming-matches-page", () => ({
  getUpcomingMatchesPage: getUpcomingMatchesPageMock,
}));

import { getMatchesPageData } from "@/features/matches/services/get-matches-page-data";

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.gte = vi.fn(chain);
  builder.lt = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);

  return builder;
}

function matchRow(id: string) {
  return {
    id,
    match_date: "2026-07-29T15:00:00.000Z",
    status: "scheduled",
    competitions: { id: "comp-1", name: "Brasileirão" },
    home_team: { name: "Flamengo" },
    away_team: { name: "Palmeiras" },
    predictions: [],
  };
}

const EMPTY_UPCOMING = { groups: [], nextCursor: null };

afterEach(() => {
  vi.clearAllMocks();
});

describe("getMatchesPageData", () => {
  it("returns today's matches grouped by competition and delegates the upcoming page", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "matches") {
        return createBuilder({ data: [matchRow("m1")], error: null });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    getUpcomingMatchesPageMock.mockResolvedValue(EMPTY_UPCOMING);

    const result = await getMatchesPageData(null);

    expect(result.todayGroups).toEqual([
      {
        competitionId: "comp-1",
        competitionName: "Brasileirão",
        matches: [expect.objectContaining({ id: "m1" })],
      },
    ]);
    expect(result.upcomingPage).toBe(EMPTY_UPCOMING);
    expect(getUpcomingMatchesPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: null, cursor: null }),
    );
  });

  it("returns an empty todayGroups array when there are no matches today", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "matches") {
        return createBuilder({ data: [], error: null });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    getUpcomingMatchesPageMock.mockResolvedValue(EMPTY_UPCOMING);

    const result = await getMatchesPageData(null);

    expect(result.todayGroups).toEqual([]);
  });

  it("propagates errors from today's matches query", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "matches") {
        return createBuilder({ data: null, error: new Error("supabase down") });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    getUpcomingMatchesPageMock.mockResolvedValue(EMPTY_UPCOMING);

    await expect(getMatchesPageData(null)).rejects.toThrow("supabase down");
  });
});
