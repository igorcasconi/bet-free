export interface MatchCardData {
  id: string;
  competitionId: string;
  competitionName: string;
  matchDate: string; // ISO, UTC — formatted client-side in America/Sao_Paulo
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  homeTeamName: string;
  homeTeamShort: string;
  awayTeamName: string;
  awayTeamShort: string;
  prediction: {
    id: string;
    predictedHomeScore: number;
    predictedAwayScore: number;
  } | null;
}

export interface MatchGroup {
  competitionId: string;
  competitionName: string;
  matches: MatchCardData[];
}

export interface UpcomingMatchesPage {
  groups: MatchGroup[];
  nextCursor: { matchDate: string; id: string } | null;
}
