import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SyncAlreadyRunningError,
  withSyncLock,
} from "@/features/sports-sync/services/sync-lock-service";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock, rpc: rpcMock },
}));

interface Result {
  data?: unknown;
  error?: unknown;
}

interface Builder {
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  then: (resolve: (result: Result) => void) => Promise<void>;
}

function chainable(result: Result): Builder {
  const builder = {} as Builder;
  (["update", "eq"] as const).forEach((method) => {
    builder[method] = vi.fn(() => builder);
  });
  builder.then = (resolve) => Promise.resolve(result).then(resolve);
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("withSyncLock", () => {
  it("acquires lock, executes fn, marks finished on success", async () => {
    rpcMock.mockResolvedValue({ data: "lock-1", error: null });
    const finishBuilder = chainable({ error: null });
    fromMock.mockReturnValue(finishBuilder);

    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withSyncLock("competitions", fn);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith("acquire_sync_lock", {
      p_type: "competitions",
      p_stale_after_seconds: 600,
    });
    expect(finishBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "finished" }),
    );
    expect(finishBuilder.eq).toHaveBeenCalledWith("id", "lock-1");
  });

  it("throws SyncAlreadyRunningError when lock already running (not stale), never calls fn", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "23505" } });

    const fn = vi.fn();

    await expect(withSyncLock("teams", fn)).rejects.toThrow(
      SyncAlreadyRunningError,
    );
    expect(fn).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("reaps stale running lock (>10min) before acquiring, new run proceeds", async () => {
    rpcMock.mockResolvedValue({ data: "lock-2", error: null });
    fromMock.mockReturnValue(chainable({ error: null }));

    const fn = vi.fn().mockResolvedValue(undefined);
    await withSyncLock("matches", fn);

    // Reap-then-insert is fused server-side into acquire_sync_lock (see
    // migration 00000000000013) — a single RPC call handles both, with the
    // stale threshold passed as a parameter.
    expect(rpcMock).toHaveBeenCalledWith("acquire_sync_lock", {
      p_type: "matches",
      p_stale_after_seconds: 600,
    });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("marks lock failed and rethrows original error when fn throws", async () => {
    rpcMock.mockResolvedValue({ data: "lock-3", error: null });
    const finishBuilder = chainable({ error: null });
    fromMock.mockReturnValue(finishBuilder);

    const fn = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(withSyncLock("live", fn)).rejects.toThrow("boom");
    expect(finishBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("does not block one type while another type's lock is running", async () => {
    rpcMock.mockResolvedValueOnce({ data: "lock-live", error: null });
    fromMock.mockReturnValue(chainable({ error: null }));

    const fnLive = vi.fn().mockResolvedValue("live-result");
    const liveResult = await withSyncLock("live", fnLive);

    expect(liveResult).toBe("live-result");
    expect(rpcMock).toHaveBeenCalledWith("acquire_sync_lock", {
      p_type: "live",
      p_stale_after_seconds: 600,
    });

    rpcMock.mockResolvedValueOnce({ data: "lock-finished", error: null });

    const fnFinished = vi.fn().mockResolvedValue("finished-result");
    const finishedResult = await withSyncLock("finished", fnFinished);

    expect(finishedResult).toBe("finished-result");
    expect(rpcMock).toHaveBeenCalledWith("acquire_sync_lock", {
      p_type: "finished",
      p_stale_after_seconds: 600,
    });
    expect(fnLive).toHaveBeenCalledOnce();
    expect(fnFinished).toHaveBeenCalledOnce();
  });
});
