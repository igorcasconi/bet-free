import { env } from "@/lib/env";
import { TheSportsDBProvider } from "@/lib/sports-provider/thesportsdb-provider";
import type { SportsProvider } from "@/lib/sports-provider/types";

// Composition root: only place that instantiates TheSportsDBProvider.
// Everything else must import `sportsProvider` from here.
export const sportsProvider: SportsProvider = new TheSportsDBProvider(
  env.SPORTS_PROVIDER_API_KEY,
  env.SPORTS_PROVIDER_LEAGUE_IDS,
);
