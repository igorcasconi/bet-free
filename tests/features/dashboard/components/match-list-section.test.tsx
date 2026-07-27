import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MatchListSection } from "@/features/dashboard/components/match-list-section";
import type { DashboardMatch } from "@/features/dashboard/types";

const matches: DashboardMatch[] = [
  {
    id: "match-1",
    competitionName: "Premier League",
    matchDate: "2026-07-26T15:30:00.000Z",
    homeTeamName: "Arsenal",
    homeTeamShort: "ARS",
    awayTeamName: "Chelsea",
    awayTeamShort: "CHE",
    hasPrediction: false,
  },
  {
    id: "match-2",
    competitionName: "La Liga",
    matchDate: "2026-07-26T18:00:00.000Z",
    homeTeamName: "Barcelona",
    homeTeamShort: "BAR",
    awayTeamName: "Real Madrid",
    awayTeamShort: "RMA",
    hasPrediction: false,
  },
];

afterEach(() => {
  cleanup();
});

describe("MatchListSection", () => {
  it("renders the title and each match card", () => {
    render(
      <MatchListSection
        title="Today's Matches"
        matches={matches}
        emptyMessage="No matches today"
      />,
    );

    expect(screen.getByText("Today's Matches")).toBeInTheDocument();
    expect(screen.getByText("Arsenal")).toBeInTheDocument();
    expect(screen.getByText("Chelsea")).toBeInTheDocument();
    expect(screen.getByText("Barcelona")).toBeInTheDocument();
    expect(screen.getByText("Real Madrid")).toBeInTheDocument();
  });

  it("renders the empty message without erroring when there are no matches", () => {
    render(
      <MatchListSection
        title="Today's Matches"
        matches={[]}
        emptyMessage="No matches today"
      />,
    );

    expect(screen.getByText("No matches today")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
