import { describe, expect, it, vi } from "vitest";

const {
  computeAccuracyRankingMock,
  computeDisciplineRankingMock,
  computeMoneySavedRankingMock,
  persistRankingMock,
} = vi.hoisted(() => ({
  computeAccuracyRankingMock: vi.fn(),
  computeDisciplineRankingMock: vi.fn(),
  computeMoneySavedRankingMock: vi.fn(),
  persistRankingMock: vi.fn(),
}));

vi.mock("@/features/ranking-engine/services/compute-accuracy-ranking", () => ({
  computeAccuracyRanking: computeAccuracyRankingMock,
}));

vi.mock(
  "@/features/ranking-engine/services/compute-discipline-ranking",
  () => ({
    computeDisciplineRanking: computeDisciplineRankingMock,
  }),
);

vi.mock(
  "@/features/ranking-engine/services/compute-money-saved-ranking",
  () => ({
    computeMoneySavedRanking: computeMoneySavedRankingMock,
  }),
);

vi.mock("@/features/ranking-engine/services/persist-ranking", () => ({
  persistRanking: persistRankingMock,
}));

import { recomputeRankings } from "@/features/ranking-engine/services/recompute-rankings";

describe("recomputeRankings", () => {
  it("computes and persists the 3 rankings in order: accuracy, discipline, money_saved", async () => {
    const accuracyRanked = [{ userId: "u1", points: 9000 }];
    const disciplineRanked = [{ userId: "u2", points: 5 }];
    const moneySavedRanked = [{ userId: "u3", points: 1000 }];

    computeAccuracyRankingMock.mockResolvedValue(accuracyRanked);
    computeDisciplineRankingMock.mockResolvedValue(disciplineRanked);
    computeMoneySavedRankingMock.mockResolvedValue(moneySavedRanked);
    persistRankingMock
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const callOrder: string[] = [];
    computeAccuracyRankingMock.mockImplementation(async () => {
      callOrder.push("accuracy");
      return accuracyRanked;
    });
    computeDisciplineRankingMock.mockImplementation(async () => {
      callOrder.push("discipline");
      return disciplineRanked;
    });
    computeMoneySavedRankingMock.mockImplementation(async () => {
      callOrder.push("money_saved");
      return moneySavedRanked;
    });

    await recomputeRankings();

    expect(callOrder).toEqual(["accuracy", "discipline", "money_saved"]);
    expect(persistRankingMock).toHaveBeenNthCalledWith(
      1,
      "accuracy",
      accuracyRanked,
    );
    expect(persistRankingMock).toHaveBeenNthCalledWith(
      2,
      "discipline",
      disciplineRanked,
    );
    expect(persistRankingMock).toHaveBeenNthCalledWith(
      3,
      "money_saved",
      moneySavedRanked,
    );
  });

  it("returns the correct shape with counts from persistRanking", async () => {
    computeAccuracyRankingMock.mockResolvedValue([]);
    computeDisciplineRankingMock.mockResolvedValue([]);
    computeMoneySavedRankingMock.mockResolvedValue([]);
    persistRankingMock
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2);

    const result = await recomputeRankings();

    expect(result).toEqual({
      accuracyRanked: 3,
      disciplineRanked: 7,
      moneySavedRanked: 2,
    });
  });

  it("returns zero counts when all rankings are empty", async () => {
    computeAccuracyRankingMock.mockResolvedValue([]);
    computeDisciplineRankingMock.mockResolvedValue([]);
    computeMoneySavedRankingMock.mockResolvedValue([]);
    persistRankingMock
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await recomputeRankings();

    expect(result).toEqual({
      accuracyRanked: 0,
      disciplineRanked: 0,
      moneySavedRanked: 0,
    });
  });
});
