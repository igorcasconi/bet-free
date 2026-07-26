import { syncCompetitions as syncCompetitionsService } from "./competitions-sync-service";
import { updateFinishedMatches as updateFinishedMatchesService } from "./finished-matches-sync-service";
import { updateLiveMatches as updateLiveMatchesService } from "./live-matches-sync-service";
import { syncMatches as syncMatchesService } from "./matches-sync-service";
import { withSyncLock } from "./sync-lock-service";
import { syncTeams as syncTeamsService } from "./teams-sync-service";

export class MatchSyncService {
  syncCompetitions(): Promise<{ synced: number }> {
    return withSyncLock("competitions", syncCompetitionsService);
  }

  syncTeams(): Promise<{ synced: number }> {
    return withSyncLock("teams", syncTeamsService);
  }

  syncMatches(): Promise<{ synced: number; skipped: number }> {
    return withSyncLock("matches", syncMatchesService);
  }

  updateLiveMatches(): Promise<{ updated: number; ignored: number }> {
    return withSyncLock("live", updateLiveMatchesService);
  }

  updateFinishedMatches(): Promise<{ updated: number; ignored: number }> {
    return withSyncLock("finished", updateFinishedMatchesService);
  }

  async runFullSync(): Promise<void> {
    await this.syncCompetitions();
    await this.syncTeams();
    await this.syncMatches();
    await this.updateLiveMatches();
    await this.updateFinishedMatches();
  }
}

export const matchSyncService = new MatchSyncService();
