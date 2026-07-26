import { afterEach, describe, expect, it, vi } from "vitest";

import { updateMatchRow } from "@/features/sports-sync/services/update-match-row";

const { updateMock, eqSourceMock, eqExternalIdMock, selectMock, fromMock } =
  vi.hoisted(() => ({
    updateMock: vi.fn(),
    eqSourceMock: vi.fn(),
    eqExternalIdMock: vi.fn(),
    selectMock: vi.fn(),
    fromMock: vi.fn(),
  }));

vi.mock("@/lib/sports-provider", () => ({
  sportsProvider: {
    source: "thesportsdb",
  },
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

describe("updateMatchRow", () => {
  it("updates an existing match identified by external_id", async () => {
    selectMock.mockResolvedValue({ data: [{ id: "match-1" }], error: null });

    const result = await updateMatchRow({
      externalId: "441613",
      status: "live",
      homeScore: 1,
      awayScore: 0,
    });

    expect(updateMock).toHaveBeenCalledWith({
      status: "live",
      home_score: 1,
      away_score: 0,
    });
    expect(eqSourceMock).toHaveBeenCalledWith("external_source", "thesportsdb");
    expect(eqExternalIdMock).toHaveBeenCalledWith("external_id", "441613");
    expect(result).toBe(true);
  });

  it("returns false without throwing when match not found locally", async () => {
    selectMock.mockResolvedValue({ data: [], error: null });

    const result = await updateMatchRow({
      externalId: "999999",
      status: "live",
      homeScore: 2,
      awayScore: 2,
    });

    expect(result).toBe(false);
  });
});
