import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "@/lib/concurrency";

describe("mapWithConcurrency", () => {
  it("resolves results in the same order as the input items", async () => {
    const results = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async (n) => n * 10,
    );

    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("never runs more than `limit` items concurrently", async () => {
    let active = 0;
    let maxActive = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return n;
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("propagates an error thrown by any item", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });

  it("handles an empty items array without spawning workers", async () => {
    const results = await mapWithConcurrency<number, number>(
      [],
      3,
      async (n) => n,
    );

    expect(results).toEqual([]);
  });
});
