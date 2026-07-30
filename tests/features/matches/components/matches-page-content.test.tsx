import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  MatchCardData,
  MatchGroup,
  UpcomingMatchesPage,
} from "@/features/matches/types";

const fetchNextPageMock = vi.fn();
const useUpcomingMatchesMock = vi.fn();

vi.mock("@/features/matches/hooks/use-upcoming-matches", () => ({
  useUpcomingMatches: (...args: unknown[]) => useUpcomingMatchesMock(...args),
}));

vi.mock("@/features/matches/components/predict-dialog", () => ({
  PredictDialog: ({
    match,
    open,
  }: {
    match: MatchCardData | null;
    open: boolean;
  }) => (
    <div
      data-testid="predict-dialog"
      data-open={open}
      data-match-id={match?.id ?? ""}
    />
  ),
}));

const { MatchesPageContent } =
  await import("@/features/matches/components/matches-page-content");

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

const emptyUpcomingPage: UpcomingMatchesPage = { groups: [], nextCursor: null };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockUpcoming(
  pages: MatchGroup[][],
  { hasNextPage = false }: { hasNextPage?: boolean } = {},
) {
  useUpcomingMatchesMock.mockReturnValue({
    data: { pages: pages.map((groups) => ({ groups, nextCursor: null })) },
    fetchNextPage: fetchNextPageMock,
    hasNextPage,
    isFetchingNextPage: false,
  });
}

describe("MatchesPageContent", () => {
  it("renders an empty state when todayGroups is empty", () => {
    mockUpcoming([[]]);

    render(
      <MatchesPageContent todayGroups={[]} upcomingPage={emptyUpcomingPage} />,
    );

    expect(screen.getByText("Nenhuma partida hoje.")).toBeInTheDocument();
  });

  it("renders an empty state when there are no upcoming matches", () => {
    mockUpcoming([[]]);

    render(
      <MatchesPageContent todayGroups={[]} upcomingPage={emptyUpcomingPage} />,
    );

    expect(screen.getByText("Nenhuma partida futura.")).toBeInTheDocument();
  });

  it("hides 'Carregar mais' when hasNextPage is false", () => {
    mockUpcoming([[]], { hasNextPage: false });

    render(
      <MatchesPageContent todayGroups={[]} upcomingPage={emptyUpcomingPage} />,
    );

    expect(
      screen.queryByRole("button", { name: "Carregar mais" }),
    ).not.toBeInTheDocument();
  });

  it("shows 'Carregar mais' when hasNextPage is true", () => {
    mockUpcoming([[]], { hasNextPage: true });

    render(
      <MatchesPageContent todayGroups={[]} upcomingPage={emptyUpcomingPage} />,
    );

    expect(
      screen.getByRole("button", { name: "Carregar mais" }),
    ).toBeInTheDocument();
  });

  it("calls fetchNextPage when 'Carregar mais' is clicked", () => {
    mockUpcoming([[]], { hasNextPage: true });

    render(
      <MatchesPageContent todayGroups={[]} upcomingPage={emptyUpcomingPage} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(fetchNextPageMock).toHaveBeenCalledTimes(1);
  });

  it("disables 'Carregar mais' while fetching the next page", () => {
    useUpcomingMatchesMock.mockReturnValue({
      data: { pages: [{ groups: [], nextCursor: null }] },
      fetchNextPage: fetchNextPageMock,
      hasNextPage: true,
      isFetchingNextPage: true,
    });

    render(
      <MatchesPageContent todayGroups={[]} upcomingPage={emptyUpcomingPage} />,
    );

    expect(
      screen.getByRole("button", { name: "Carregar mais" }),
    ).toBeDisabled();
  });

  it("opens PredictDialog for the clicked match's card CTA", () => {
    mockUpcoming([[]]);
    const match = makeMatch();
    const todayGroups: MatchGroup[] = [
      {
        competitionId: "comp-1",
        competitionName: "Brasileirão",
        matches: [match],
      },
    ];

    render(
      <MatchesPageContent
        todayGroups={todayGroups}
        upcomingPage={emptyUpcomingPage}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Predict" }));

    const dialog = screen.getByTestId("predict-dialog");
    expect(dialog).toHaveAttribute("data-open", "true");
    expect(dialog).toHaveAttribute("data-match-id", "match-1");
  });
});
