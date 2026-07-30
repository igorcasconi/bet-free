import { describe, expect, it } from "vitest";

import { levelForXp } from "@/lib/gamification";

import { applyPredictionResults } from "@/features/prediction-processing/services/apply-prediction-results";
import type {
  PendingPrediction,
  UserGamificationState,
} from "@/features/prediction-processing/types";

function baseUser(
  overrides: Partial<UserGamificationState> = {},
): UserGamificationState {
  return {
    xp: 0,
    level: 1,
    moneySaved: 0,
    currentStreak: 0,
    lastStreakDate: null,
    ...overrides,
  };
}

function winningPrediction(
  overrides: Partial<PendingPrediction> = {},
): PendingPrediction {
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

function losingPrediction(
  overrides: Partial<PendingPrediction> = {},
): PendingPrediction {
  return {
    id: "pred-1",
    userId: "user-1",
    matchDate: "2026-01-01T15:00:00.000Z",
    predictedHomeScore: 2,
    predictedAwayScore: 0,
    homeScore: 1,
    awayScore: 1,
    wageredAmount: null,
    ...overrides,
  };
}

describe("applyPredictionResults", () => {
  it("awards 100 xp for a win and recomputes level", () => {
    const { userUpdate, predictionResults } = applyPredictionResults(
      baseUser(),
      [winningPrediction()],
    );

    expect(userUpdate.xp).toBe(100);
    expect(userUpdate.level).toBe(levelForXp(100));
    expect(predictionResults).toEqual([{ id: "pred-1", pointsEarned: 1 }]);
  });

  it("awards 0 xp for a loss", () => {
    const { userUpdate, predictionResults } = applyPredictionResults(
      baseUser(),
      [losingPrediction()],
    );

    expect(userUpdate.xp).toBe(0);
    expect(predictionResults).toEqual([{ id: "pred-1", pointsEarned: 0 }]);
  });

  it("increments money saved by wagered_amount when present on a win", () => {
    const { userUpdate } = applyPredictionResults(baseUser(), [
      winningPrediction({ wageredAmount: 25 }),
    ]);

    expect(userUpdate.moneySaved).toBe(25);
  });

  it("increments money saved by wagered_amount when present on a loss", () => {
    const { userUpdate } = applyPredictionResults(baseUser(), [
      losingPrediction({ wageredAmount: 40 }),
    ]);

    expect(userUpdate.moneySaved).toBe(40);
  });

  it("falls back to R$10 money saved on a win when wagered_amount is null", () => {
    const { userUpdate } = applyPredictionResults(baseUser(), [
      winningPrediction({ wageredAmount: null }),
    ]);

    expect(userUpdate.moneySaved).toBe(10);
  });

  it("falls back to R$10 money saved on a loss when wagered_amount is null", () => {
    const { userUpdate } = applyPredictionResults(baseUser(), [
      losingPrediction({ wageredAmount: null }),
    ]);

    expect(userUpdate.moneySaved).toBe(10);
  });

  it("increments streak once for multiple predictions on the same calendar day", () => {
    const { userUpdate } = applyPredictionResults(baseUser(), [
      winningPrediction({
        id: "pred-1",
        matchDate: "2026-01-01T12:00:00.000Z",
      }),
      losingPrediction({
        id: "pred-2",
        matchDate: "2026-01-01T20:00:00.000Z",
      }),
    ]);

    expect(userUpdate.currentStreak).toBe(1);
    expect(userUpdate.lastStreakDate).toBe("2026-01-01");
  });

  it("increments streak across multiple distinct calendar days", () => {
    const { userUpdate } = applyPredictionResults(baseUser(), [
      winningPrediction({
        id: "pred-1",
        matchDate: "2026-01-01T12:00:00.000Z",
      }),
      losingPrediction({
        id: "pred-2",
        matchDate: "2026-01-02T12:00:00.000Z",
      }),
      winningPrediction({
        id: "pred-3",
        matchDate: "2026-01-03T12:00:00.000Z",
      }),
    ]);

    expect(userUpdate.currentStreak).toBe(3);
    expect(userUpdate.lastStreakDate).toBe("2026-01-03");
  });

  it("never decrements the streak, starting from an existing lastStreakDate", () => {
    const { userUpdate } = applyPredictionResults(
      baseUser({ currentStreak: 5, lastStreakDate: "2026-01-01" }),
      [
        winningPrediction({
          id: "pred-1",
          matchDate: "2026-01-01T23:00:00.000Z",
        }),
      ],
    );

    expect(userUpdate.currentStreak).toBe(5);
  });

  it("recomputes level via levelForXp over accumulated xp across multiple wins", () => {
    const { userUpdate } = applyPredictionResults(baseUser({ xp: 2950 }), [
      winningPrediction({ id: "pred-1" }),
      winningPrediction({
        id: "pred-2",
        matchDate: "2026-01-02T12:00:00.000Z",
      }),
    ]);

    expect(userUpdate.xp).toBe(3150);
    expect(userUpdate.level).toBe(levelForXp(3150));
    expect(userUpdate.level).toBe(2);
  });
});
