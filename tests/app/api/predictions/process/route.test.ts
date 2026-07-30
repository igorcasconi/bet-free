import { afterEach, describe, expect, it, vi } from "vitest";

const { processPendingPredictionsMock, withSyncLockMock } = vi.hoisted(() => ({
  processPendingPredictionsMock: vi.fn(),
  withSyncLockMock: vi.fn(),
}));

vi.mock("@/features/prediction-processing", () => ({
  processPendingPredictions: processPendingPredictionsMock,
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

const { POST } = await import("@/app/api/predictions/process/route");
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
  return new Request("http://localhost/api/predictions/process", {
    method: "POST",
    headers,
  });
}

describe("POST /api/predictions/process", () => {
  it("returns 401 and never calls the processor when the header is missing/incorrect", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(withSyncLockMock).not.toHaveBeenCalled();
    expect(processPendingPredictionsMock).not.toHaveBeenCalled();
  });

  it("calls processPendingPredictions via withSyncLock('predictions', ...) and returns 200 with the result", async () => {
    passthroughLock();
    processPendingPredictionsMock.mockResolvedValue({
      usersUpdated: 3,
      predictionsProcessed: 7,
    });

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      usersUpdated: 3,
      predictionsProcessed: 7,
    });
    expect(withSyncLockMock).toHaveBeenCalledWith(
      "predictions",
      expect.any(Function),
    );
    expect(processPendingPredictionsMock).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when another prediction processing run is already in progress", async () => {
    withSyncLockMock.mockRejectedValue(
      new SyncAlreadyRunningError("predictions"),
    );

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(409);
  });

  it("returns a generic 500 when the service throws a plain error", async () => {
    passthroughLock();
    processPendingPredictionsMock.mockRejectedValue(new Error("db down"));

    const response = await POST(
      makeRequest({ "x-sync-secret": "test-secret" }),
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain("db down");
  });
});
