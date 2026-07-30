import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MatchGroupSection } from "@/features/matches/components/match-group-section";
import type { MatchCardData, MatchGroup } from "@/features/matches/types";

function makeMatch(overrides: Partial<MatchCardData> = {}): MatchCardData {
  return {
    id: "match-1",
    competitionId: "comp-1",
    competitionName: "Brasileirão",
    matchDate: "2026-07-26T18:30:00.000Z",
    status: "scheduled",
    homeTeamName: "Flamengo",
    homeTeamShort: "FLA",
    awayTeamName: "Palmeiras",
    awayTeamShort: "PAL",
    prediction: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("MatchGroupSection", () => {
  it("renders the competition name as a header and one MatchCard per match, in order", () => {
    const group: MatchGroup = {
      competitionId: "comp-1",
      competitionName: "Brasileirão",
      matches: [
        makeMatch({ id: "match-1", homeTeamName: "Flamengo" }),
        makeMatch({ id: "match-2", homeTeamName: "Corinthians" }),
      ],
    };

    render(<MatchGroupSection group={group} onPredict={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Brasileirão" }),
    ).toBeInTheDocument();

    const teamNames = screen
      .getAllByText(/Flamengo|Corinthians/)
      .map((el) => el.textContent);
    expect(teamNames).toEqual(["Flamengo", "Corinthians"]);
  });
});
