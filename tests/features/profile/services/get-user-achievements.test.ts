import { afterEach, describe, expect, it, vi } from "vitest";

import { getUserAchievements } from "@/features/profile/services/get-user-achievements";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);

  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getUserAchievements", () => {
  it("returns an empty array when there are no rows", async () => {
    fromMock.mockReturnValue(createBuilder({ data: [], error: null }));

    const result = await getUserAchievements("user-1");

    expect(result).toEqual([]);
  });

  it("maps rows into ProfileAchievement, ordered as returned by the query", async () => {
    fromMock.mockReturnValue(
      createBuilder({
        data: [
          {
            earned_at: "2026-07-20T12:00:00.000Z",
            achievements: {
              id: "ach-1",
              name: "Primeira previsão",
              description: "Fez a primeira previsão",
              icon_url: "https://example.com/icon.png",
            },
          },
        ],
        error: null,
      }),
    );

    const result = await getUserAchievements("user-1");

    expect(result).toEqual([
      {
        id: "ach-1",
        name: "Primeira previsão",
        description: "Fez a primeira previsão",
        iconUrl: "https://example.com/icon.png",
        earnedAt: "2026-07-20T12:00:00.000Z",
      },
    ]);
    expect(fromMock).toHaveBeenCalledWith("user_achievements");
  });

  it("filters out rows whose embedded achievements relation is null", async () => {
    fromMock.mockReturnValue(
      createBuilder({
        data: [{ earned_at: "2026-07-20T12:00:00.000Z", achievements: null }],
        error: null,
      }),
    );

    const result = await getUserAchievements("user-1");

    expect(result).toEqual([]);
  });

  it("propagates errors from the underlying query", async () => {
    fromMock.mockReturnValue(
      createBuilder({ data: null, error: new Error("supabase down") }),
    );

    await expect(getUserAchievements("user-1")).rejects.toThrow(
      "supabase down",
    );
  });
});
