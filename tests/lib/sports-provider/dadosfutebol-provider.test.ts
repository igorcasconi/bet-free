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

function partida(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "10",
    campeonato: { id: "1" },
    time_mandante: { id: "100", nome: "Flamengo", escudo: null },
    time_visitante: { id: "200", nome: "Palmeiras", escudo: null },
    data_hora_realizacao: "2024-05-01T20:00:00.000Z",
    rodada: "10",
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
      json: () =>
        Promise.resolve({
          id: "1",
          nome: "Brasileirao",
          temporada: "2024",
          escudo: null,
        }),
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
        id: "1",
        nome: "Brasileirao Serie A",
        temporada: "2024",
        escudo: "https://example.com/a.png",
      },
      "https://api.dadosfutebol.com.br/v1/campeonatos/2": {
        id: 2,
        nome: "Copa do Brasil",
        temporada: "2024",
        escudo: null,
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
  it("returns deduplicated ProviderTeam[] across 2 pages", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: [
                partida({
                  id: "1",
                  time_mandante: { id: "100", nome: "Flamengo", escudo: null },
                  time_visitante: {
                    id: "200",
                    nome: "Palmeiras",
                    escudo: null,
                  },
                }),
              ],
              meta: { pagina_atual: 1, ultima_pagina: 2 },
            }),
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: [
                partida({
                  id: "2",
                  time_mandante: { id: "100", nome: "Flamengo", escudo: null },
                  time_visitante: {
                    id: "300",
                    nome: "Corinthians",
                    escudo: "https://example.com/cor.png",
                  },
                }),
              ],
              meta: { pagina_atual: 2, ultima_pagina: 2 },
            }),
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeProvider().syncTeams("1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.arrayContaining([
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
          logoUrl: null,
        },
        {
          externalId: "300",
          name: "Corinthians",
          slug: "corinthians",
          logoUrl: "https://example.com/cor.png",
        },
      ]),
    );
    expect(result).toHaveLength(3);
  });

  it("returns an empty array when there are no partidas", async () => {
    mockFetchJson({ data: [], meta: { pagina_atual: 1, ultima_pagina: 1 } });

    const result = await makeProvider().syncTeams("1");

    expect(result).toEqual([]);
  });
});

describe("pagination", () => {
  it("stops after 1 call when the first page already satisfies pagina_atual >= ultima_pagina", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [partida()],
          meta: { pagina_atual: 1, ultima_pagina: 1 },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await makeProvider().syncMatches("1", "2024");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("syncMatches", () => {
  it("returns normalized ProviderMatch[] and ignores the season param", async () => {
    mockFetchJson({
      data: [
        partida({
          id: "10",
          status: "aguardando",
          placar_mandante: null,
          placar_visitante: null,
        }),
      ],
      meta: { pagina_atual: 1, ultima_pagina: 1 },
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
});

describe("updateLiveMatches", () => {
  it("calls GET /v1/partidas/ao-vivo and filters to configured league ids", async () => {
    mockFetchJson({
      data: [
        partida({
          id: "1",
          campeonato: { id: "1" },
          status: "ao_vivo",
          placar_mandante: 1,
          placar_visitante: 0,
        }),
        partida({
          id: "2",
          campeonato: { id: "999" },
          status: "ao_vivo",
        }),
      ],
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
        partida({
          id: "1",
          status: "encerrado",
          placar_mandante: 2,
          placar_visitante: 1,
        }),
        partida({ id: "2", status: "aguardando" }),
      ],
      meta: { pagina_atual: 1, ultima_pagina: 1 },
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
      data: [partida({ status: raw })],
      meta: { pagina_atual: 1, ultima_pagina: 1 },
    });

    const [match] = await makeProvider().syncMatches("1", "2024");

    expect(match.status).toBe(expected);
  });

  it("throws SportsProviderError for an unmapped status value", async () => {
    mockFetchJson({
      data: [partida({ status: "algo_desconhecido" })],
      meta: { pagina_atual: 1, ultima_pagina: 1 },
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
