import { Card } from "@/components/ui/card";
import type { ProfileAchievement } from "../types";

interface AchievementsSectionProps {
  achievements: ProfileAchievement[];
}

export function AchievementsSection({
  achievements,
}: AchievementsSectionProps) {
  if (achievements.length === 0) {
    return (
      <Card className="text-muted-foreground items-center justify-center px-6 py-8 text-center">
        Nenhuma conquista ainda
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {achievements.map((achievement) => (
        <Card key={achievement.id} className="px-6 py-4">
          <p className="font-medium">{achievement.name}</p>
          {achievement.description && (
            <p className="text-muted-foreground text-sm">
              {achievement.description}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
