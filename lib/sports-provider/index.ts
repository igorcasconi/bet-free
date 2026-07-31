import { env } from "@/lib/env";
import { DadosFutebolProvider } from "@/lib/sports-provider/dadosfutebol-provider";
import { FootballDataProvider } from "@/lib/sports-provider/football-data-provider";
import type { SportsProvider } from "@/lib/sports-provider/types";

// Composition root: only place that instantiates concrete providers.
// Everything else must import `sportsProviders` from here.
export const sportsProviders: SportsProvider[] = [
  new DadosFutebolProvider(env.DADOS_FUTEBOL_API_KEY, env.SPORTS_BR_LEAGUE_IDS),
  new FootballDataProvider(env.FOOTBALL_DATA_API_KEY, env.SPORT_SA_LEAGUE_IDS),
];
