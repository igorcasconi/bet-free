"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { QUERY_KEYS } from "@/config/query-keys";
import { submitPrediction } from "@/features/matches/actions/predictions";
import type { UpcomingMatchesPage } from "@/features/matches/types";
import { trackEvent } from "@/lib/analytics/track-event";

const UPCOMING_QUERY_KEY = [...QUERY_KEYS.MATCHES, "upcoming"];

function patchPrediction(
  data: InfiniteData<UpcomingMatchesPage> | undefined,
  matchId: string,
  predictedHomeScore: number,
  predictedAwayScore: number,
): InfiniteData<UpcomingMatchesPage> | undefined {
  if (!data) return data;

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      groups: page.groups.map((group) => ({
        ...group,
        matches: group.matches.map((match) =>
          match.id === matchId
            ? {
                ...match,
                prediction: {
                  id: match.prediction?.id ?? matchId,
                  predictedHomeScore,
                  predictedAwayScore,
                },
              }
            : match,
        ),
      })),
    })),
  };
}

export function useSubmitPrediction() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: submitPrediction,
    onSuccess: (result, variables) => {
      if (!result.ok) return;

      trackEvent("prediction_created");

      queryClient.setQueriesData<InfiniteData<UpcomingMatchesPage>>(
        { queryKey: UPCOMING_QUERY_KEY },
        (data) =>
          patchPrediction(
            data,
            variables.matchId,
            variables.predictedHomeScore,
            variables.predictedAwayScore,
          ),
      );

      // "Hoje" is server-rendered (not React Query), so a client-side patch
      // can't reach it — refresh the Server Component to pick up the change.
      router.refresh();
    },
  });
}
