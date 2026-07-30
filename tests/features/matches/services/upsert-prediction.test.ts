import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

import { upsertPrediction } from "@/features/matches/services/upsert-prediction";

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createMatchesBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  return builder;
}

function createPredictionsBuilder(result: QueryResult) {
  return {
    upsert: vi.fn(() => Promise.resolve(result)),
  };
}

function setupTables(overrides: {
  match?: QueryResult;
  upsert?: QueryResult;
}): { upsertMock: ReturnType<typeof vi.fn> } {
  const predictionsBuilder = createPredictionsBuilder(
    overrides.upsert ?? { data: null, error: null },
  );

  fromMock.mockImplementation((table: string) => {
    if (table === "matches") {
      return createMatchesBuilder(
        overrides.match ?? {
          data: { status: "scheduled" },
          error: null,
        },
      );
    }
    if (table === "predictions") {
      return predictionsBuilder;
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { upsertMock: predictionsBuilder.upsert as ReturnType<typeof vi.fn> };
}

const INPUT = {
  userId: "user-1",
  matchId: "match-1",
  predictedHomeScore: 2,
  predictedAwayScore: 1,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("upsertPrediction", () => {
  it("upserts on conflict (user_id, match_id) and returns ok: true for a scheduled match", async () => {
    const { upsertMock } = setupTables({});

    const result = await upsertPrediction(INPUT);

    expect(result).toEqual({ ok: true });
    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        match_id: "match-1",
        predicted_home_score: 2,
        predicted_away_score: 1,
      },
      { onConflict: "user_id,match_id" },
    );
  });

  it("updates an existing prediction in place via the same upsert call (no duplicate-row logic)", async () => {
    setupTables({ upsert: { data: null, error: null } });

    const result = await upsertPrediction(INPUT);

    expect(result).toEqual({ ok: true });
  });

  it("rejects without writing when the match is not scheduled", async () => {
    const { upsertMock } = setupTables({
      match: { data: { status: "finished" }, error: null },
    });

    const result = await upsertPrediction(INPUT);

    expect(result).toEqual({ ok: false, error: "match already started" });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects without writing when the match does not exist", async () => {
    const { upsertMock } = setupTables({
      match: { data: null, error: null },
    });

    const result = await upsertPrediction(INPUT);

    expect(result.ok).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("propagates errors from the match lookup", async () => {
    setupTables({
      match: { data: null, error: new Error("supabase down") },
    });

    await expect(upsertPrediction(INPUT)).rejects.toThrow("supabase down");
  });

  it("returns ok: false with a generic message (not the raw Supabase error) when the upsert itself fails", async () => {
    setupTables({
      upsert: { data: null, error: new Error("constraint violation") },
    });

    const result = await upsertPrediction(INPUT);

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).not.toContain(
      "constraint violation",
    );
  });
});
