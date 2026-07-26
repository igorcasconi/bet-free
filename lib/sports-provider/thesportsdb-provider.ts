import * as z from "zod";

import type {
  MatchStatus,
  ProviderCompetition,
  ProviderMatch,
  ProviderTeam,
  SportsProvider,
} from "@/lib/sports-provider/types";
import { SportsProviderError } from "@/lib/sports-provider/types";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";

// strStatus (raw) -> MatchStatus (domain). Exhaustive per design.md; any
// other raw value is treated as unmapped and throws (spec SPORTS-01 AC4).
const STATUS_MAP: Record<string, MatchStatus> = {
  "Not Started": "scheduled",
  "1H": "live",
  "2H": "live",
  HT: "live",
  ET: "live",
  Live: "live",
  "Match Finished": "finished",
  FT: "finished",
  AET: "finished",
  Awarded: "finished",
  Postponed: "postponed",
  Cancelled: "cancelled",
  Abandoned: "cancelled",
};

const leagueSchema = z.object({
  idLeague: z.string(),
  strLeague: z.string(),
  strCurrentSeason: z.string().nullable(),
  strLogo: z.string().nullable(),
});

const allLeaguesResponseSchema = z.object({
  leagues: z.array(leagueSchema).nullable(),
});

const teamSchema = z.object({
  idTeam: z.string(),
  strTeam: z.string(),
  strTeamBadge: z.string().nullable(),
});

const teamsResponseSchema = z.object({
  teams: z.array(teamSchema).nullable(),
});

const eventSchema = z.object({
  idEvent: z.string(),
  idLeague: z.string(),
  idHomeTeam: z.string(),
  idAwayTeam: z.string(),
  dateEvent: z.string(),
  strTime: z.string().nullable(),
  strStatus: z.string().nullable(),
  intRound: z.string().nullable(),
  intHomeScore: z.string().nullable(),
  intAwayScore: z.string().nullable(),
});

const eventsResponseSchema = z.object({
  events: z.array(eventSchema).nullable(),
});

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toISODateTime(dateEvent: string, strTime: string | null): string {
  const time = strTime && strTime.length > 0 ? strTime : "00:00:00";
  return new Date(`${dateEvent}T${time}Z`).toISOString();
}

function mapStatus(rawStatus: string | null): MatchStatus {
  const status = rawStatus && STATUS_MAP[rawStatus];
  if (!status) {
    throw new SportsProviderError(`Unmapped TheSportsDB status: ${rawStatus}`);
  }
  return status;
}

function toProviderNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new SportsProviderError("Failed to reach TheSportsDB API", cause);
  }
  if (!response.ok) {
    throw new SportsProviderError(
      `TheSportsDB API responded with status ${response.status}`,
    );
  }
  try {
    return await response.json();
  } catch (cause) {
    throw new SportsProviderError(
      "Failed to parse TheSportsDB API response as JSON",
      cause,
    );
  }
}

export class TheSportsDBProvider implements SportsProvider {
  readonly source = "thesportsdb";

  constructor(
    private readonly apiKey: string,
    private readonly leagueIds: string,
  ) {}

  private get baseUrl(): string {
    return `${BASE_URL}/${this.apiKey}`;
  }

  private get configuredLeagueIds(): string[] {
    return this.leagueIds.split(",").map((id) => id.trim());
  }

  async syncCompetitions(): Promise<ProviderCompetition[]> {
    const json = await fetchJson(`${this.baseUrl}/all_leagues.php`);
    const parsed = allLeaguesResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected all_leagues.php response shape",
        parsed.error,
      );
    }

    const configured = new Set(this.configuredLeagueIds);
    return (parsed.data.leagues ?? [])
      .filter((league) => configured.has(league.idLeague))
      .map((league) => ({
        externalId: league.idLeague,
        name: league.strLeague,
        slug: toSlug(league.strLeague),
        season: league.strCurrentSeason ?? "",
        logoUrl: league.strLogo,
      }));
  }

  async syncTeams(externalCompetitionId: string): Promise<ProviderTeam[]> {
    const json = await fetchJson(
      `${this.baseUrl}/lookup_all_teams.php?id=${encodeURIComponent(externalCompetitionId)}`,
    );
    const parsed = teamsResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected lookup_all_teams.php response shape",
        parsed.error,
      );
    }

    return (parsed.data.teams ?? []).map((team) => ({
      externalId: team.idTeam,
      name: team.strTeam,
      slug: toSlug(team.strTeam),
      logoUrl: team.strTeamBadge,
    }));
  }

  async syncMatches(
    externalCompetitionId: string,
    season: string,
  ): Promise<ProviderMatch[]> {
    const json = await fetchJson(
      `${this.baseUrl}/eventsseason.php?id=${encodeURIComponent(externalCompetitionId)}&s=${encodeURIComponent(season)}`,
    );
    const parsed = eventsResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected eventsseason.php response shape",
        parsed.error,
      );
    }

    return (parsed.data.events ?? []).map((event) => ({
      externalId: event.idEvent,
      externalCompetitionId: event.idLeague,
      externalHomeTeamId: event.idHomeTeam,
      externalAwayTeamId: event.idAwayTeam,
      matchDate: toISODateTime(event.dateEvent, event.strTime),
      round: event.intRound,
      status: mapStatus(event.strStatus),
      homeScore: toProviderNumber(event.intHomeScore),
      awayScore: toProviderNumber(event.intAwayScore),
    }));
  }

  // v1 free tier has no real livescore endpoint (that's API v2, paid key).
  // Approximation: pull today's Soccer fixtures across leagues and let the
  // service reconcile against already-synced matches by externalId. See
  // design.md / context.md for the documented limitation.
  async updateLiveMatches(): Promise<ProviderMatch[]> {
    const today = new Date().toISOString().slice(0, 10);
    const json = await fetchJson(
      `${this.baseUrl}/eventsday.php?d=${today}&s=Soccer`,
    );
    const parsed = eventsResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected eventsday.php response shape",
        parsed.error,
      );
    }

    return (parsed.data.events ?? []).map((event) => ({
      externalId: event.idEvent,
      externalCompetitionId: event.idLeague,
      externalHomeTeamId: event.idHomeTeam,
      externalAwayTeamId: event.idAwayTeam,
      matchDate: toISODateTime(event.dateEvent, event.strTime),
      round: event.intRound,
      status: mapStatus(event.strStatus),
      homeScore: toProviderNumber(event.intHomeScore),
      awayScore: toProviderNumber(event.intAwayScore),
    }));
  }

  async updateFinishedMatches(
    externalCompetitionId: string,
  ): Promise<ProviderMatch[]> {
    const json = await fetchJson(
      `${this.baseUrl}/eventspastleague.php?id=${encodeURIComponent(externalCompetitionId)}`,
    );
    const parsed = eventsResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected eventspastleague.php response shape",
        parsed.error,
      );
    }

    return (parsed.data.events ?? []).map((event) => ({
      externalId: event.idEvent,
      externalCompetitionId: event.idLeague,
      externalHomeTeamId: event.idHomeTeam,
      externalAwayTeamId: event.idAwayTeam,
      matchDate: toISODateTime(event.dateEvent, event.strTime),
      round: event.intRound,
      status: mapStatus(event.strStatus),
      homeScore: toProviderNumber(event.intHomeScore),
      awayScore: toProviderNumber(event.intAwayScore),
    }));
  }
}
