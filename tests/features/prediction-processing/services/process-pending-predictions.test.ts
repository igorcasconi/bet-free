import { afterEach, describe, expect, it, vi } from "vitest";

import type { PendingPrediction } from "@/features/prediction-processing/types";

const { fetchPendingPredictionsMock } = vi.hoisted(() => ({
  fetchPendingPredictionsMock: vi.fn(),
}));

vi.mock(
  "@/features/prediction-processing/services/fetch-pending-predictions",
  () => ({
    fetchPendingPredictions: fetchPendingPredictionsMock,
  }),
);

const {
  fromMock,
  usersSelectMock,
  usersEqMock,
  usersSingleMock,
  usersUpdateMock,
  usersUpdateEqMock,
  predictionsUpdateMock,
  predictionsUpdateEqMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  usersSelectMock: vi.fn(),
  usersEqMock: vi.fn(),
  usersSingleMock: vi.fn(),
  usersUpdateMock: vi.fn(),
  usersUpdateEqMock: vi.fn(),
  predictionsUpdateMock: vi.fn(),
  predictionsUpdateEqMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

interface UserRowStub {
  id: string;
  xp: number;
  money_saved: number;
  current_streak: number;
  last_streak_date: string | null;
}

function setupFromMock(userRows: Record<string, UserRowStub>): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "users") {
      return { select: usersSelectMock, update: usersUpdateMock };
    }
    if (table === "predictions") {
      return { update: predictionsUpdateMock };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  usersSelectMock.mockReturnValue({ eq: usersEqMock });
  usersEqMock.mockImplementation((_column: string, userId: string) => ({
    single: () => usersSingleMock(userId),
  }));
  usersSingleMock.mockImplementation((userId: string) => {
    const row = userRows[userId];
    if (!row)
      return Promise.resolve({ data: null, error: { message: "not found" } });
    return Promise.resolve({ data: row, error: null });
  });

  usersUpdateMock.mockReturnValue({ eq: usersUpdateEqMock });
  usersUpdateEqMock.mockResolvedValue({ error: null });

  predictionsUpdateMock.mockReturnValue({ eq: predictionsUpdateEqMock });
  predictionsUpdateEqMock.mockResolvedValue({ error: null });
}

function prediction(overrides: Partial<PendingPrediction>): PendingPrediction {
  return {
    id: "pred-1",
    userId: "user-1",
    matchDate: "2026-01-01T15:00:00.000Z",
    predictedHomeScore: 2,
    predictedAwayScore: 0,
    homeScore: 3,
    awayScore: 1,
    wageredAmount: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("processPendingPredictions", () => {
  it("returns zero counts when there are no pending predictions", async () => {
    fetchPendingPredictionsMock.mockResolvedValue([]);
    setupFromMock({});

    const { processPendingPredictions } =
      await import("@/features/prediction-processing/services/process-pending-predictions");

    const result = await processPendingPredictions();

    expect(result).toEqual({ usersUpdated: 0, predictionsProcessed: 0 });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("groups predictions by user and processes each group with correct totals", async () => {
    fetchPendingPredictionsMock.mockResolvedValue([
      prediction({ id: "pred-1", userId: "user-1" }),
      prediction({ id: "pred-2", userId: "user-2" }),
    ]);
    setupFromMock({
      "user-1": {
        id: "user-1",
        xp: 0,
        money_saved: 0,
        current_streak: 0,
        last_streak_date: null,
      },
      "user-2": {
        id: "user-2",
        xp: 0,
        money_saved: 0,
        current_streak: 0,
        last_streak_date: null,
      },
    });

    const { processPendingPredictions } =
      await import("@/features/prediction-processing/services/process-pending-predictions");

    const result = await processPendingPredictions();

    expect(result).toEqual({ usersUpdated: 2, predictionsProcessed: 2 });
    expect(usersUpdateMock).toHaveBeenCalledTimes(2);
    expect(predictionsUpdateMock).toHaveBeenCalledTimes(2);
  });

  it("sorts each user's predictions chronologically by matchDate before applying results", async () => {
    fetchPendingPredictionsMock.mockResolvedValue([
      prediction({
        id: "pred-later",
        userId: "user-1",
        matchDate: "2026-01-03T12:00:00.000Z",
      }),
      prediction({
        id: "pred-earlier",
        userId: "user-1",
        matchDate: "2026-01-01T12:00:00.000Z",
      }),
    ]);
    setupFromMock({
      "user-1": {
        id: "user-1",
        xp: 0,
        money_saved: 0,
        current_streak: 0,
        last_streak_date: null,
      },
    });

    const { processPendingPredictions } =
      await import("@/features/prediction-processing/services/process-pending-predictions");

    await processPendingPredictions();

    // Both distinct calendar days for the same user -> streak incremented
    // twice, proving chronological order was respected before applying
    // results (apply-prediction-results expects pre-sorted input).
    expect(usersUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ current_streak: 2 }),
    );
  });

  it("isolates one user's DB error from the others, still persisting and counting the rest", async () => {
    fetchPendingPredictionsMock.mockResolvedValue([
      prediction({ id: "pred-1", userId: "user-broken" }),
      prediction({ id: "pred-2", userId: "user-ok" }),
    ]);
    setupFromMock({
      "user-ok": {
        id: "user-ok",
        xp: 0,
        money_saved: 0,
        current_streak: 0,
        last_streak_date: null,
      },
      // user-broken intentionally omitted -> fetchUserState errors
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { processPendingPredictions } =
      await import("@/features/prediction-processing/services/process-pending-predictions");

    const result = await processPendingPredictions();

    expect(result).toEqual({ usersUpdated: 1, predictionsProcessed: 1 });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("user-broken"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it("writes points_earned individually for each processed prediction", async () => {
    fetchPendingPredictionsMock.mockResolvedValue([
      prediction({
        id: "pred-1",
        userId: "user-1",
        predictedHomeScore: 2,
        predictedAwayScore: 0,
        homeScore: 3,
        awayScore: 1,
      }),
      prediction({
        id: "pred-2",
        userId: "user-1",
        matchDate: "2026-01-02T12:00:00.000Z",
        predictedHomeScore: 0,
        predictedAwayScore: 0,
        homeScore: 1,
        awayScore: 0,
      }),
    ]);
    setupFromMock({
      "user-1": {
        id: "user-1",
        xp: 0,
        money_saved: 0,
        current_streak: 0,
        last_streak_date: null,
      },
    });

    const { processPendingPredictions } =
      await import("@/features/prediction-processing/services/process-pending-predictions");

    await processPendingPredictions();

    expect(predictionsUpdateMock).toHaveBeenCalledWith({ points_earned: 1 });
    expect(predictionsUpdateMock).toHaveBeenCalledWith({ points_earned: 0 });
    expect(predictionsUpdateEqMock).toHaveBeenCalledWith("id", "pred-1");
    expect(predictionsUpdateEqMock).toHaveBeenCalledWith("id", "pred-2");
  });
});
