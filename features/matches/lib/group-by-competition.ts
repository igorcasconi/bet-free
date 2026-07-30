import type { MatchCardData, MatchGroup } from "@/features/matches/types";

export function groupByCompetition(matches: MatchCardData[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();

  for (const match of matches) {
    const existing = groups.get(match.competitionId);

    if (existing) {
      existing.matches.push(match);
      continue;
    }

    groups.set(match.competitionId, {
      competitionId: match.competitionId,
      competitionName: match.competitionName,
      matches: [match],
    });
  }

  return [...groups.values()];
}
