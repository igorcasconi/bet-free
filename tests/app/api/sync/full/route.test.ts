import { afterEach, describe, expect, it, vi } from "vitest";

const { runFullSyncMock } = vi.hoisted(() => ({
  runFullSyncMock: vi.fn(),
}));

vi.mock("@/features/sports-sync", async () => {
  const actual = await vi.importActual<typeof import("@/features/sports-sync")>(
    "@/features/sports-sync",
  );
  return {
    ...actual,
    matchSyncService: { runFullSync: runFullSyncMock },
  };
});

vi.mock("@/lib/env", () => ({
  env: { SYNC_SECRET: "test-secret" },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {},
}));

const { POST } = await import("@/app/api/sync/full/route");

afterEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/sync/full", {
    method: "POST",
    headers,
  });
}

describe("POST /api/sync/full", () => {
  it("returns 401 and never calls the service when the header is missing/incorrect", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(runFullSyncMock).not.toHaveBeenCalled();
  });

  it("calls runFullSync and returns 200 with an empty body when the header is correct", async () => {
    runFullSyncMock.mockResolvedValue(undefined);

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({});
    expect(runFullSyncMock).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when the service throws SyncAlreadyRunningError", async () => {
    const { SyncAlreadyRunningError } = await vi.importActual<
      typeof import("@/features/sports-sync")
    >("@/features/sports-sync");
    runFullSyncMock.mockRejectedValue(new SyncAlreadyRunningError("matches"));

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(409);
  });

  it("returns a generic 500 when the service throws a plain error", async () => {
    runFullSyncMock.mockRejectedValue(new Error("provider down"));

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain("provider down");
  });
});
