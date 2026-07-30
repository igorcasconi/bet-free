import { describe, expect, it } from "vitest";

import { levelForXp, xpInLevelForXp, XP_THRESHOLD } from "@/lib/gamification";

describe("XP_THRESHOLD", () => {
  it("is 3000", () => {
    expect(XP_THRESHOLD).toBe(3000);
  });
});

describe("levelForXp", () => {
  it("returns 1 for 0 xp", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("returns 1 for xp just below the threshold", () => {
    expect(levelForXp(2999)).toBe(1);
  });

  it("returns 2 exactly at the threshold", () => {
    expect(levelForXp(3000)).toBe(2);
  });

  it("returns 3 at twice the threshold", () => {
    expect(levelForXp(6000)).toBe(3);
  });
});

describe("xpInLevelForXp", () => {
  it("returns the remainder within the current level", () => {
    expect(xpInLevelForXp(3500)).toBe(500);
  });

  it("returns 0 exactly at a level boundary", () => {
    expect(xpInLevelForXp(3000)).toBe(0);
  });

  it("returns the full value below the first threshold", () => {
    expect(xpInLevelForXp(2999)).toBe(2999);
  });
});
