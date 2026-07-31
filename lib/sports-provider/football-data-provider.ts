import * as z from "zod";

import { createThrottledFetchJson } from "@/lib/sports-provider/http";
import { parseCommaList, toSlug } from "@/lib/sports-provider/normalize";
import type {
  MatchStatus,
  ProviderCompetition,
  ProviderMatch,
  ProviderTeam,
  SportsProvider,
} from "@/lib/sports-provider/types";
import { SportsProviderError } from "@/lib/sports-provider/types";

const BASE_URL = "https://api.football-data.org/v4";

// Raw football-data.org v4 `status` -> domain MatchStatus. Exhaustive per
// design.md; any other raw value is treated as unmapped and throws.
const STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "live",
  FINISHED: "finished",
  AWARDED: "finished",
  POSTPONED: "postponed",
  SUSPENDED: "postponed",
  CANCELLED: "cancelled",
};

// Field names below (id/name/currentSeason/emblem/crest/utcDate/matchday/
// score.fullTime) follow the football-data.org v4 docs as understood at
// design time; not yet verified against a live response (see context.md
// Open Questions).
const competitionSchema = z.object({
  id: z.number(),
  name: z.string(),
  currentSeason: z
    .object({
      startDate: z.string(),
    })
    .nullable(),
  emblem: z.string().nullable(),
});

const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  crest: z.string().nullable(),
});

const teamsResponseSchema = z.object({
  teams: z.array(teamSchema),
});

const matchSchema = z.object({
  id: z.number(),
  competition: z.object({ id: z.number() }),
  homeTeam: z.object({ id: z.number() }),
  awayTeam: z.object({ id: z.number() }),
  utcDate: z.string(),
  matchday: z.number().nullable(),
  status: z.string(),
  score: z.object({
    fullTime: z.object({
      home: z.number().nullable(),
      away: z.number().nullable(),
    }),
  }),
});

const matchesResponseSchema = z.object({
  matches: z.array(matchSchema),
});

function mapStatus(rawStatus: string): MatchStatus {
  const status = STATUS_MAP[rawStatus];
  if (!status) {
    throw new SportsProviderError(
      `Unmapped football-data status: ${rawStatus}`,
    );
  }
  return status;
}

function toProviderMatch(match: z.infer<typeof matchSchema>): ProviderMatch {
  return {
    externalId: String(match.id),
    externalCompetitionId: String(match.competition.id),
    externalHomeTeamId: String(match.homeTeam.id),
    externalAwayTeamId: String(match.awayTeam.id),
    matchDate: match.utcDate,
    round: match.matchday === null ? null : String(match.matchday),
    status: mapStatus(match.status),
    homeScore: match.score.fullTime.home,
    awayScore: match.score.fullTime.away,
  };
}

export class FootballDataProvider implements SportsProvider {
  readonly source = "football-data";

  private readonly throttledFetchJson = createThrottledFetchJson(6500);

  constructor(
    private readonly apiKey: string,
    private readonly leagueIds: string,
  ) {}

  private get configuredLeagueIds(): string[] {
    return parseCommaList(this.leagueIds);
  }

  private get headers(): HeadersInit {
    return { "X-Auth-Token": this.apiKey };
  }

  async syncCompetitions(): Promise<ProviderCompetition[]> {
    const competitions = await Promise.all(
      this.configuredLeagueIds.map(async (id) => {
        const json = await this.throttledFetchJson(
          `${BASE_URL}/competitions/${encodeURIComponent(id)}`,
          this.headers,
        );
        const parsed = competitionSchema.safeParse(json);
        if (!parsed.success) {
          throw new SportsProviderError(
            "Unexpected /competitions/:id response shape",
            parsed.error,
          );
        }
        return parsed.data;
      }),
    );

    return competitions.map((competition) => ({
      externalId: String(competition.id),
      name: competition.name,
      slug: toSlug(competition.name),
      // No current season published (e.g. off-season) -> empty string as a
      // sane, non-throwing fallback; callers treat "" as "unknown season".
      season: competition.currentSeason?.startDate.slice(0, 4) ?? "",
      logoUrl: competition.emblem,
    }));
  }

  async syncTeams(externalCompetitionId: string): Promise<ProviderTeam[]> {
    const json = await this.throttledFetchJson(
      `${BASE_URL}/competitions/${encodeURIComponent(externalCompetitionId)}/teams`,
      this.headers,
    );
    const parsed = teamsResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected /competitions/:id/teams response shape",
        parsed.error,
      );
    }

    return parsed.data.teams.map((team) => ({
      externalId: String(team.id),
      name: team.name,
      slug: toSlug(team.name),
      logoUrl: team.crest,
    }));
  }

  async syncMatches(
    externalCompetitionId: string,
    season: string,
  ): Promise<ProviderMatch[]> {
    const json = await this.throttledFetchJson(
      `${BASE_URL}/competitions/${encodeURIComponent(externalCompetitionId)}/matches?season=${encodeURIComponent(season)}`,
      this.headers,
    );
    const parsed = matchesResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected /competitions/:id/matches response shape",
        parsed.error,
      );
    }

    return parsed.data.matches.map(toProviderMatch);
  }

  async updateLiveMatches(): Promise<ProviderMatch[]> {
    const json = await this.throttledFetchJson(
      `${BASE_URL}/matches?status=LIVE`,
      this.headers,
    );
    const parsed = matchesResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected /matches?status=LIVE response shape",
        parsed.error,
      );
    }

    const configuredIds = new Set(this.configuredLeagueIds);
    return parsed.data.matches
      .filter((match) => configuredIds.has(String(match.competition.id)))
      .map(toProviderMatch);
  }

  async updateFinishedMatches(
    externalCompetitionId: string,
  ): Promise<ProviderMatch[]> {
    const json = await this.throttledFetchJson(
      `${BASE_URL}/competitions/${encodeURIComponent(externalCompetitionId)}/matches?status=FINISHED`,
      this.headers,
    );
    const parsed = matchesResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected /competitions/:id/matches?status=FINISHED response shape",
        parsed.error,
      );
    }

    return parsed.data.matches.map(toProviderMatch);
  }
}
