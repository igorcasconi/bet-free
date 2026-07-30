import { afterEach, describe, expect, it, vi } from "vitest";

import { persistRanking } from "@/features/ranking-engine/services/persist-ranking";

const { fromMock, deleteMock, eqMock, isMock, insertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  deleteMock: vi.fn(),
  eqMock: vi.fn(),
  isMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function setupFromMock(): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "ranking_cache")
      return { delete: deleteMock, insert: insertMock };
    throw new Error(`Unexpected table: ${table}`);
  });
  deleteMock.mockReturnValue({ eq: eqMock });
  eqMock.mockReturnValue({ is: isMock });
  isMock.mockResolvedValue({ error: null });
  insertMock.mockResolvedValue({ error: null });
}

setupFromMock();

afterEach(() => {
  vi.clearAllMocks();
  setupFromMock();
});

describe("persistRanking", () => {
  it("always calls delete before insert, filtered by ranking_type and competition_id IS NULL", async () => {
    await persistRanking("accuracy", [{ userId: "user-1", points: 100 }]);

    expect(eqMock).toHaveBeenCalledWith("ranking_type", "accuracy");
    expect(isMock).toHaveBeenCalledWith("competition_id", null);
    expect(insertMock).toHaveBeenCalled();
  });

  it("assigns position sequentially starting at 1", async () => {
    await persistRanking("discipline", [
      { userId: "user-1", points: 100 },
      { userId: "user-2", points: 50 },
    ]);

    expect(insertMock).toHaveBeenCalledWith([
      {
        user_id: "user-1",
        competition_id: null,
        ranking_type: "discipline",
        points: 100,
        position: 1,
      },
      {
        user_id: "user-2",
        competition_id: null,
        ranking_type: "discipline",
        points: 50,
        position: 2,
      },
    ]);
  });

  it("empty array: only delete called, no insert, returns 0", async () => {
    const result = await persistRanking("money_saved", []);

    expect(isMock).toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it("returns the count of ranked users on success", async () => {
    const result = await persistRanking("accuracy", [
      { userId: "user-1", points: 100 },
      { userId: "user-2", points: 50 },
    ]);

    expect(result).toBe(2);
  });

  it("propagates delete errors", async () => {
    const deleteError = new Error("delete failed");
    isMock.mockResolvedValue({ error: deleteError });

    await expect(
      persistRanking("accuracy", [{ userId: "user-1", points: 100 }]),
    ).rejects.toThrow("delete failed");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("propagates insert errors", async () => {
    const insertError = new Error("insert failed");
    insertMock.mockResolvedValue({ error: insertError });

    await expect(
      persistRanking("accuracy", [{ userId: "user-1", points: 100 }]),
    ).rejects.toThrow("insert failed");
  });
});
