import * as z from "zod";

import { fetchJson } from "@/lib/sports-provider/http";
import { parseCommaList, toSlug } from "@/lib/sports-provider/normalize";
import type {
  MatchStatus,
  ProviderCompetition,
  ProviderMatch,
  ProviderTeam,
  SportsProvider,
} from "@/lib/sports-provider/types";
import { SportsProviderError } from "@/lib/sports-provider/types";

// Unverified against live API docs (see context.md Open Questions) — base
// URL is a reasonable assumption pending real API key validation.
const BASE_URL = "https://api.dadosfutebol.com.br";

const PAGE_SIZE = 100;
const MAX_PAGES = 1000;

// status (raw) -> MatchStatus (domain). Exhaustive per spec.md AC4/AC5; any
// other raw value throws.
const STATUS_MAP: Record<string, MatchStatus> = {
  aguardando: "scheduled",
  ao_vivo: "live",
  encerrado: "finished",
  adiado: "postponed",
};

// Field names below (nome, temporada, escudo, time_mandante, etc.) are
// assumed, unverified against live API — see context.md Open Questions.
const campeonatoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  nome: z.string(),
  temporada: z.string(),
  escudo: z.string().nullable(),
});

const timeSchema = z.object({
  id: z.union([z.string(), z.number()]),
  nome: z.string(),
  escudo: z.string().nullable().optional(),
});

const partidaSchema = z.object({
  id: z.union([z.string(), z.number()]),
  campeonato: z.object({ id: z.union([z.string(), z.number()]) }),
  time_mandante: timeSchema,
  time_visitante: timeSchema,
  data_hora_realizacao: z.string(),
  rodada: z.string().nullable(),
  status: z.string(),
  placar_mandante: z.number().nullable(),
  placar_visitante: z.number().nullable(),
});

const metaSchema = z.object({
  pagina_atual: z.number(),
  ultima_pagina: z.number(),
});

const partidasResponseSchema = z.object({
  data: z.array(partidaSchema),
  meta: metaSchema,
});

const partidasAoVivoResponseSchema = z.object({
  data: z.array(partidaSchema),
});

type Partida = z.infer<typeof partidaSchema>;

function toId(value: string | number): string {
  return String(value);
}

function mapStatus(rawStatus: string): MatchStatus {
  const status = STATUS_MAP[rawStatus];
  if (!status) {
    throw new SportsProviderError(`Unmapped dadosfutebol status: ${rawStatus}`);
  }
  return status;
}

function toProviderMatch(partida: Partida): ProviderMatch {
  return {
    externalId: toId(partida.id),
    externalCompetitionId: toId(partida.campeonato.id),
    externalHomeTeamId: toId(partida.time_mandante.id),
    externalAwayTeamId: toId(partida.time_visitante.id),
    matchDate: partida.data_hora_realizacao,
    round: partida.rodada,
    status: mapStatus(partida.status),
    homeScore: partida.placar_mandante,
    awayScore: partida.placar_visitante,
  };
}

export class DadosFutebolProvider implements SportsProvider {
  readonly source = "dadosfutebol";

  constructor(
    private readonly apiKey: string,
    private readonly leagueIds: string,
  ) {}

  private get authHeaders(): HeadersInit {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  private get configuredLeagueIds(): string[] {
    return parseCommaList(this.leagueIds);
  }

  private async fetchAllPages(
    path: string,
    params: URLSearchParams,
  ): Promise<Partida[]> {
    const partidas: Partida[] = [];
    let pagina = 1;

    for (;;) {
      if (pagina > MAX_PAGES) {
        throw new SportsProviderError(
          `${path} pagination exceeded ${MAX_PAGES} pages`,
        );
      }

      const pageParams = new URLSearchParams(params);
      pageParams.set("pagina", String(pagina));
      pageParams.set("por_pagina", String(PAGE_SIZE));

      const json = await fetchJson(
        `${BASE_URL}${path}?${pageParams.toString()}`,
        this.authHeaders,
      );
      const parsed = partidasResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new SportsProviderError(
          `Unexpected ${path} response shape`,
          parsed.error,
        );
      }

      partidas.push(...parsed.data.data);

      if (parsed.data.meta.pagina_atual >= parsed.data.meta.ultima_pagina) {
        break;
      }
      pagina += 1;
    }

    return partidas;
  }

  async syncCompetitions(): Promise<ProviderCompetition[]> {
    const competitions = await Promise.all(
      this.configuredLeagueIds.map(async (id) => {
        const json = await fetchJson(
          `${BASE_URL}/v1/campeonatos/${encodeURIComponent(id)}`,
          this.authHeaders,
        );
        const parsed = campeonatoSchema.safeParse(json);
        if (!parsed.success) {
          throw new SportsProviderError(
            "Unexpected /v1/campeonatos/:id response shape",
            parsed.error,
          );
        }
        return parsed.data;
      }),
    );

    return competitions.map((campeonato) => ({
      externalId: toId(campeonato.id),
      name: campeonato.nome,
      slug: toSlug(campeonato.nome),
      season: campeonato.temporada,
      logoUrl: campeonato.escudo,
    }));
  }

  async syncTeams(externalCompetitionId: string): Promise<ProviderTeam[]> {
    const partidas = await this.fetchAllPages(
      `/v1/campeonatos/${encodeURIComponent(externalCompetitionId)}/partidas`,
      new URLSearchParams(),
    );

    const teamsById = new Map<string, ProviderTeam>();
    for (const partida of partidas) {
      for (const time of [partida.time_mandante, partida.time_visitante]) {
        const externalId = toId(time.id);
        if (teamsById.has(externalId)) continue;
        teamsById.set(externalId, {
          externalId,
          name: time.nome,
          slug: toSlug(time.nome),
          logoUrl: time.escudo ?? null,
        });
      }
    }

    return Array.from(teamsById.values());
  }

  async syncMatches(
    externalCompetitionId: string,
    _season: string,
  ): Promise<ProviderMatch[]> {
    const partidas = await this.fetchAllPages(
      `/v1/campeonatos/${encodeURIComponent(externalCompetitionId)}/partidas`,
      new URLSearchParams(),
    );

    return partidas.map(toProviderMatch);
  }

  async updateLiveMatches(): Promise<ProviderMatch[]> {
    const json = await fetchJson(
      `${BASE_URL}/v1/partidas/ao-vivo`,
      this.authHeaders,
    );
    const parsed = partidasAoVivoResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected /v1/partidas/ao-vivo response shape",
        parsed.error,
      );
    }

    const configuredIds = new Set(this.configuredLeagueIds);
    return parsed.data.data
      .filter((partida) => configuredIds.has(toId(partida.campeonato.id)))
      .map(toProviderMatch);
  }

  async updateFinishedMatches(
    externalCompetitionId: string,
  ): Promise<ProviderMatch[]> {
    const partidas = await this.fetchAllPages(
      `/v1/campeonatos/${encodeURIComponent(externalCompetitionId)}/partidas`,
      new URLSearchParams(),
    );

    return partidas
      .filter((partida) => partida.status === "encerrado")
      .map(toProviderMatch);
  }
}
