import { MatchCard } from "@/features/matches/components/match-card";
import type { MatchCardData, MatchGroup } from "@/features/matches/types";

interface MatchGroupSectionProps {
  group: MatchGroup;
  onPredict: (match: MatchCardData) => void;
}

export function MatchGroupSection({
  group,
  onPredict,
}: MatchGroupSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-muted-foreground text-sm font-semibold">
        {group.competitionName}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {group.matches.map((match) => (
          <MatchCard key={match.id} match={match} onPredict={onPredict} />
        ))}
      </div>
    </div>
  );
}
