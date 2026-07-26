import { afterEach, describe, expect, it, vi } from "vitest";

import { syncTeams } from "@/features/sports-sync/services/teams-sync-service";

const { syncTeamsMock, competitionsSelectMock, teamsUpsertMock, fromMock } =
  vi.hoisted(() => ({
    syncTeamsMock: vi.fn(),
    competitionsSelectMock: vi.fn(),
    teamsUpsertMock: vi.fn(),
    fromMock: vi.fn(),
  }));

vi.mock("@/lib/sports-provider", () => ({
  sportsProvider: { source: "thesportsdb", syncTeams: syncTeamsMock },
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
      data: [{ external_id: "4328" }, { external_id: "4335" }],
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

    expect(syncTeamsMock).toHaveBeenNthCalledWith(1, "4328");
    expect(syncTeamsMock).toHaveBeenNthCalledWith(2, "4335");
    expect(teamsUpsertMock).toHaveBeenNthCalledWith(
      1,
      [
        {
          name: "Manchester United",
          slug: "manchester-united",
          logo_url: "https://example.com/badge.png",
          external_id: "133604",
          external_source: "thesportsdb",
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
    expect(teamsUpsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0 });
  });
});
