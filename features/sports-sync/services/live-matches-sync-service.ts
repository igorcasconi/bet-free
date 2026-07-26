import {
  DEFAULT_CONCURRENCY_LIMIT,
  mapWithConcurrency,
} from "@/lib/concurrency";
import { sportsProvider } from "@/lib/sports-provider";

import { updateMatchRow } from "./update-match-row";

export async function updateLiveMatches(): Promise<{
  updated: number;
  ignored: number;
}> {
  const matches = await sportsProvider.updateLiveMatches();

  const results = await mapWithConcurrency(
    matches,
    DEFAULT_CONCURRENCY_LIMIT,
    updateMatchRow,
  );

  return {
    updated: results.filter(Boolean).length,
    ignored: results.filter((found) => !found).length,
  };
}
