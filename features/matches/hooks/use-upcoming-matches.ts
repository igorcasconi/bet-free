"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/config/query-keys";
import type { UpcomingMatchesPage } from "@/features/matches/types";

type Cursor = { matchDate: string; id: string } | null;

async function fetchUpcomingMatches(
  cursor: Cursor,
): Promise<UpcomingMatchesPage> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursorMatchDate", cursor.matchDate);
    params.set("cursorId", cursor.id);
  }

  const response = await fetch(`/api/matches/upcoming?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch upcoming matches");
  }

  return response.json();
}

export function useUpcomingMatches(initialPage: UpcomingMatchesPage) {
  return useInfiniteQuery({
    queryKey: [...QUERY_KEYS.MATCHES, "upcoming"],
    queryFn: ({ pageParam }) => fetchUpcomingMatches(pageParam),
    initialPageParam: null as Cursor,
    getNextPageParam: (lastPage: UpcomingMatchesPage) => lastPage.nextCursor,
    initialData: { pages: [initialPage], pageParams: [null] },
    staleTime: Infinity,
  });
}
