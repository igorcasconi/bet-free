import { afterEach, describe, expect, it, vi } from "vitest";

import { syncMatches } from "@/features/sports-sync/services/matches-sync-service";

const {
  syncMatchesMock,
  syncMatchesMockAlt,
  competitionsSelectMock,
  teamsSelectMock,
  matchesUpsertMock,
  fromMock,
} = vi.hoisted(() => ({
  syncMatchesMock: vi.fn(),
  syncMatchesMockAlt: vi.fn(),
  competitionsSelectMock: vi.fn(),
  teamsSelectMock: vi.fn(),
  matchesUpsertMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/sports-provider", () => ({
  sportsProviders: [
    { source: "provider-a", syncMatches: syncMatchesMock },
    { source: "football-data", syncMatches: syncMatchesMockAlt },
  ],
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function setupFromMock(): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "competitions") return { select: competitionsSelectMock };
    if (table === "teams") return { select: teamsSelectMock };
    if (table === "matches") return { upsert: matchesUpsertMock };
    throw new Error(`Unexpected table: ${table}`);
  });
}

setupFromMock();

afterEach(() => {
  vi.clearAllMocks();
  setupFromMock();
});

describe("syncMatches", () => {
  it("resolves team ids by external_id and upserts matches", async () => {
    competitionsSelectMock.mockResolvedValue({
      data: [
        {
          id: "comp-1",
          external_id: "4328",
          external_source: "provider-a",
          season: "2023-2024",
        },
      ],
      error: null,
    });
    teamsSelectMock.mockResolvedValue({
      data: [
        { id: "team-home", external_id: "133602" },
        { id: "team-away", external_id: "133604" },
      ],
      error: null,
    });
    syncMatchesMock.mockResolvedValue([
      {
        externalId: "441613",
        externalCompetitionId: "4328",
        externalHomeTeamId: "133602",
        externalAwayTeamId: "133604",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "scheduled",
        homeScore: null,
        awayScore: null,
      },
    ]);
    matchesUpsertMock.mockResolvedValue({ error: null });

    const result = await syncMatches();

    expect(syncMatchesMock).toHaveBeenCalledWith("4328", "2023-2024");
    expect(matchesUpsertMock).toHaveBeenCalledWith(
      [
        {
          competition_id: "comp-1",
          home_team_id: "team-home",
          away_team_id: "team-away",
          match_date: "2024-01-30T15:00:00.000Z",
          round: "24",
          status: "scheduled",
          home_score: null,
          away_score: null,
          external_id: "441613",
          external_source: "provider-a",
        },
      ],
      { onConflict: "external_source,external_id" },
    );
    expect(result).toEqual({ synced: 1, skipped: 0 });
  });

  it("skips a match when a referenced team is not yet synced, without failing the sync", async () => {
    competitionsSelectMock.mockResolvedValue({
      data: [
        {
          id: "comp-1",
          external_id: "4328",
          external_source: "provider-a",
          season: "2023-2024",
        },
      ],
      error: null,
    });
    teamsSelectMock.mockResolvedValue({
      data: [{ id: "team-home", external_id: "133602" }],
      error: null,
    });
    syncMatchesMock.mockResolvedValue([
      {
        externalId: "441613",
        externalCompetitionId: "4328",
        externalHomeTeamId: "133602",
        externalAwayTeamId: "133604",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "scheduled",
        homeScore: null,
        awayScore: null,
      },
    ]);

    const result = await syncMatches();

    expect(matchesUpsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0, skipped: 1 });
  });

  it("skips a competition with no matching provider, without failing the sync", async () => {
    competitionsSelectMock.mockResolvedValue({
      data: [
        {
          id: "comp-1",
          external_id: "4328",
          external_source: "unknown-provider",
          season: "2023-2024",
        },
      ],
      error: null,
    });
    teamsSelectMock.mockResolvedValue({ data: [], error: null });

    const result = await syncMatches();

    expect(syncMatchesMock).not.toHaveBeenCalled();
    expect(syncMatchesMockAlt).not.toHaveBeenCalled();
    expect(matchesUpsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0, skipped: 1 });
  });
});
