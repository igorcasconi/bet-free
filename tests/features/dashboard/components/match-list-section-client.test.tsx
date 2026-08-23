import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MatchCardData } from "@/features/matches/types";

vi.mock("@/features/matches/components/predict-dialog", () => ({
  PredictDialog: ({
    match,
    open,
    onOpenChange,
  }: {
    match: MatchCardData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="predict-dialog" data-open={open} data-match-id={match?.id ?? ""}>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close
      </button>
    </div>
  ),
}));

const { MatchListSectionClient } = await import(
  "@/features/dashboard/components/match-list-section-client"
);

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
  vi.clearAllMocks();
});

describe("MatchListSectionClient", () => {
  it("renders both sections' titles", () => {
    render(
      <MatchListSectionClient todayMatches={[]} upcomingMatches={[]} />,
    );

    expect(screen.getByText("Partidas de Hoje")).toBeInTheDocument();
    expect(screen.getByText("Próximas Partidas")).toBeInTheDocument();
  });

  it("opens the dialog with the matching match id when a Palpitar CTA is clicked", () => {
    const match = makeMatch({ id: "match-42" });

    render(
      <MatchListSectionClient
        todayMatches={[match]}
        upcomingMatches={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Palpitar" }));

    const dialog = screen.getByTestId("predict-dialog");
    expect(dialog).toHaveAttribute("data-open", "true");
    expect(dialog).toHaveAttribute("data-match-id", "match-42");
  });

  it("clears the selection when the dialog's onOpenChange(false) fires", () => {
    const match = makeMatch({ id: "match-42" });

    render(
      <MatchListSectionClient
        todayMatches={[match]}
        upcomingMatches={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Palpitar" }));
    expect(screen.getByTestId("predict-dialog")).toHaveAttribute(
      "data-open",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByTestId("predict-dialog")).toHaveAttribute(
      "data-open",
      "false",
    );
  });
});
