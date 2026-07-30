import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPendingPredictions } from "@/features/prediction-processing/services/fetch-pending-predictions";

const { fromMock, selectMock, isMock, eqMock, limitMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  isMock: vi.fn(),
  eqMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function setupFromMock(): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "predictions") return { select: selectMock };
    throw new Error(`Unexpected table: ${table}`);
  });
  selectMock.mockReturnValue({ is: isMock });
  isMock.mockReturnValue({ eq: eqMock });
  eqMock.mockReturnValue({ limit: limitMock });
}

setupFromMock();

afterEach(() => {
  vi.clearAllMocks();
  setupFromMock();
});

describe("fetchPendingPredictions", () => {
  it("filters by points_earned IS NULL and matches.status = 'finished', mapping rows", async () => {
    limitMock.mockResolvedValue({
      data: [
        {
          id: "pred-1",
          user_id: "user-1",
          predicted_home_score: 2,
          predicted_away_score: 1,
          wagered_amount: 25.5,
          matches: {
            match_date: "2026-01-01T15:00:00.000Z",
            home_score: 3,
            away_score: 1,
            status: "finished",
          },
        },
        {
          id: "pred-2",
          user_id: "user-2",
          predicted_home_score: 0,
          predicted_away_score: 0,
          wagered_amount: null,
          matches: {
            match_date: "2026-01-02T15:00:00.000Z",
            home_score: 1,
            away_score: 1,
            status: "finished",
          },
        },
      ],
      error: null,
    });

    const result = await fetchPendingPredictions();

    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining("matches!inner"),
    );
    expect(isMock).toHaveBeenCalledWith("points_earned", null);
    expect(eqMock).toHaveBeenCalledWith("matches.status", "finished");
    expect(result).toEqual([
      {
        id: "pred-1",
        userId: "user-1",
        matchDate: "2026-01-01T15:00:00.000Z",
        predictedHomeScore: 2,
        predictedAwayScore: 1,
        homeScore: 3,
        awayScore: 1,
        wageredAmount: 25.5,
      },
      {
        id: "pred-2",
        userId: "user-2",
        matchDate: "2026-01-02T15:00:00.000Z",
        predictedHomeScore: 0,
        predictedAwayScore: 0,
        homeScore: 1,
        awayScore: 1,
        wageredAmount: null,
      },
    ]);
  });

  it("returns an empty array when there are no pending predictions", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    const result = await fetchPendingPredictions();

    expect(result).toEqual([]);
  });

  it("warns when the result hits the 500-row limit", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = Array.from({ length: 500 }, (_, i) => ({
      id: `pred-${i}`,
      user_id: `user-${i}`,
      predicted_home_score: 1,
      predicted_away_score: 0,
      wagered_amount: null,
      matches: {
        match_date: "2026-01-01T15:00:00.000Z",
        home_score: 1,
        away_score: 0,
        status: "finished",
      },
    }));
    limitMock.mockResolvedValue({ data: rows, error: null });

    await fetchPendingPredictions();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("500"));
    warnSpy.mockRestore();
  });
});
