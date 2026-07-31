import { afterEach, describe, expect, it, vi } from "vitest";

import { syncCompetitions } from "@/features/sports-sync/services/competitions-sync-service";

const { syncCompetitionsMockA, syncCompetitionsMockB, upsertMock, fromMock } =
  vi.hoisted(() => ({
    syncCompetitionsMockA: vi.fn(),
    syncCompetitionsMockB: vi.fn(),
    upsertMock: vi.fn(),
    fromMock: vi.fn(),
  }));

vi.mock("@/lib/sports-provider", () => ({
  sportsProviders: [
    { source: "dados-futebol", syncCompetitions: syncCompetitionsMockA },
    { source: "football-data", syncCompetitions: syncCompetitionsMockB },
  ],
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

fromMock.mockImplementation(() => ({ upsert: upsertMock }));

afterEach(() => {
  vi.clearAllMocks();
  fromMock.mockImplementation(() => ({ upsert: upsertMock }));
});

describe("syncCompetitions", () => {
  it("upserts normalized rows from the provider using the external key", async () => {
    syncCompetitionsMockA.mockResolvedValue([
      {
        externalId: "4328",
        name: "English Premier League",
        slug: "english-premier-league",
        season: "2023/2024",
        logoUrl: "https://example.com/logo.png",
      },
    ]);
    syncCompetitionsMockB.mockResolvedValue([]);
    upsertMock.mockResolvedValue({ error: null });

    const result = await syncCompetitions();

    expect(fromMock).toHaveBeenCalledWith("competitions");
    expect(upsertMock).toHaveBeenCalledWith(
      [
        {
          name: "English Premier League",
          slug: "english-premier-league",
          season: "2023/2024",
          logo_url: "https://example.com/logo.png",
          external_id: "4328",
          external_source: "dados-futebol",
        },
      ],
      { onConflict: "external_source,external_id" },
    );
    expect(result).toEqual({ synced: 1 });
  });

  it("propagates errors thrown by the provider without swallowing them", async () => {
    syncCompetitionsMockA.mockRejectedValue(new Error("provider down"));
    syncCompetitionsMockB.mockResolvedValue([]);

    await expect(syncCompetitions()).rejects.toThrow("provider down");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("aggregates rows from every provider into a single upsert call with distinct external_source values", async () => {
    syncCompetitionsMockA.mockResolvedValue([
      {
        externalId: "1",
        name: "Brasileirão",
        slug: "brasileirao",
        season: "2024",
        logoUrl: null,
      },
    ]);
    syncCompetitionsMockB.mockResolvedValue([
      {
        externalId: "2",
        name: "La Liga",
        slug: "la-liga",
        season: "2024/2025",
        logoUrl: null,
      },
    ]);
    upsertMock.mockResolvedValue({ error: null });

    const result = await syncCompetitions();

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [rows] = upsertMock.mock.calls[0];
    expect(
      rows.map((row: { external_source: string }) => row.external_source),
    ).toEqual(["dados-futebol", "football-data"]);
    expect(
      new Set(
        rows.map((row: { external_source: string }) => row.external_source),
      ).size,
    ).toBe(2);
    expect(result).toEqual({ synced: 2 });
  });

  it("does not upsert when every provider returns no competitions", async () => {
    syncCompetitionsMockA.mockResolvedValue([]);
    syncCompetitionsMockB.mockResolvedValue([]);

    const result = await syncCompetitions();

    expect(upsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0 });
  });
});
