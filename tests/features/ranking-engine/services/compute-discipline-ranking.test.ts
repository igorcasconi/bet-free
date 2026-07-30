import { afterEach, describe, expect, it, vi } from "vitest";

import { computeDisciplineRanking } from "@/features/ranking-engine/services/compute-discipline-ranking";

const { fromMock, selectMock, orderMock1, orderMock2 } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  orderMock1: vi.fn(),
  orderMock2: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function setupFromMock(): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "users") return { select: selectMock };
    throw new Error(`Unexpected table: ${table}`);
  });
  selectMock.mockReturnValue({ order: orderMock1 });
  orderMock1.mockReturnValue({ order: orderMock2 });
}

setupFromMock();

afterEach(() => {
  vi.clearAllMocks();
  setupFromMock();
});

describe("computeDisciplineRanking", () => {
  it("queries users ordered by current_streak desc, id asc", async () => {
    orderMock2.mockResolvedValue({ data: [], error: null });

    await computeDisciplineRanking();

    expect(selectMock).toHaveBeenCalledWith("id, current_streak");
    expect(orderMock1).toHaveBeenCalledWith("current_streak", {
      ascending: false,
    });
    expect(orderMock2).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("includes all users, including current_streak = 0", async () => {
    orderMock2.mockResolvedValue({
      data: [
        { id: "user-1", current_streak: 5 },
        { id: "user-2", current_streak: 0 },
      ],
      error: null,
    });

    const result = await computeDisciplineRanking();

    expect(result).toEqual([
      { userId: "user-1", points: 5 },
      { userId: "user-2", points: 0 },
    ]);
  });

  it("throws when the query errors", async () => {
    const queryError = new Error("db error");
    orderMock2.mockResolvedValue({ data: null, error: queryError });

    await expect(computeDisciplineRanking()).rejects.toThrow("db error");
  });
});
