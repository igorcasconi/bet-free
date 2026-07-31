import {
  DEFAULT_CONCURRENCY_LIMIT,
  mapWithConcurrency,
} from "@/lib/concurrency";
import { sportsProviders } from "@/lib/sports-provider";

import { updateMatchRow } from "./update-match-row";

export async function updateLiveMatches(): Promise<{
  updated: number;
  ignored: number;
}> {
  const results = await Promise.all(
    sportsProviders.map(async (provider) => {
      const matches = await provider.updateLiveMatches();

      return mapWithConcurrency(matches, DEFAULT_CONCURRENCY_LIMIT, (match) =>
        updateMatchRow(match, provider.source),
      );
    }),
  );

  const found = results.flat();

  return {
    updated: found.filter(Boolean).length,
    ignored: found.filter((match) => !match).length,
  };
}
