import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MatchListSection } from "@/features/dashboard/components/match-list-section";
import type { MatchCardData } from "@/features/matches/types";

const matches: MatchCardData[] = [
  {
    id: "match-1",
    competitionId: "comp-1",
    competitionName: "Premier League",
    matchDate: "2026-07-26T15:30:00.000Z",
    status: "scheduled",
    homeTeamName: "Arsenal",
    homeTeamShort: "ARS",
    awayTeamName: "Chelsea",
    awayTeamShort: "CHE",
    prediction: null,
  },
  {
    id: "match-2",
    competitionId: "comp-2",
    competitionName: "La Liga",
    matchDate: "2026-07-26T18:00:00.000Z",
    status: "scheduled",
    homeTeamName: "Barcelona",
    homeTeamShort: "BAR",
    awayTeamName: "Real Madrid",
    awayTeamShort: "RMA",
    prediction: null,
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
        onPredict={vi.fn()}
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
        onPredict={vi.fn()}
      />,
    );

    expect(screen.getByText("No matches today")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
