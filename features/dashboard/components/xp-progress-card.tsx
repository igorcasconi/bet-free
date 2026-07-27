import { Card, CardContent } from "@/components/ui/card";

interface XpProgressCardProps {
  level: number;
  xpInLevel: number;
  xpToNextLevel: number;
}

export function XpProgressCard({
  level,
  xpInLevel,
  xpToNextLevel,
}: XpProgressCardProps) {
  const percentage = Math.min(
    100,
    Math.max(0, (xpInLevel / xpToNextLevel) * 100),
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Level {level}</span>
          <span className="text-muted-foreground text-sm">
            {xpInLevel} / {xpToNextLevel}
          </span>
        </div>
        <div
          data-testid="xp-progress-bar-track"
          className="bg-muted h-2 w-full overflow-hidden rounded-full"
        >
          <div
            data-testid="xp-progress-bar-fill"
            className="bg-primary h-full rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-muted-foreground text-sm">
          {xpToNextLevel - xpInLevel} XP to level {level + 1}
        </span>
      </CardContent>
    </Card>
  );
}
