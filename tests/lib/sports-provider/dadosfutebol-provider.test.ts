import { afterEach, describe, expect, it, vi } from "vitest";

import { DadosFutebolProvider } from "@/lib/sports-provider/dadosfutebol-provider";
import { SportsProviderError } from "@/lib/sports-provider/types";

function mockFetchJson(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

function mockFetchJsonPerUrl(responses: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[url]),
      }),
    ),
  );
}

function makeProvider(): DadosFutebolProvider {
  return new DadosFutebolProvider("test-key", "1,2");
}

function makeSingleLeagueProvider(): DadosFutebolProvider {
  return new DadosFutebolProvider("test-key", "1");
}

function campeonato(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "1",
    nome: "Brasileirao",
    temporada: "2024",
    logo_url: null,
    ...overrides,
  };
}

function time(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "100", nome: "Flamengo", escudo_url: null, ...overrides };
}

function rodadaPartida(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "10",
    time_mandante: time({ id: "100", nome: "Flamengo" }),
    time_visitante: time({ id: "200", nome: "Palmeiras" }),
    data_hora_realizacao: "2024-05-01T20:00:00.000Z",
    status: "aguardando",
    placar_mandante: null,
    placar_visitante: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("constructor", () => {
  it("sends Authorization: Bearer header on requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: campeonato() }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await makeSingleLeagueProvider().syncCompetitions();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/campeonatos/1"),
      { headers: { Authorization: "Bearer test-key" } },
    );
  });
});

describe("syncCompetitions", () => {
  it("calls GET /v1/campeonatos/:id per configured id and accumulates results", async () => {
    mockFetchJsonPerUrl({
      "https://api.dadosfutebol.com.br/v1/campeonatos/1": {
        data: campeonato({
          id: "1",
          nome: "Brasileirao Serie A",
          logo_url: "https://example.com/a.png",
        }),
      },
      "https://api.dadosfutebol.com.br/v1/campeonatos/2": {
        data: campeonato({ id: 2, nome: "Copa do Brasil", logo_url: null }),
      },
    });

    const result = await makeProvider().syncCompetitions();

    expect(result).toEqual(
      expect.arrayContaining([
        {
          externalId: "1",
          name: "Brasileirao Serie A",
          slug: "brasileirao-serie-a",
          season: "2024",
          logoUrl: "https://example.com/a.png",
        },
        {
          externalId: "2",
          name: "Copa do Brasil",
          slug: "copa-do-brasil",
          season: "2024",
          logoUrl: null,
        },
      ]),
    );
    expect(result).toHaveLength(2);
  });
});

describe("syncTeams", () => {
  it("returns ProviderTeam[] derived from the standings table", async () => {
    mockFetchJson({
      data: {
        classificacao: [
          { time: time({ id: "100", nome: "Flamengo", escudo_url: null }) },
          {
            time: time({
              id: "200",
              nome: "Palmeiras",
              escudo_url: "https://example.com/pal.png",
            }),
          },
        ],
      },
    });

    const result = await makeProvider().syncTeams("1");

    expect(result).toEqual([
      {
        externalId: "100",
        name: "Flamengo",
        slug: "flamengo",
        logoUrl: null,
      },
      {
        externalId: "200",
        name: "Palmeiras",
        slug: "palmeiras",
        logoUrl: "https://example.com/pal.png",
      },
    ]);
  });

  it("returns an empty array for mata-mata competitions (empty classificacao)", async () => {
    mockFetchJson({ data: { classificacao: [] } });

    const result = await makeProvider().syncTeams("62");

    expect(result).toEqual([]);
  });
});

describe("syncMatches", () => {
  it("returns normalized ProviderMatch[] flattened across rodadas, ignoring the season param", async () => {
    mockFetchJson({
      data: [
        {
          numero: 10,
          partidas: [
            rodadaPartida({
              id: "10",
              status: "aguardando",
              placar_mandante: null,
              placar_visitante: null,
            }),
          ],
        },
      ],
    });

    const result = await makeProvider().syncMatches("1", "2024-unused");

    expect(result).toEqual([
      {
        externalId: "10",
        externalCompetitionId: "1",
        externalHomeTeamId: "100",
        externalAwayTeamId: "200",
        matchDate: "2024-05-01T20:00:00.000Z",
        round: "10",
        status: "scheduled",
        homeScore: null,
        awayScore: null,
      },
    ]);
  });

  it("skips partidas with a null data_hora_realizacao instead of throwing", async () => {
    mockFetchJson({
      data: [
        {
          numero: 10,
          partidas: [
            rodadaPartida({ id: "10", data_hora_realizacao: null }),
            rodadaPartida({ id: "11" }),
          ],
        },
      ],
    });

    const result = await makeProvider().syncMatches("1", "2024");

    expect(result).toEqual([expect.objectContaining({ externalId: "11" })]);
  });
});

describe("updateLiveMatches", () => {
  it("fetches rodadas per configured league id and filters to live matches", async () => {
    mockFetchJsonPerUrl({
      "https://api.dadosfutebol.com.br/v1/campeonatos/1/rodadas": {
        data: [
          {
            numero: 1,
            partidas: [
              rodadaPartida({
                id: "1",
                status: "ao_vivo",
                placar_mandante: 1,
                placar_visitante: 0,
              }),
            ],
          },
        ],
      },
      "https://api.dadosfutebol.com.br/v1/campeonatos/2/rodadas": {
        data: [
          {
            numero: 1,
            partidas: [rodadaPartida({ id: "2", status: "aguardando" })],
          },
        ],
      },
    });

    const result = await makeProvider().updateLiveMatches();

    expect(result).toEqual([
      expect.objectContaining({
        externalId: "1",
        externalCompetitionId: "1",
        status: "live",
        homeScore: 1,
        awayScore: 0,
      }),
    ]);
  });
});

describe("updateFinishedMatches", () => {
  it("returns only partidas with status encerrado", async () => {
    mockFetchJson({
      data: [
        {
          numero: 1,
          partidas: [
            rodadaPartida({
              id: "1",
              status: "encerrado",
              placar_mandante: 2,
              placar_visitante: 1,
            }),
            rodadaPartida({ id: "2", status: "aguardando" }),
          ],
        },
      ],
    });

    const result = await makeProvider().updateFinishedMatches("1");

    expect(result).toEqual([
      expect.objectContaining({
        externalId: "1",
        status: "finished",
        homeScore: 2,
        awayScore: 1,
      }),
    ]);
  });

  it("throws SportsProviderError when the response shape fails Zod validation", async () => {
    mockFetchJson({ unexpected: "shape" });

    await expect(
      makeSingleLeagueProvider().updateFinishedMatches("1"),
    ).rejects.toThrow(SportsProviderError);
  });

  it("throws SportsProviderError immediately on network failure, without retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      makeSingleLeagueProvider().updateFinishedMatches("1"),
    ).rejects.toThrow(SportsProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("status mapping", () => {
  it.each([
    ["aguardando", "scheduled"],
    ["ao_vivo", "live"],
    ["encerrado", "finished"],
    ["adiado", "postponed"],
  ] as const)("maps status %s to %s", async (raw, expected) => {
    mockFetchJson({
      data: [{ numero: 1, partidas: [rodadaPartida({ status: raw })] }],
    });

    const [match] = await makeProvider().syncMatches("1", "2024");

    expect(match.status).toBe(expected);
  });

  it("throws SportsProviderError for an unmapped status value", async () => {
    mockFetchJson({
      data: [
        {
          numero: 1,
          partidas: [rodadaPartida({ status: "algo_desconhecido" })],
        },
      ],
    });

    await expect(makeProvider().syncMatches("1", "2024")).rejects.toThrow(
      SportsProviderError,
    );
  });
});

describe("error handling", () => {
  it("throws SportsProviderError when the response shape fails Zod validation", async () => {
    mockFetchJson({ unexpected: "shape" });

    await expect(makeSingleLeagueProvider().syncCompetitions()).rejects.toThrow(
      SportsProviderError,
    );
  });

  it("throws SportsProviderError immediately on network failure, without retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(makeSingleLeagueProvider().syncCompetitions()).rejects.toThrow(
      SportsProviderError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws SportsProviderError on non-ok HTTP response", async () => {
    mockFetchJson({}, false, 500);

    await expect(makeSingleLeagueProvider().syncCompetitions()).rejects.toThrow(
      SportsProviderError,
    );
  });
});
