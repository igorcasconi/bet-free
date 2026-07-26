import { afterEach, describe, expect, it, vi } from "vitest";

import { syncCompetitions } from "@/features/sports-sync/services/competitions-sync-service";

const { syncCompetitionsMock, upsertMock, fromMock } = vi.hoisted(() => ({
  syncCompetitionsMock: vi.fn(),
  upsertMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/sports-provider", () => ({
  sportsProvider: {
    source: "thesportsdb",
    syncCompetitions: syncCompetitionsMock,
  },
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
    syncCompetitionsMock.mockResolvedValue([
      {
        externalId: "4328",
        name: "English Premier League",
        slug: "english-premier-league",
        season: "2023/2024",
        logoUrl: "https://example.com/logo.png",
      },
    ]);
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
          external_source: "thesportsdb",
        },
      ],
      { onConflict: "external_source,external_id" },
    );
    expect(result).toEqual({ synced: 1 });
  });

  it("propagates errors thrown by the provider without swallowing them", async () => {
    syncCompetitionsMock.mockRejectedValue(new Error("provider down"));

    await expect(syncCompetitions()).rejects.toThrow("provider down");
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
