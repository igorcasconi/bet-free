import type { MatchCardData } from "@/features/matches";

export interface DashboardData {
  stats: {
    moneySaved: number;
    currentStreak: number;
    level: number;
    xpInLevel: number;
    xpToNextLevel: number;
    accuracyPercent: number;
  };
  todayMatches: MatchCardData[];
  upcomingMatches: MatchCardData[];
  latestPredictions: DashboardPrediction[];
}

export interface DashboardPrediction {
  id: string;
  matchLabel: string;
  predictedScore: string;
  createdAt: string;
  pointsEarned: 0 | 1 | null;
}
