import { afterEach, describe, expect, it, vi } from "vitest";

import { updateLiveMatches } from "@/features/sports-sync/services/live-matches-sync-service";

const {
  updateLiveMatchesMock,
  updateLiveMatchesMockAlt,
  updateMock,
  eqSourceMock,
  eqExternalIdMock,
  selectMock,
  fromMock,
} = vi.hoisted(() => ({
  updateLiveMatchesMock: vi.fn(),
  updateLiveMatchesMockAlt: vi.fn(),
  updateMock: vi.fn(),
  eqSourceMock: vi.fn(),
  eqExternalIdMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/sports-provider", () => ({
  sportsProviders: [
    { source: "provider-a", updateLiveMatches: updateLiveMatchesMock },
    { source: "football-data", updateLiveMatches: updateLiveMatchesMockAlt },
  ],
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function setupFromMock(): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "matches") return { update: updateMock };
    throw new Error(`Unexpected table: ${table}`);
  });
  updateMock.mockReturnValue({ eq: eqSourceMock });
  eqSourceMock.mockReturnValue({ eq: eqExternalIdMock });
  eqExternalIdMock.mockReturnValue({ select: selectMock });
}

setupFromMock();

afterEach(() => {
  vi.clearAllMocks();
  setupFromMock();
});

describe("updateLiveMatches", () => {
  it("updates an existing match identified by external_id", async () => {
    updateLiveMatchesMock.mockResolvedValue([
      {
        externalId: "441613",
        externalCompetitionId: "4328",
        externalHomeTeamId: "133602",
        externalAwayTeamId: "133604",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "live",
        homeScore: 1,
        awayScore: 0,
      },
    ]);
    updateLiveMatchesMockAlt.mockResolvedValue([]);
    selectMock.mockResolvedValue({ data: [{ id: "match-1" }], error: null });

    const result = await updateLiveMatches();

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "live",
        home_score: 1,
        away_score: 0,
      }),
    );
    expect(eqSourceMock).toHaveBeenCalledWith("external_source", "provider-a");
    expect(eqExternalIdMock).toHaveBeenCalledWith("external_id", "441613");
    expect(result).toEqual({ updated: 1, ignored: 0 });
  });

  it("ignores a match not found locally, without creating a row", async () => {
    updateLiveMatchesMock.mockResolvedValue([
      {
        externalId: "999999",
        externalCompetitionId: "4328",
        externalHomeTeamId: "133602",
        externalAwayTeamId: "133604",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "live",
        homeScore: 2,
        awayScore: 2,
      },
    ]);
    updateLiveMatchesMockAlt.mockResolvedValue([]);
    selectMock.mockResolvedValue({ data: [], error: null });

    const result = await updateLiveMatches();

    expect(result).toEqual({ updated: 0, ignored: 1 });
  });

  it("updates matches from multiple providers using each provider's own source", async () => {
    updateLiveMatchesMock.mockResolvedValue([
      {
        externalId: "441613",
        externalCompetitionId: "4328",
        externalHomeTeamId: "133602",
        externalAwayTeamId: "133604",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "live",
        homeScore: 1,
        awayScore: 0,
      },
    ]);
    updateLiveMatchesMockAlt.mockResolvedValue([
      {
        externalId: "777",
        externalCompetitionId: "9999",
        externalHomeTeamId: "1",
        externalAwayTeamId: "2",
        matchDate: "2024-02-01T15:00:00.000Z",
        round: "1",
        status: "live",
        homeScore: 2,
        awayScore: 2,
      },
    ]);
    selectMock.mockResolvedValue({ data: [{ id: "match-1" }], error: null });

    const result = await updateLiveMatches();

    expect(eqSourceMock).toHaveBeenCalledWith("external_source", "provider-a");
    expect(eqSourceMock).toHaveBeenCalledWith(
      "external_source",
      "football-data",
    );
    expect(eqExternalIdMock).toHaveBeenCalledWith("external_id", "441613");
    expect(eqExternalIdMock).toHaveBeenCalledWith("external_id", "777");
    expect(result).toEqual({ updated: 2, ignored: 0 });
  });
});
