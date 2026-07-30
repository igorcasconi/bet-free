import { afterEach, describe, expect, it, vi } from "vitest";

const { recomputeRankingsMock, withSyncLockMock } = vi.hoisted(() => ({
  recomputeRankingsMock: vi.fn(),
  withSyncLockMock: vi.fn(),
}));

vi.mock("@/features/ranking-engine", () => ({
  recomputeRankings: recomputeRankingsMock,
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
    withSyncLock: withSyncLockMock,
  };
});

vi.mock("@/lib/env", () => ({
  env: { SYNC_SECRET: "test-secret" },
}));

const { POST } = await import("@/app/api/rankings/process/route");
const { SyncAlreadyRunningError } = await import("@/features/sports-sync");

function passthroughLock(): void {
  withSyncLockMock.mockImplementation(
    (_type: string, fn: () => Promise<unknown>) => fn(),
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/rankings/process", {
    method: "POST",
    headers,
  });
}

describe("POST /api/rankings/process", () => {
  it("returns 401 and never calls the service when the header is missing/incorrect", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(withSyncLockMock).not.toHaveBeenCalled();
    expect(recomputeRankingsMock).not.toHaveBeenCalled();
  });

  it("calls recomputeRankings via withSyncLock('rankings', ...) and returns 200 with the result", async () => {
    passthroughLock();
    recomputeRankingsMock.mockResolvedValue({
      accuracyRanked: 3,
      disciplineRanked: 5,
      moneySavedRanked: 5,
    });

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accuracyRanked: 3,
      disciplineRanked: 5,
      moneySavedRanked: 5,
    });
    expect(withSyncLockMock).toHaveBeenCalledWith(
      "rankings",
      expect.any(Function),
    );
    expect(recomputeRankingsMock).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when another rankings run is already in progress", async () => {
    withSyncLockMock.mockRejectedValue(new SyncAlreadyRunningError("rankings"));

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(409);
  });

  it("returns a generic 500 when the service throws a plain error", async () => {
    passthroughLock();
    recomputeRankingsMock.mockRejectedValue(new Error("db down"));

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain("db down");
  });
});
