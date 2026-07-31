import { afterEach, describe, expect, it, vi } from "vitest";

import { syncTeams } from "@/features/sports-sync/services/teams-sync-service";

const {
  syncTeamsMock,
  otherSyncTeamsMock,
  competitionsSelectMock,
  teamsUpsertMock,
  fromMock,
} = vi.hoisted(() => ({
  syncTeamsMock: vi.fn(),
  otherSyncTeamsMock: vi.fn(),
  competitionsSelectMock: vi.fn(),
  teamsUpsertMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/sports-provider", () => ({
  sportsProviders: [
    { source: "provider-a", syncTeams: syncTeamsMock },
    { source: "other-source", syncTeams: otherSyncTeamsMock },
  ],
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

function setupFromMock(): void {
  fromMock.mockImplementation((table: string) => {
    if (table === "competitions") return { select: competitionsSelectMock };
    if (table === "teams") return { upsert: teamsUpsertMock };
    throw new Error(`Unexpected table: ${table}`);
  });
}

setupFromMock();

afterEach(() => {
  vi.clearAllMocks();
  setupFromMock();
});

describe("syncTeams", () => {
  it("syncs teams for each already-synced competition and upserts them", async () => {
    competitionsSelectMock.mockResolvedValue({
      data: [
        { external_id: "2021", external_source: "provider-a" },
        { external_id: "2014", external_source: "provider-a" },
      ],
      error: null,
    });
    syncTeamsMock
      .mockResolvedValueOnce([
        {
          externalId: "133604",
          name: "Manchester United",
          slug: "manchester-united",
          logoUrl: "https://example.com/badge.png",
        },
      ])
      .mockResolvedValueOnce([
        {
          externalId: "133739",
          name: "Arsenal",
          slug: "arsenal",
          logoUrl: null,
        },
      ]);
    teamsUpsertMock.mockResolvedValue({ error: null });

    const result = await syncTeams();

    expect(syncTeamsMock).toHaveBeenNthCalledWith(1, "2021");
    expect(syncTeamsMock).toHaveBeenNthCalledWith(2, "2014");
    expect(teamsUpsertMock).toHaveBeenNthCalledWith(
      1,
      [
        {
          name: "Manchester United",
          slug: "manchester-united",
          logo_url: "https://example.com/badge.png",
          external_id: "133604",
          external_source: "provider-a",
        },
      ],
      { onConflict: "external_source,external_id" },
    );
    expect(result).toEqual({ synced: 2 });
  });

  it("does nothing and does not error when there are no competitions", async () => {
    competitionsSelectMock.mockResolvedValue({ data: [], error: null });

    const result = await syncTeams();

    expect(syncTeamsMock).not.toHaveBeenCalled();
    expect(otherSyncTeamsMock).not.toHaveBeenCalled();
    expect(teamsUpsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0 });
  });

  it("skips competitions with an unknown external_source without throwing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    competitionsSelectMock.mockResolvedValue({
      data: [
        { external_id: "999", external_source: "unknown-source" },
        { external_id: "2021", external_source: "provider-a" },
      ],
      error: null,
    });
    syncTeamsMock.mockResolvedValueOnce([
      {
        externalId: "133604",
        name: "Manchester United",
        slug: "manchester-united",
        logoUrl: "https://example.com/badge.png",
      },
    ]);
    teamsUpsertMock.mockResolvedValue({ error: null });

    const result = await syncTeams();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unknown-source"),
    );
    expect(syncTeamsMock).toHaveBeenCalledWith("2021");
    expect(otherSyncTeamsMock).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 1 });

    warnSpy.mockRestore();
  });
});
