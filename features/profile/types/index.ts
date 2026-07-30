import type { DashboardPrediction } from "@/features/dashboard";

export interface ProfileIdentity {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface ProfileAchievement {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  earnedAt: string;
}

export interface ProfileData {
  identity: ProfileIdentity;
  stats: {
    moneySaved: number;
    currentStreak: number;
    level: number;
    xpInLevel: number;
    xpToNextLevel: number;
    accuracyPercent: number;
  };
  achievements: ProfileAchievement[];
  latestPredictions: DashboardPrediction[];
}
