import { afterEach, describe, expect, it, vi } from "vitest";

import { getBrazilDayBounds } from "@/features/matches/lib/get-brazil-day-bounds";

afterEach(() => {
  vi.useRealTimers();
});

describe("getBrazilDayBounds", () => {
  it("returns today's BRT bounds for a midday UTC instant", () => {
    vi.setSystemTime(new Date("2026-07-29T15:00:00Z"));

    expect(getBrazilDayBounds()).toEqual({
      startOfToday: "2026-07-29T03:00:00.000Z",
      endOfToday: "2026-07-30T03:00:00.000Z",
    });
  });

  it("treats an instant that is 'tomorrow' in UTC but still 'today' in BRT correctly", () => {
    // 2026-07-30T02:00:00Z === 2026-07-29T23:00:00-03:00 (still the 29th in BRT)
    vi.setSystemTime(new Date("2026-07-30T02:00:00Z"));

    expect(getBrazilDayBounds()).toEqual({
      startOfToday: "2026-07-29T03:00:00.000Z",
      endOfToday: "2026-07-30T03:00:00.000Z",
    });
  });

  it("rolls over to the next BRT day exactly at 03:00 UTC", () => {
    vi.setSystemTime(new Date("2026-07-30T03:00:00Z"));

    expect(getBrazilDayBounds()).toEqual({
      startOfToday: "2026-07-30T03:00:00.000Z",
      endOfToday: "2026-07-31T03:00:00.000Z",
    });
  });
});
