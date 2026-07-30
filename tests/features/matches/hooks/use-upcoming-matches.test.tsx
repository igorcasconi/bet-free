import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { useUpcomingMatches } from "@/features/matches/hooks/use-upcoming-matches";
import type { UpcomingMatchesPage } from "@/features/matches/types";

const initialPage: UpcomingMatchesPage = {
  groups: [
    {
      competitionId: "comp-1",
      competitionName: "Brasileirão",
      matches: [],
    },
  ],
  nextCursor: { matchDate: "2026-08-01T00:00:00.000Z", id: "match-10" },
};

const secondPage: UpcomingMatchesPage = {
  groups: [
    {
      competitionId: "comp-2",
      competitionName: "Libertadores",
      matches: [],
    },
  ],
  nextCursor: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useUpcomingMatches", () => {
  it("renders the initial page with no network call", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpcomingMatches(initialPage), {
      wrapper: createWrapper(),
    });

    expect(result.current.data?.pages).toEqual([initialPage]);
    expect(result.current.hasNextPage).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the next page on fetchNextPage() and exposes hasNextPage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => secondPage,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpcomingMatches(initialPage), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.data?.pages).toEqual([initialPage, secondPage]);
    });
    expect(result.current.hasNextPage).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "cursorMatchDate=2026-08-01T00%3A00%3A00.000Z&cursorId=match-10",
      ),
    );
  });

  it("surfaces an error when fetching the next page fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpcomingMatches(initialPage), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "Failed to fetch upcoming matches",
    );
  });
});
