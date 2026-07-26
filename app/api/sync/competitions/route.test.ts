import { afterEach, describe, expect, it, vi } from "vitest";

const { syncCompetitionsMock } = vi.hoisted(() => ({
  syncCompetitionsMock: vi.fn(),
}));

vi.mock("@/features/sports-sync", () => ({
  syncCompetitions: syncCompetitionsMock,
}));

vi.mock("@/lib/env", () => ({
  env: { SYNC_SECRET: "test-secret" },
}));

const { POST } = await import("./route");

afterEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/sync/competitions", {
    method: "POST",
    headers,
  });
}

describe("POST /api/sync/competitions", () => {
  it("returns 401 and never calls the service when the header is missing/incorrect", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(syncCompetitionsMock).not.toHaveBeenCalled();
  });

  it("calls syncCompetitions and returns 200 with the result when the header is correct", async () => {
    syncCompetitionsMock.mockResolvedValue({ synced: 3 });

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ synced: 3 });
    expect(syncCompetitionsMock).toHaveBeenCalledTimes(1);
  });

  it("returns a generic 500 when the service throws", async () => {
    syncCompetitionsMock.mockRejectedValue(new Error("provider down"));

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain("provider down");
  });
});
