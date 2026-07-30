import { describe, expect, it } from "vitest";

import { groupByCompetition } from "@/features/matches/lib/group-by-competition";
import type { MatchCardData } from "@/features/matches/types";

function match(overrides: Partial<MatchCardData>): MatchCardData {
  return {
    id: "match-1",
    competitionId: "comp-1",
    competitionName: "Competition 1",
    matchDate: "2026-07-29T15:00:00.000Z",
    status: "scheduled",
    homeTeamName: "Home",
    homeTeamShort: "HOM",
    awayTeamName: "Away",
    awayTeamShort: "AWY",
    prediction: null,
    ...overrides,
  };
}

describe("groupByCompetition", () => {
  it("returns an empty array for empty input", () => {
    expect(groupByCompetition([])).toEqual([]);
  });

  it("groups matches from a single competition into one group", () => {
    const matches = [match({ id: "m1" }), match({ id: "m2" })];

    const result = groupByCompetition(matches);

    expect(result).toEqual([
      {
        competitionId: "comp-1",
        competitionName: "Competition 1",
        matches: [matches[0], matches[1]],
      },
    ]);
  });

  it("preserves first-appearance order for interleaved competitions", () => {
    const a1 = match({
      id: "a1",
      competitionId: "comp-a",
      competitionName: "A",
    });
    const b1 = match({
      id: "b1",
      competitionId: "comp-b",
      competitionName: "B",
    });
    const a2 = match({
      id: "a2",
      competitionId: "comp-a",
      competitionName: "A",
    });
    const b2 = match({
      id: "b2",
      competitionId: "comp-b",
      competitionName: "B",
    });

    const result = groupByCompetition([a1, b1, a2, b2]);

    expect(result).toEqual([
      { competitionId: "comp-a", competitionName: "A", matches: [a1, a2] },
      { competitionId: "comp-b", competitionName: "B", matches: [b1, b2] },
    ]);
  });
});
