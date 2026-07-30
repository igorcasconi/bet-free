import { afterEach, describe, expect, it, vi } from "vitest";

import { computeAccuracyRanking } from "@/features/ranking-engine/services/compute-accuracy-ranking";

const { fromMock, selectMock, notMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  notMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function setupFromMock(): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "predictions") return { select: selectMock };
    throw new Error(`Unexpected table: ${table}`);
  });
  selectMock.mockReturnValue({ not: notMock });
}

setupFromMock();

afterEach(() => {
  vi.clearAllMocks();
  setupFromMock();
});

describe("computeAccuracyRanking", () => {
  it("queries predictions filtering points_earned IS NOT NULL", async () => {
    notMock.mockResolvedValue({ data: [], error: null });

    await computeAccuracyRanking();

    expect(selectMock).toHaveBeenCalledWith("user_id, points_earned");
    expect(notMock).toHaveBeenCalledWith("points_earned", "is", null);
  });

  it("excludes users with fewer than 5 processed predictions", async () => {
    notMock.mockResolvedValue({
      data: [
        { user_id: "user-1", points_earned: 1 },
        { user_id: "user-1", points_earned: 0 },
        { user_id: "user-1", points_earned: 1 },
        { user_id: "user-1", points_earned: 1 },
      ],
      error: null,
    });

    const result = await computeAccuracyRanking();

    expect(result).toEqual([]);
  });

  it("includes users with 5+ processed predictions and computes points correctly", async () => {
    notMock.mockResolvedValue({
      data: [
        { user_id: "user-1", points_earned: 1 },
        { user_id: "user-1", points_earned: 1 },
        { user_id: "user-1", points_earned: 1 },
        { user_id: "user-1", points_earned: 0 },
        { user_id: "user-1", points_earned: 0 },
      ],
      error: null,
    });

    const result = await computeAccuracyRanking();

    // 3/5 = 0.6 -> 6000 basis points
    expect(result).toEqual([{ userId: "user-1", points: 6000 }]);
  });

  it("sorts by points descending", async () => {
    notMock.mockResolvedValue({
      data: [
        ...Array.from({ length: 5 }, () => ({
          user_id: "user-low",
          points_earned: 0,
        })),
        ...Array.from({ length: 5 }, () => ({
          user_id: "user-high",
          points_earned: 1,
        })),
      ],
      error: null,
    });

    const result = await computeAccuracyRanking();

    expect(result).toEqual([
      { userId: "user-high", points: 10000 },
      { userId: "user-low", points: 0 },
    ]);
  });

  it("breaks ties by userId ascending", async () => {
    notMock.mockResolvedValue({
      data: [
        ...Array.from({ length: 5 }, () => ({
          user_id: "user-b",
          points_earned: 1,
        })),
        ...Array.from({ length: 5 }, () => ({
          user_id: "user-a",
          points_earned: 1,
        })),
      ],
      error: null,
    });

    const result = await computeAccuracyRanking();

    expect(result).toEqual([
      { userId: "user-a", points: 10000 },
      { userId: "user-b", points: 10000 },
    ]);
  });

  it("throws when the query errors", async () => {
    const queryError = new Error("db error");
    notMock.mockResolvedValue({ data: null, error: queryError });

    await expect(computeAccuracyRanking()).rejects.toThrow("db error");
  });
});
