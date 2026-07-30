import { afterEach, describe, expect, it, vi } from "vitest";

import { computeMoneySavedRanking } from "@/features/ranking-engine/services/compute-money-saved-ranking";

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

describe("computeMoneySavedRanking", () => {
  it("queries users ordered by money_saved desc, id asc", async () => {
    orderMock2.mockResolvedValue({ data: [], error: null });

    await computeMoneySavedRanking();

    expect(selectMock).toHaveBeenCalledWith("id, money_saved");
    expect(orderMock1).toHaveBeenCalledWith("money_saved", {
      ascending: false,
    });
    expect(orderMock2).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("includes all users, including money_saved = 0, converted to cents", async () => {
    orderMock2.mockResolvedValue({
      data: [
        { id: "user-1", money_saved: 12.34 },
        { id: "user-2", money_saved: 0 },
      ],
      error: null,
    });

    const result = await computeMoneySavedRanking();

    expect(result).toEqual([
      { userId: "user-1", points: 1234 },
      { userId: "user-2", points: 0 },
    ]);
  });

  it("throws when the query errors", async () => {
    const queryError = new Error("db error");
    orderMock2.mockResolvedValue({ data: null, error: queryError });

    await expect(computeMoneySavedRanking()).rejects.toThrow("db error");
  });
});
