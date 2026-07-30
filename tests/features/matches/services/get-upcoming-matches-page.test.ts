import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

import { getUpcomingMatchesPage } from "@/features/matches/services/get-upcoming-matches-page";

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
  builder.or = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);

  return builder;
}

function matchRow(id: string, matchDate: string) {
  return {
    id,
    match_date: matchDate,
    status: "scheduled",
    competitions: { id: "comp-1", name: "Brasileirão" },
    home_team: { name: "Flamengo" },
    away_team: { name: "Palmeiras" },
    predictions: [],
  };
}

function setupTables(overrides: {
  users?: QueryResult;
  matches?: QueryResult;
}): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "users") {
      return createBuilder(overrides.users ?? { data: null, error: null });
    }

    if (table === "matches") {
      return createBuilder(overrides.matches ?? { data: [], error: null });
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getUpcomingMatchesPage", () => {
  it("returns nextCursor: null when fewer rows than the limit come back (last page)", async () => {
    setupTables({
      matches: {
        data: [matchRow("m1", "2026-08-01T15:00:00.000Z")],
        error: null,
      },
    });

    const result = await getUpcomingMatchesPage({
      firebaseUid: null,
      cursor: null,
      limit: 5,
    });

    expect(result.nextCursor).toBeNull();
    expect(result.groups).toEqual([
      {
        competitionId: "comp-1",
        competitionName: "Brasileirão",
        matches: [
          expect.objectContaining({
            id: "m1",
            matchDate: "2026-08-01T15:00:00.000Z",
          }),
        ],
      },
    ]);
  });

  it("returns a nextCursor pointing at the last returned row when more rows exist (first/middle page)", async () => {
    // limit=2, service fetches limit+1=3 rows to detect a next page.
    setupTables({
      matches: {
        data: [
          matchRow("m1", "2026-08-01T15:00:00.000Z"),
          matchRow("m2", "2026-08-02T15:00:00.000Z"),
          matchRow("m3", "2026-08-03T15:00:00.000Z"),
        ],
        error: null,
      },
    });

    const result = await getUpcomingMatchesPage({
      firebaseUid: null,
      cursor: null,
      limit: 2,
    });

    expect(result.nextCursor).toEqual({
      matchDate: "2026-08-02T15:00:00.000Z",
      id: "m2",
    });
    expect(result.groups[0]?.matches).toHaveLength(2);
  });

  it("applies the cursor filter when a cursor is provided", async () => {
    setupTables({ matches: { data: [], error: null } });

    await getUpcomingMatchesPage({
      firebaseUid: null,
      cursor: { matchDate: "2026-08-01T15:00:00.000Z", id: "m1" },
      limit: 5,
    });

    const matchesBuilder = fromMock.mock.results.find(
      (r) => r.value?.or,
    )?.value;
    expect(matchesBuilder.or).toHaveBeenCalledWith(
      "match_date.gt.2026-08-01T15:00:00.000Z,and(match_date.eq.2026-08-01T15:00:00.000Z,id.gt.m1)",
    );
  });

  it("resolves the userId from firebaseUid and maps predictions for that user", async () => {
    setupTables({
      users: { data: { id: "user-1" }, error: null },
      matches: {
        data: [
          {
            ...matchRow("m1", "2026-08-01T15:00:00.000Z"),
            predictions: [
              {
                id: "pred-1",
                predicted_home_score: 2,
                predicted_away_score: 0,
                user_id: "user-1",
              },
            ],
          },
        ],
        error: null,
      },
    });

    const result = await getUpcomingMatchesPage({
      firebaseUid: "firebase-1",
      cursor: null,
      limit: 5,
    });

    expect(result.groups[0]?.matches[0]?.prediction).toEqual({
      id: "pred-1",
      predictedHomeScore: 2,
      predictedAwayScore: 0,
    });
  });

  it("returns an empty page (no groups, nextCursor: null) when there are no rows at all", async () => {
    setupTables({ matches: { data: [], error: null } });

    const result = await getUpcomingMatchesPage({
      firebaseUid: null,
      cursor: null,
      limit: 5,
    });

    expect(result).toEqual({ groups: [], nextCursor: null });
  });

  it("propagates errors from the matches query", async () => {
    setupTables({
      matches: { data: null, error: new Error("supabase down") },
    });

    await expect(
      getUpcomingMatchesPage({ firebaseUid: null, cursor: null, limit: 5 }),
    ).rejects.toThrow("supabase down");
  });
});
