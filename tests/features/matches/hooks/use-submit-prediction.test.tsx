import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { QUERY_KEYS } from "@/config/query-keys";
import type { UpcomingMatchesPage } from "@/features/matches/types";

const submitPredictionMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("@/features/matches/actions/predictions", () => ({
  submitPrediction: submitPredictionMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const { useSubmitPrediction } =
  await import("@/features/matches/hooks/use-submit-prediction");

const UPCOMING_QUERY_KEY = [...QUERY_KEYS.MATCHES, "upcoming"];

const initialPage: UpcomingMatchesPage = {
  groups: [
    {
      competitionId: "comp-1",
      competitionName: "Brasileirão",
      matches: [
        {
          id: "match-1",
          competitionId: "comp-1",
          competitionName: "Brasileirão",
          matchDate: "2026-08-01T15:00:00.000Z",
          status: "scheduled",
          homeTeamName: "Flamengo",
          homeTeamShort: "FLA",
          awayTeamName: "Palmeiras",
          awayTeamShort: "PAL",
          prediction: null,
        },
      ],
    },
  ],
  nextCursor: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(UPCOMING_QUERY_KEY, {
    pages: [initialPage],
    pageParams: [null],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSubmitPrediction", () => {
  it("patches the cached prediction and refreshes the router on a successful mutation", async () => {
    submitPredictionMock.mockResolvedValue({ ok: true });
    const { wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useSubmitPrediction(), { wrapper });

    act(() => {
      result.current.mutate({
        matchId: "match-1",
        predictedHomeScore: 2,
        predictedAwayScore: 1,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<{
      pages: UpcomingMatchesPage[];
    }>(UPCOMING_QUERY_KEY);
    expect(cached?.pages[0]?.groups[0]?.matches[0]?.prediction).toEqual({
      id: "match-1",
      predictedHomeScore: 2,
      predictedAwayScore: 1,
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("does not patch the cache or refresh the router when the mutation returns a business failure", async () => {
    submitPredictionMock.mockResolvedValue({
      ok: false,
      error: "match already started",
    });
    const { wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useSubmitPrediction(), { wrapper });

    act(() => {
      result.current.mutate({
        matchId: "match-1",
        predictedHomeScore: 2,
        predictedAwayScore: 1,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<{
      pages: UpcomingMatchesPage[];
    }>(UPCOMING_QUERY_KEY);
    expect(cached?.pages[0]?.groups[0]?.matches[0]?.prediction).toBeNull();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
