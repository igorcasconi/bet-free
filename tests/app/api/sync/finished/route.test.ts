import { afterEach, describe, expect, it, vi } from "vitest";

const { updateFinishedMatchesMock } = vi.hoisted(() => ({
  updateFinishedMatchesMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {},
}));

vi.mock("@/features/sports-sync", async () => {
  const actual = await vi.importActual<typeof import("@/features/sports-sync")>(
    "@/features/sports-sync",
  );
  return {
    ...actual,
    matchSyncService: { updateFinishedMatches: updateFinishedMatchesMock },
  };
});

vi.mock("@/lib/env", () => ({
  env: { SYNC_SECRET: "test-secret" },
}));

const { POST } = await import("./route");
const { SyncAlreadyRunningError } = await import("@/features/sports-sync");

afterEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/sync/finished", {
    method: "POST",
    headers,
  });
}

describe("POST /api/sync/finished", () => {
  it("returns 401 and never calls the service when the header is missing/incorrect", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(updateFinishedMatchesMock).not.toHaveBeenCalled();
  });

  it("calls updateFinishedMatches and returns 200 with the result when the header is correct", async () => {
    updateFinishedMatchesMock.mockResolvedValue({ updated: 3, ignored: 1 });

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      updated: 3,
      ignored: 1,
    });
    expect(updateFinishedMatchesMock).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when the service is already running", async () => {
    updateFinishedMatchesMock.mockRejectedValue(
      new SyncAlreadyRunningError("finished"),
    );

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(409);
  });

  it("returns a generic 500 when the service throws a plain error", async () => {
    updateFinishedMatchesMock.mockRejectedValue(new Error("provider down"));

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain("provider down");
  });
});
