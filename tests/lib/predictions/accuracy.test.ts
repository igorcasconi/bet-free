import { afterEach, describe, expect, it, vi } from "vitest";

import { getAccuracyPercent } from "@/lib/predictions/accuracy";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

interface QueryResult {
  data: unknown;
  error: unknown;
}

// Mimics the Supabase query builder: every filter method returns the same
// chainable object, and the object itself is thenable.
function createBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.not = vi.fn(chain);
  builder.then = (onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);

  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getAccuracyPercent", () => {
  it("returns 0 when there are no processed predictions", async () => {
    fromMock.mockReturnValue(createBuilder({ data: [], error: null }));

    const result = await getAccuracyPercent("user-1");

    expect(result).toBe(0);
  });

  it("returns the rounded percentage for a mix of correct and incorrect predictions", async () => {
    fromMock.mockReturnValue(
      createBuilder({
        data: [
          { points_earned: 10 },
          { points_earned: 0 },
          { points_earned: 5 },
        ],
        error: null,
      }),
    );

    const result = await getAccuracyPercent("user-1");

    expect(result).toBe(67);
  });

  it("returns 100 when every processed prediction is correct", async () => {
    fromMock.mockReturnValue(
      createBuilder({
        data: [{ points_earned: 10 }, { points_earned: 5 }],
        error: null,
      }),
    );

    const result = await getAccuracyPercent("user-1");

    expect(result).toBe(100);
  });

  it("returns 0 when every processed prediction is incorrect", async () => {
    fromMock.mockReturnValue(
      createBuilder({
        data: [{ points_earned: 0 }, { points_earned: 0 }],
        error: null,
      }),
    );

    const result = await getAccuracyPercent("user-1");

    expect(result).toBe(0);
  });

  it("propagates errors from the underlying query", async () => {
    fromMock.mockReturnValue(
      createBuilder({ data: null, error: new Error("supabase down") }),
    );

    await expect(getAccuracyPercent("user-1")).rejects.toThrow("supabase down");
  });
});
