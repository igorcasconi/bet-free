export interface DashboardData {
  stats: {
    moneySaved: number;
    currentStreak: number;
    level: number;
    xpInLevel: number;
    xpToNextLevel: number;
    accuracyPercent: number;
  };
  todayMatches: DashboardMatch[];
  upcomingMatches: DashboardMatch[];
  latestPredictions: DashboardPrediction[];
}

export interface DashboardMatch {
  id: string;
  competitionName: string;
  matchDate: string;
  homeTeamName: string;
  homeTeamShort: string;
  awayTeamName: string;
  awayTeamShort: string;
  hasPrediction: boolean;
}

export interface DashboardPrediction {
  id: string;
  matchLabel: string;
  predictedScore: string;
  createdAt: string;
  pointsEarned: 0 | 1 | null;
}
