import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MatchCard } from "@/features/dashboard/components/match-card";
import type { DashboardMatch } from "@/features/dashboard/types";

const baseMatch: DashboardMatch = {
  id: "match-1",
  competitionName: "Premier League",
  matchDate: "2026-07-26T15:30:00.000Z",
  homeTeamName: "Arsenal",
  homeTeamShort: "ARS",
  awayTeamName: "Chelsea",
  awayTeamShort: "CHE",
  hasPrediction: false,
};

afterEach(() => {
  cleanup();
});

describe("MatchCard", () => {
  it("renders the competition name", () => {
    render(<MatchCard match={baseMatch} />);

    expect(screen.getByText("Premier League")).toBeInTheDocument();
  });

  it("renders a formatted time for the match date", () => {
    render(<MatchCard match={baseMatch} />);

    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it("renders both team names and initials", () => {
    render(<MatchCard match={baseMatch} />);

    expect(screen.getByText("Arsenal")).toBeInTheDocument();
    expect(screen.getByText("Chelsea")).toBeInTheDocument();
    expect(screen.getByText("ARS")).toBeInTheDocument();
    expect(screen.getByText("CHE")).toBeInTheDocument();
  });

  it("renders the Fazer Palpite button as disabled", () => {
    render(<MatchCard match={baseMatch} />);

    expect(
      screen.getByRole("button", { name: /fazer palpite/i }),
    ).toBeDisabled();
  });
});
