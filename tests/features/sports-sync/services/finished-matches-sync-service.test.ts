import { afterEach, describe, expect, it, vi } from "vitest";

import { updateFinishedMatches } from "@/features/sports-sync/services/finished-matches-sync-service";

const {
  updateFinishedMatchesMock,
  updateFinishedMatchesMockAlt,
  inMock,
  ltMock,
  limitMock,
  selectMock,
  fromMock,
  updateMock,
  eqSourceMock,
  eqExternalIdMock,
  matchesSelectAfterUpdateMock,
} = vi.hoisted(() => ({
  updateFinishedMatchesMock: vi.fn(),
  updateFinishedMatchesMockAlt: vi.fn(),
  inMock: vi.fn(),
  ltMock: vi.fn(),
  limitMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  updateMock: vi.fn(),
  eqSourceMock: vi.fn(),
  eqExternalIdMock: vi.fn(),
  matchesSelectAfterUpdateMock: vi.fn(),
}));

vi.mock("@/lib/sports-provider", () => ({
  sportsProviders: [
    { source: "provider-a", updateFinishedMatches: updateFinishedMatchesMock },
    {
      source: "football-data",
      updateFinishedMatches: updateFinishedMatchesMockAlt,
    },
  ],
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function setupFromMock(): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "matches") return { select: selectMock, update: updateMock };
    throw new Error(`Unexpected table: ${table}`);
  });
  selectMock.mockReturnValue({ in: inMock });
  inMock.mockReturnValue({ lt: ltMock });
  ltMock.mockReturnValue({ limit: limitMock });
  updateMock.mockReturnValue({ eq: eqSourceMock });
  eqSourceMock.mockReturnValue({ eq: eqExternalIdMock });
  eqExternalIdMock.mockReturnValue({ select: matchesSelectAfterUpdateMock });
}

setupFromMock();

afterEach(() => {
  vi.clearAllMocks();
  setupFromMock();
});

describe("updateFinishedMatches", () => {
  it("groups stuck matches by competition and updates each returned match", async () => {
    limitMock.mockResolvedValue({
      data: [
        {
          id: "match-1",
          external_id: "1",
          competitions: { external_id: "4328", external_source: "provider-a" },
        },
        {
          id: "match-2",
          external_id: "2",
          competitions: { external_id: "4329", external_source: "provider-a" },
        },
      ],
      error: null,
    });
    updateFinishedMatchesMock.mockImplementation(
      async (externalCompetitionId: string) => [
        {
          externalId: externalCompetitionId === "4328" ? "1" : "2",
          externalCompetitionId,
          externalHomeTeamId: "100",
          externalAwayTeamId: "200",
          matchDate: "2024-01-30T15:00:00.000Z",
          round: "24",
          status: "finished",
          homeScore: 2,
          awayScore: 1,
        },
      ],
    );
    matchesSelectAfterUpdateMock.mockResolvedValue({
      data: [{ id: "match-1" }],
      error: null,
    });

    const result = await updateFinishedMatches();

    expect(inMock).toHaveBeenCalledWith("status", ["scheduled", "live"]);
    expect(updateFinishedMatchesMock).toHaveBeenCalledWith("4328");
    expect(updateFinishedMatchesMock).toHaveBeenCalledWith("4329");
    expect(result).toEqual({ updated: 2, ignored: 0 });
  });

  it("ignores a provider match with no corresponding local row", async () => {
    limitMock.mockResolvedValue({
      data: [
        {
          id: "match-1",
          external_id: "1",
          competitions: { external_id: "4328", external_source: "provider-a" },
        },
      ],
      error: null,
    });
    updateFinishedMatchesMock.mockResolvedValue([
      {
        externalId: "999999",
        externalCompetitionId: "4328",
        externalHomeTeamId: "100",
        externalAwayTeamId: "200",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "finished",
        homeScore: 3,
        awayScore: 0,
      },
    ]);
    matchesSelectAfterUpdateMock.mockResolvedValue({ data: [], error: null });

    const result = await updateFinishedMatches();

    expect(result).toEqual({ updated: 0, ignored: 1 });
  });

  it("is a no-op when there are no stuck matches", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    const result = await updateFinishedMatches();

    expect(updateFinishedMatchesMock).not.toHaveBeenCalled();
    expect(result).toEqual({ updated: 0, ignored: 0 });
  });

  it("dedupes by (external_source, external_id) pair and resolves each pair to its own provider", async () => {
    limitMock.mockResolvedValue({
      data: [
        {
          id: "match-1",
          external_id: "1",
          competitions: { external_id: "4328", external_source: "provider-a" },
        },
        {
          id: "match-2",
          external_id: "1",
          competitions: {
            external_id: "4328",
            external_source: "football-data",
          },
        },
      ],
      error: null,
    });
    updateFinishedMatchesMock.mockResolvedValue([
      {
        externalId: "1",
        externalCompetitionId: "4328",
        externalHomeTeamId: "100",
        externalAwayTeamId: "200",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "finished",
        homeScore: 2,
        awayScore: 1,
      },
    ]);
    updateFinishedMatchesMockAlt.mockResolvedValue([
      {
        externalId: "1",
        externalCompetitionId: "4328",
        externalHomeTeamId: "300",
        externalAwayTeamId: "400",
        matchDate: "2024-01-30T15:00:00.000Z",
        round: "24",
        status: "finished",
        homeScore: 0,
        awayScore: 0,
      },
    ]);
    matchesSelectAfterUpdateMock.mockResolvedValue({
      data: [{ id: "match-1" }],
      error: null,
    });

    const result = await updateFinishedMatches();

    expect(updateFinishedMatchesMock).toHaveBeenCalledWith("4328");
    expect(updateFinishedMatchesMock).toHaveBeenCalledTimes(1);
    expect(updateFinishedMatchesMockAlt).toHaveBeenCalledWith("4328");
    expect(updateFinishedMatchesMockAlt).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ updated: 2, ignored: 0 });
  });

  it("skips a competition with an unresolvable external_source without throwing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    limitMock.mockResolvedValue({
      data: [
        {
          id: "match-1",
          external_id: "1",
          competitions: {
            external_id: "4328",
            external_source: "unknown-source",
          },
        },
      ],
      error: null,
    });

    const result = await updateFinishedMatches();

    expect(updateFinishedMatchesMock).not.toHaveBeenCalled();
    expect(updateFinishedMatchesMockAlt).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unknown-source"),
    );
    expect(result).toEqual({ updated: 0, ignored: 0 });

    warnSpy.mockRestore();
  });
});
