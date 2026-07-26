export type MatchStatus =
  "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export interface ProviderCompetition {
  externalId: string;
  name: string;
  slug: string;
  season: string;
  logoUrl: string | null;
}

export interface ProviderTeam {
  externalId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface ProviderMatch {
  externalId: string;
  externalCompetitionId: string;
  externalHomeTeamId: string;
  externalAwayTeamId: string;
  matchDate: string; // ISO 8601
  round: string | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}

export interface SportsProvider {
  readonly source: string;
  syncCompetitions(): Promise<ProviderCompetition[]>;
  syncTeams(externalCompetitionId: string): Promise<ProviderTeam[]>;
  syncMatches(
    externalCompetitionId: string,
    season: string,
  ): Promise<ProviderMatch[]>;
  updateLiveMatches(): Promise<ProviderMatch[]>;
  updateFinishedMatches(
    externalCompetitionId: string,
  ): Promise<ProviderMatch[]>;
}

export class SportsProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SportsProviderError";
  }
}
