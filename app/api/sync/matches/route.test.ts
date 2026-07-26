import { afterEach, describe, expect, it, vi } from "vitest";

const { syncMatchesMock } = vi.hoisted(() => ({
  syncMatchesMock: vi.fn(),
}));

vi.mock("@/features/sports-sync", () => ({
  syncMatches: syncMatchesMock,
}));

vi.mock("@/lib/env", () => ({
  env: { SYNC_SECRET: "test-secret" },
}));

const { POST } = await import("./route");

afterEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/sync/matches", {
    method: "POST",
    headers,
  });
}

describe("POST /api/sync/matches", () => {
  it("returns 401 and never calls the service when the header is missing/incorrect", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(syncMatchesMock).not.toHaveBeenCalled();
  });

  it("calls syncMatches and returns 200 with the result when the header is correct", async () => {
    syncMatchesMock.mockResolvedValue({ synced: 4, skipped: 1 });

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ synced: 4, skipped: 1 });
    expect(syncMatchesMock).toHaveBeenCalledTimes(1);
  });

  it("returns a generic 500 when the service throws", async () => {
    syncMatchesMock.mockRejectedValue(new Error("provider down"));

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain("provider down");
  });
});
