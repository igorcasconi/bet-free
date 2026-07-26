import { afterEach, describe, expect, it, vi } from "vitest";

import { MatchSyncService } from "@/features/sports-sync/services/match-sync-service";

const {
  withSyncLockMock,
  syncCompetitionsMock,
  syncTeamsMock,
  syncMatchesMock,
  updateLiveMatchesMock,
  updateFinishedMatchesMock,
  SyncAlreadyRunningError,
} = vi.hoisted(() => {
  class SyncAlreadyRunningError extends Error {
    constructor(readonly type: string) {
      super(`Sync already running for type "${type}"`);
      this.name = "SyncAlreadyRunningError";
    }
  }

  return {
    withSyncLockMock: vi.fn(),
    syncCompetitionsMock: vi.fn(),
    syncTeamsMock: vi.fn(),
    syncMatchesMock: vi.fn(),
    updateLiveMatchesMock: vi.fn(),
    updateFinishedMatchesMock: vi.fn(),
    SyncAlreadyRunningError,
  };
});

vi.mock("@/features/sports-sync/services/sync-lock-service", () => ({
  withSyncLock: withSyncLockMock,
  SyncAlreadyRunningError,
}));

vi.mock("@/features/sports-sync/services/competitions-sync-service", () => ({
  syncCompetitions: syncCompetitionsMock,
}));

vi.mock("@/features/sports-sync/services/teams-sync-service", () => ({
  syncTeams: syncTeamsMock,
}));

vi.mock("@/features/sports-sync/services/matches-sync-service", () => ({
  syncMatches: syncMatchesMock,
}));

vi.mock("@/features/sports-sync/services/live-matches-sync-service", () => ({
  updateLiveMatches: updateLiveMatchesMock,
}));

vi.mock(
  "@/features/sports-sync/services/finished-matches-sync-service",
  () => ({
    updateFinishedMatches: updateFinishedMatchesMock,
  }),
);

function passthroughLock(): void {
  withSyncLockMock.mockImplementation(
    (_type: string, fn: () => Promise<unknown>) => fn(),
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("MatchSyncService", () => {
  it("syncCompetitions delegates via withSyncLock('competitions', ...)", async () => {
    passthroughLock();
    syncCompetitionsMock.mockResolvedValue({ synced: 3 });

    const result = await new MatchSyncService().syncCompetitions();

    expect(withSyncLockMock).toHaveBeenCalledWith(
      "competitions",
      expect.any(Function),
    );
    expect(syncCompetitionsMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ synced: 3 });
  });

  it("syncTeams delegates via withSyncLock('teams', ...)", async () => {
    passthroughLock();
    syncTeamsMock.mockResolvedValue({ synced: 5 });

    const result = await new MatchSyncService().syncTeams();

    expect(withSyncLockMock).toHaveBeenCalledWith(
      "teams",
      expect.any(Function),
    );
    expect(syncTeamsMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ synced: 5 });
  });

  it("syncMatches delegates via withSyncLock('matches', ...)", async () => {
    passthroughLock();
    syncMatchesMock.mockResolvedValue({ synced: 2, skipped: 1 });

    const result = await new MatchSyncService().syncMatches();

    expect(withSyncLockMock).toHaveBeenCalledWith(
      "matches",
      expect.any(Function),
    );
    expect(syncMatchesMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ synced: 2, skipped: 1 });
  });

  it("updateLiveMatches delegates via withSyncLock('live', ...)", async () => {
    passthroughLock();
    updateLiveMatchesMock.mockResolvedValue({ updated: 1, ignored: 0 });

    const result = await new MatchSyncService().updateLiveMatches();

    expect(withSyncLockMock).toHaveBeenCalledWith("live", expect.any(Function));
    expect(updateLiveMatchesMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ updated: 1, ignored: 0 });
  });

  it("updateFinishedMatches delegates via withSyncLock('finished', ...)", async () => {
    passthroughLock();
    updateFinishedMatchesMock.mockResolvedValue({ updated: 4, ignored: 2 });

    const result = await new MatchSyncService().updateFinishedMatches();

    expect(withSyncLockMock).toHaveBeenCalledWith(
      "finished",
      expect.any(Function),
    );
    expect(updateFinishedMatchesMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ updated: 4, ignored: 2 });
  });

  it("runFullSync executes the 5 methods in strict sequential order", async () => {
    passthroughLock();
    syncCompetitionsMock.mockResolvedValue({ synced: 0 });
    syncTeamsMock.mockResolvedValue({ synced: 0 });
    syncMatchesMock.mockResolvedValue({ synced: 0, skipped: 0 });
    updateLiveMatchesMock.mockResolvedValue({ updated: 0, ignored: 0 });
    updateFinishedMatchesMock.mockResolvedValue({ updated: 0, ignored: 0 });

    await new MatchSyncService().runFullSync();

    expect(withSyncLockMock.mock.calls.map((call) => call[0])).toEqual([
      "competitions",
      "teams",
      "matches",
      "live",
      "finished",
    ]);
  });

  it("interrupts subsequent steps in runFullSync when one step fails", async () => {
    passthroughLock();
    syncCompetitionsMock.mockResolvedValue({ synced: 0 });
    syncTeamsMock.mockRejectedValue(new Error("boom"));

    await expect(new MatchSyncService().runFullSync()).rejects.toThrow("boom");

    expect(withSyncLockMock.mock.calls.map((call) => call[0])).toEqual([
      "competitions",
      "teams",
    ]);
    expect(syncMatchesMock).not.toHaveBeenCalled();
    expect(updateLiveMatchesMock).not.toHaveBeenCalled();
    expect(updateFinishedMatchesMock).not.toHaveBeenCalled();
  });

  it("propagates SyncAlreadyRunningError without calling the underlying service", async () => {
    withSyncLockMock.mockRejectedValue(new SyncAlreadyRunningError("live"));

    await expect(new MatchSyncService().updateLiveMatches()).rejects.toThrow(
      SyncAlreadyRunningError,
    );
    expect(updateLiveMatchesMock).not.toHaveBeenCalled();
  });
});
