import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

import {
  resolveUserId,
  toMatchCardData,
} from "@/features/matches/services/_shared";

function row(overrides: Partial<Parameters<typeof toMatchCardData>[0]> = {}) {
  return {
    id: "match-1",
    match_date: "2026-07-29T15:00:00.000Z",
    status: "scheduled" as const,
    competitions: { id: "comp-1", name: "Brasileirão" },
    home_team: { name: "Flamengo" },
    away_team: { name: "Palmeiras" },
    predictions: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("toMatchCardData", () => {
  it("maps a row with no prediction data to MatchCardData with prediction: null", () => {
    const result = toMatchCardData(row(), "user-1");

    expect(result).toEqual({
      id: "match-1",
      competitionId: "comp-1",
      competitionName: "Brasileirão",
      matchDate: "2026-07-29T15:00:00.000Z",
      status: "scheduled",
      homeTeamName: "Flamengo",
      homeTeamShort: "FLA",
      awayTeamName: "Palmeiras",
      awayTeamShort: "PAL",
      prediction: null,
    });
  });

  it("returns prediction: null when userId is null (unauthenticated), even if rows carry predictions", () => {
    const result = toMatchCardData(
      row({
        predictions: [
          {
            id: "pred-1",
            predicted_home_score: 2,
            predicted_away_score: 1,
            user_id: "user-1",
          },
        ],
      }),
      null,
    );

    expect(result.prediction).toBeNull();
  });

  it("returns the matching prediction when userId matches a joined row", () => {
    const result = toMatchCardData(
      row({
        predictions: [
          {
            id: "pred-1",
            predicted_home_score: 2,
            predicted_away_score: 1,
            user_id: "user-1",
          },
        ],
      }),
      "user-1",
    );

    expect(result.prediction).toEqual({
      id: "pred-1",
      predictedHomeScore: 2,
      predictedAwayScore: 1,
    });
  });

  it("returns prediction: null when no joined row matches the given userId", () => {
    const result = toMatchCardData(
      row({
        predictions: [
          {
            id: "pred-1",
            predicted_home_score: 2,
            predicted_away_score: 1,
            user_id: "someone-else",
          },
        ],
      }),
      "user-1",
    );

    expect(result.prediction).toBeNull();
  });

  it("falls back to empty strings/ids when relations are null", () => {
    const result = toMatchCardData(
      row({ competitions: null, home_team: null, away_team: null }),
      null,
    );

    expect(result.competitionId).toBe("");
    expect(result.competitionName).toBe("");
    expect(result.homeTeamName).toBe("");
    expect(result.homeTeamShort).toBe("");
    expect(result.awayTeamName).toBe("");
    expect(result.awayTeamShort).toBe("");
  });
});

describe("resolveUserId", () => {
  function createBuilder(result: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    return builder;
  }

  it("returns null without querying when firebaseUid is null", async () => {
    const result = await resolveUserId(null);

    expect(result).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns the users.id when a row matches firebase_uid", async () => {
    fromMock.mockReturnValue(
      createBuilder({ data: { id: "user-1" }, error: null }),
    );

    const result = await resolveUserId("firebase-uid-1");

    expect(result).toBe("user-1");
    expect(fromMock).toHaveBeenCalledWith("users");
  });

  it("returns null when no users row matches", async () => {
    fromMock.mockReturnValue(createBuilder({ data: null, error: null }));

    const result = await resolveUserId("missing-uid");

    expect(result).toBeNull();
  });

  it("propagates errors from the query", async () => {
    fromMock.mockReturnValue(
      createBuilder({ data: null, error: new Error("supabase down") }),
    );

    await expect(resolveUserId("uid-1")).rejects.toThrow("supabase down");
  });
});
