import { Flame, Target, Trophy } from "lucide-react";

import { getCurrentFirebaseUid } from "@/lib/auth/get-current-user";
import {
  LatestPredictionsSection,
  MoneyPreservedCard,
  StatCard,
  XpProgressCard,
} from "@/features/dashboard";
import {
  AchievementsSection,
  ProfileHeader,
  getProfileData,
} from "@/features/profile";

export default async function ProfilePage() {
  const firebaseUid = await getCurrentFirebaseUid();
  const { identity, stats, achievements, latestPredictions } =
    await getProfileData(firebaseUid);

  return (
    <div className="flex flex-col gap-6 p-6">
      <ProfileHeader identity={identity} />

      <MoneyPreservedCard amount={stats.moneySaved} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Trophy}
          iconClassName="bg-indigo-100 text-indigo-600"
          value={`${stats.level}`}
          label="Level"
        />
        <StatCard
          icon={Target}
          iconClassName="bg-emerald-100 text-emerald-600"
          value={`${stats.accuracyPercent}%`}
          label="Accuracy"
        />
        <StatCard
          icon={Flame}
          iconClassName="bg-amber-100 text-amber-600"
          value={`${stats.currentStreak} dias`}
          label="Current Streak"
        />
      </div>

      <XpProgressCard
        level={stats.level}
        xpInLevel={stats.xpInLevel}
        xpToNextLevel={stats.xpToNextLevel}
      />

      <AchievementsSection achievements={achievements} />

      <LatestPredictionsSection predictions={latestPredictions} />
    </div>
  );
}
