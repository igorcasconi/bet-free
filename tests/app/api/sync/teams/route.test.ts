import { afterEach, describe, expect, it, vi } from "vitest";

const { syncTeamsMock, SyncAlreadyRunningError } = vi.hoisted(() => ({
  syncTeamsMock: vi.fn(),
  SyncAlreadyRunningError: class SyncAlreadyRunningError extends Error {},
}));

vi.mock("@/features/sports-sync", () => ({
  matchSyncService: { syncTeams: syncTeamsMock },
  SyncAlreadyRunningError,
}));

vi.mock("@/lib/env", () => ({
  env: { SYNC_SECRET: "test-secret" },
}));

const { POST } = await import("@/app/api/sync/teams/route");

afterEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/sync/teams", {
    method: "POST",
    headers,
  });
}

describe("POST /api/sync/teams", () => {
  it("returns 401 and never calls the service when the header is missing/incorrect", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(syncTeamsMock).not.toHaveBeenCalled();
  });

  it("calls syncTeams and returns 200 with the result when the header is correct", async () => {
    syncTeamsMock.mockResolvedValue({ synced: 5 });

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ synced: 5 });
    expect(syncTeamsMock).toHaveBeenCalledTimes(1);
  });

  it("returns a generic 500 when the service throws", async () => {
    syncTeamsMock.mockRejectedValue(new Error("provider down"));

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain("provider down");
  });

  it("returns 409 when a sync is already running", async () => {
    syncTeamsMock.mockRejectedValue(
      new SyncAlreadyRunningError("already running"),
    );

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(409);
  });
});
