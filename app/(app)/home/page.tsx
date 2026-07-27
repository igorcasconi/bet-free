import { Flame, Target, Trophy } from "lucide-react";

import { getCurrentFirebaseUid } from "@/lib/auth/get-current-user";
import {
  LatestPredictionsSection,
  MatchListSection,
  MoneyPreservedCard,
  StatCard,
  XpProgressCard,
  getDashboardData,
} from "@/features/dashboard";

export default async function HomePage() {
  const firebaseUid = await getCurrentFirebaseUid();
  const { stats, todayMatches, upcomingMatches, latestPredictions } =
    await getDashboardData(firebaseUid);

  return (
    <div className="flex flex-col gap-6 p-6">
      <MoneyPreservedCard amount={stats.moneySaved} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Flame}
          iconClassName="bg-amber-100 text-amber-600"
          value={`${stats.currentStreak} dias`}
          label="Current Streak"
        />
        <StatCard
          icon={Target}
          iconClassName="bg-emerald-100 text-emerald-600"
          value={`${stats.accuracyPercent}%`}
          label="Accuracy"
        />
        <StatCard
          icon={Trophy}
          iconClassName="bg-indigo-100 text-indigo-600"
          value={`${stats.level}`}
          label="Level"
        />
      </div>

      <XpProgressCard
        level={stats.level}
        xpInLevel={stats.xpInLevel}
        xpToNextLevel={stats.xpToNextLevel}
      />

      <MatchListSection
        title="Today's Matches"
        matches={todayMatches}
        emptyMessage="No matches today"
      />

      <MatchListSection
        title="Upcoming Matches"
        matches={upcomingMatches}
        emptyMessage="No upcoming matches"
      />

      <LatestPredictionsSection predictions={latestPredictions} />
    </div>
  );
}
