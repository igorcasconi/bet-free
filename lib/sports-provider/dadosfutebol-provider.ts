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

const BASE_URL = "https://api.dadosfutebol.com.br";

// status (raw) -> MatchStatus (domain). Exhaustive per spec.md AC4/AC5; any
// other raw value throws.
const STATUS_MAP: Record<string, MatchStatus> = {
  aguardando: "scheduled",
  ao_vivo: "live",
  encerrado: "finished",
  adiado: "postponed",
};

const campeonatoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  nome: z.string(),
  temporada: z.string(),
  logo_url: z.string().nullable(),
});

const campeonatoResponseSchema = z.object({ data: campeonatoSchema });

// Free plan blocks /partidas and /partidas/ao-vivo — teams and matches are
// derived from /tabela and /rodadas instead. Both only cover pontos-corridos
// competitions; mata-mata competitions return empty classificacao/rodadas.
const tabelaResponseSchema = z.object({
  data: z.object({
    classificacao: z.array(
      z.object({
        time: z.object({
          id: z.union([z.string(), z.number()]),
          nome: z.string(),
          escudo_url: z.string().nullable().optional(),
        }),
      }),
    ),
  }),
});

const rodadaTimeSchema = z.object({
  id: z.union([z.string(), z.number()]),
  nome: z.string(),
  escudo_url: z.string().nullable().optional(),
});

const rodadaPartidaSchema = z.object({
  id: z.union([z.string(), z.number()]),
  time_mandante: rodadaTimeSchema,
  time_visitante: rodadaTimeSchema,
  placar_mandante: z.number().nullable(),
  placar_visitante: z.number().nullable(),
  status: z.string(),
  data_hora_realizacao: z.string().nullable(),
});

const rodadaSchema = z.object({
  numero: z.number(),
  partidas: z.array(rodadaPartidaSchema),
});

const rodadasResponseSchema = z.object({
  data: z.array(rodadaSchema),
});

type RodadaPartida = z.infer<typeof rodadaPartidaSchema>;

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

function toProviderMatch(
  partida: RodadaPartida & { data_hora_realizacao: string },
  externalCompetitionId: string,
  round: number,
): ProviderMatch {
  return {
    externalId: toId(partida.id),
    externalCompetitionId,
    externalHomeTeamId: toId(partida.time_mandante.id),
    externalAwayTeamId: toId(partida.time_visitante.id),
    matchDate: partida.data_hora_realizacao,
    round: String(round),
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

  private async fetchMatches(
    externalCompetitionId: string,
  ): Promise<ProviderMatch[]> {
    const json = await fetchJson(
      `${BASE_URL}/v1/campeonatos/${encodeURIComponent(externalCompetitionId)}/rodadas`,
      this.authHeaders,
    );
    const parsed = rodadasResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected /v1/campeonatos/:id/rodadas response shape",
        parsed.error,
      );
    }

    return parsed.data.data.flatMap((rodada) =>
      rodada.partidas.flatMap((partida) => {
        if (partida.data_hora_realizacao === null) {
          console.warn(
            `Skipping dadosfutebol partida ${partida.id}: missing data_hora_realizacao`,
          );
          return [];
        }
        return [
          toProviderMatch(
            { ...partida, data_hora_realizacao: partida.data_hora_realizacao },
            externalCompetitionId,
            rodada.numero,
          ),
        ];
      }),
    );
  }

  async syncCompetitions(): Promise<ProviderCompetition[]> {
    const competitions = await Promise.all(
      this.configuredLeagueIds.map(async (id) => {
        const json = await fetchJson(
          `${BASE_URL}/v1/campeonatos/${encodeURIComponent(id)}`,
          this.authHeaders,
        );
        const parsed = campeonatoResponseSchema.safeParse(json);
        if (!parsed.success) {
          throw new SportsProviderError(
            "Unexpected /v1/campeonatos/:id response shape",
            parsed.error,
          );
        }
        return parsed.data.data;
      }),
    );

    return competitions.map((campeonato) => ({
      externalId: toId(campeonato.id),
      name: campeonato.nome,
      slug: toSlug(campeonato.nome),
      season: campeonato.temporada,
      logoUrl: campeonato.logo_url,
    }));
  }

  async syncTeams(externalCompetitionId: string): Promise<ProviderTeam[]> {
    const json = await fetchJson(
      `${BASE_URL}/v1/campeonatos/${encodeURIComponent(externalCompetitionId)}/tabela`,
      this.authHeaders,
    );
    const parsed = tabelaResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SportsProviderError(
        "Unexpected /v1/campeonatos/:id/tabela response shape",
        parsed.error,
      );
    }

    return parsed.data.data.classificacao.map(({ time }) => ({
      externalId: toId(time.id),
      name: time.nome,
      slug: toSlug(time.nome),
      logoUrl: time.escudo_url ?? null,
    }));
  }

  async syncMatches(
    externalCompetitionId: string,
    _season: string,
  ): Promise<ProviderMatch[]> {
    return this.fetchMatches(externalCompetitionId);
  }

  async updateLiveMatches(): Promise<ProviderMatch[]> {
    const matchesPerLeague = await Promise.all(
      this.configuredLeagueIds.map((id) => this.fetchMatches(id)),
    );

    return matchesPerLeague.flat().filter((match) => match.status === "live");
  }

  async updateFinishedMatches(
    externalCompetitionId: string,
  ): Promise<ProviderMatch[]> {
    const matches = await this.fetchMatches(externalCompetitionId);
    return matches.filter((match) => match.status === "finished");
  }
}
