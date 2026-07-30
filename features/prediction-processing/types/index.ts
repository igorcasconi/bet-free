export interface PendingPrediction {
  id: string;
  userId: string;
  matchDate: string; // ISO
  predictedHomeScore: number;
  predictedAwayScore: number;
  homeScore: number;
  awayScore: number;
  wageredAmount: number | null;
}

export interface UserGamificationState {
  xp: number;
  level: number;
  moneySaved: number;
  currentStreak: number;
  lastStreakDate: string | null; // YYYY-MM-DD
}
