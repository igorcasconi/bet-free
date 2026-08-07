import { Flame, Target } from "lucide-react";

import { StatCard, XpProgressCard } from "@/features/dashboard";
import { MOCK_LANDING_STATS } from "@/features/landing/constants/mock-stats";

export function GamificationSection() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={Flame}
          iconClassName="bg-amber-100 text-amber-600"
          value={`${MOCK_LANDING_STATS.currentStreak} dias`}
          label="Sequência Atual"
        />
        <StatCard
          icon={Target}
          iconClassName="bg-emerald-100 text-emerald-600"
          value={`${MOCK_LANDING_STATS.accuracyPercent}%`}
          label="Precisão"
        />
      </div>

      <XpProgressCard
        level={MOCK_LANDING_STATS.level}
        xpInLevel={MOCK_LANDING_STATS.xpInLevel}
        xpToNextLevel={MOCK_LANDING_STATS.xpToNextLevel}
      />
    </div>
  );
}
