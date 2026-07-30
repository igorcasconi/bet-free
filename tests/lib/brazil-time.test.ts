import { describe, expect, it } from "vitest";

import { getBrazilCalendarDay } from "@/lib/brazil-time";

describe("getBrazilCalendarDay", () => {
  it("resolves a midday UTC instant to the same BRT calendar day", () => {
    expect(getBrazilCalendarDay(new Date("2026-07-29T15:00:00Z"))).toBe(
      "2026-07-29",
    );
  });

  it("resolves a UTC instant just after midnight to the previous BRT day", () => {
    expect(getBrazilCalendarDay(new Date("2026-01-01T02:00:00Z"))).toBe(
      "2025-12-31",
    );
  });

  it("rolls over to the next BRT day exactly at 03:00 UTC", () => {
    expect(getBrazilCalendarDay(new Date("2026-07-30T03:00:00Z"))).toBe(
      "2026-07-30",
    );
  });
});
