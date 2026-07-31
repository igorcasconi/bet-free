# Sports Provider Swap (Multi-Provider) Specification

**Context**: `.specs/features/sports-provider-swap/context.md`
**Base architecture reference**: `.specs/features/sports-provider/` (interface `SportsProvider` original)

## Problem Statement

`TheSportsDBProvider` é a única implementação ativa de `SportsProvider`, e o
free tier da TheSportsDB não cobre adequadamente os campeonatos que o produto
precisa (Brasileirão, Copa do Brasil, Libertadores, Sudamericana) com a
qualidade de dados necessária. Sem trocar de fonte, a sincronização de
competições/times/partidas continua limitada a uma API que não atende ao
domínio real do produto (futebol brasileiro + competições continentais
CONMEBOL).

## Proposed Solution

Substituir `TheSportsDBProvider` por **dois providers ativos ao mesmo tempo**,
cada um implementando a interface `SportsProvider` já existente sem alterar
seu contrato:

- `DadosFutebolProvider` (`api.dadosfutebol.com.br`) — Brasileirão Série A e
  Copa do Brasil, configurados via `SPORTS_BR_LEAGUE_IDS`.
- `FootballDataProvider` (`football-data.org`, API v4) — Copa Libertadores e
  Copa Sudamericana, configurados via `SPORT_SA_LEAGUE_IDS`.

`lib/sports-provider/index.ts` passa a exportar `sportsProviders:
SportsProvider[]` no lugar do singleton `sportsProvider`. Os services de
`features/sports-sync/services/*` iteram sobre os providers configurados
(para operações globais) ou resolvem o provider certo por
`external_source` da linha (para operações por-competição), sem que a lógica
de negócio precise conhecer o formato bruto de nenhuma das duas APIs — os
DTOs normalizados (`ProviderCompetition`, `ProviderTeam`, `ProviderMatch`)
continuam sendo o único contrato que os services enxergam.

## Goals

- [x] `TheSportsDBProvider` e suas env vars (`SPORTS_PROVIDER_API_KEY`,
      `SPORTS_PROVIDER_LEAGUE_IDS`) são removidos do código
- [x] `DadosFutebolProvider` e `FootballDataProvider` implementam os 5 métodos
      de `SportsProvider` (`syncCompetitions`, `syncTeams`, `syncMatches`,
      `updateLiveMatches`, `updateFinishedMatches`) retornando DTOs
      normalizados idênticos em shape aos já usados hoje
- [x] Todos os services de `features/sports-sync/services/*` operam
      corretamente com 2 providers simultâneos, sem duplicar ou perder
      registros por competição/time/partida
- [x] Nenhum código fora de `lib/sports-provider/` conhece o shape bruto do
      dadosfutebol.com.br ou do football-data.org
- [x] O FootballDataProvider nunca excede 10 requisições/minuto (rate limit
      do free tier), mesmo com múltiplas competições/temporadas configuradas

## Out of Scope

| Feature                                                                 | Reason                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Migração/limpeza de dados `external_source='thesportsdb'` já existentes | Deferred — não há sync real em produção a preservar, ver `context.md` decisão 3            |
| Retry automático / backoff em falhas de API externa (incl. HTTP 429)    | Decisão explícita: falha imediata, sem retry embutido, ver `context.md`                    |
| Webhooks do dadosfutebol.com.br como alternativa a polling              | Não avaliado nesta rodada — sync continua via endpoints acionados manualmente/cron externo |
| Descoberta/validação dos IDs reais de configuração                      | Fica como placeholder no `.env`, ver Open Questions abaixo                                 |
| UI/exibição dos dados sincronizados                                     | Fora de escopo desde a feature original `sports-provider`                                  |

---

## User Stories

### P1: DadosFutebolProvider — Brasileirão e Copa do Brasil ⭐ MVP

**User Story**: Como sistema, preciso sincronizar competições, times e
partidas do Brasileirão Série A e da Copa do Brasil a partir da API
dadosfutebol.com.br, para que o produto tenha dados reais e atualizados
dessas competições.

**Why P1**: É a fonte de dados do campeonato mais relevante para o produto
(futebol brasileiro) — sem isso, não há dados nacionais confiáveis.

**Acceptance Criteria**:

1. WHEN `DadosFutebolProvider.syncCompetitions()` é chamado THEN o provider
   SHALL fazer uma chamada `GET /v1/campeonatos/:id` por id configurado em
   `SPORTS_BR_LEAGUE_IDS` e retornar um `ProviderCompetition[]` acumulado com
   um item por id.
2. WHEN `DadosFutebolProvider.syncTeams(competitionId)` é chamado THEN o
   provider SHALL buscar todas as partidas do campeonato via
   `GET /v1/campeonatos/:id/partidas` (paginando com `pagina`/`por_pagina` até
   `meta.pagina_atual >= meta.ultima_pagina`) e retornar um `ProviderTeam[]`
   deduplicado por `id` a partir de `time_mandante`/`time_visitante`.
3. WHEN `DadosFutebolProvider.syncMatches(externalCompetitionId, season)` é
   chamado THEN o provider SHALL ignorar o parâmetro `season` e buscar todas
   as partidas de `externalCompetitionId` via `GET
/v1/campeonatos/:id/partidas` (paginado).
4. WHEN uma partida tem `status` igual a `"aguardando"`, `"ao_vivo"`,
   `"encerrado"` ou `"adiado"` THEN o `ProviderMatch` resultante SHALL conter,
   respectivamente, `"scheduled"`, `"live"`, `"finished"` ou `"postponed"`.
5. WHEN um valor de `status` desconhecido é recebido THEN o provider SHALL
   lançar `SportsProviderError` em vez de aceitar um status inválido
   silenciosamente.
6. WHEN `DadosFutebolProvider.updateLiveMatches()` é chamado THEN o provider
   SHALL buscar `GET /v1/partidas/ao-vivo` e retornar apenas partidas cujo
   `campeonato.id` esteja em `SPORTS_BR_LEAGUE_IDS`.
7. WHEN qualquer chamada HTTP ao dadosfutebol.com.br falha (network error ou
   HTTP não-2xx) THEN o provider SHALL lançar `SportsProviderError`
   imediatamente, sem retry.

**Independent Test**: Mockar `fetch` com uma resposta paginada de 2 páginas
para `/v1/campeonatos/1/partidas`, chamar `syncTeams("1")` e confirmar que o
resultado contém a união deduplicada dos times das 2 páginas.

---

### P1: FootballDataProvider — Libertadores e Sudamericana ⭐ MVP

**User Story**: Como sistema, preciso sincronizar competições, times e
partidas da Copa Libertadores e da Copa Sudamericana a partir da API
football-data.org, para que o produto tenha dados reais das competições
continentais CONMEBOL.

**Why P1**: Junto com o DadosFutebolProvider, completa o conjunto de
competições que o produto precisa cobrir nesta rodada.

**Acceptance Criteria**:

1. WHEN `FootballDataProvider.syncCompetitions()` é chamado THEN o provider
   SHALL fazer uma chamada `GET /v4/competitions/:id` por id/code configurado
   em `SPORT_SA_LEAGUE_IDS`, autenticada via header `X-Auth-Token`, e
   retornar um `ProviderCompetition[]` acumulado com `season` derivado do ano
   de `currentSeason.startDate` (ex: `"2026"`).
2. WHEN `FootballDataProvider.syncTeams(competitionId)` é chamado THEN o
   provider SHALL chamar `GET /v4/competitions/:id/teams` e retornar um
   `ProviderTeam[]` normalizado.
3. WHEN `FootballDataProvider.syncMatches(externalCompetitionId, season)` é
   chamado THEN o provider SHALL chamar `GET
/v4/competitions/:id/matches?season={season}` (usando o parâmetro,
   diferente do DadosFutebolProvider).
4. WHEN uma partida tem `status` igual a `SCHEDULED`, `TIMED`, `IN_PLAY`,
   `PAUSED`, `FINISHED`, `AWARDED`, `POSTPONED`, `SUSPENDED` ou `CANCELLED`
   THEN o `ProviderMatch` resultante SHALL conter, respectivamente,
   `"scheduled"`, `"scheduled"`, `"live"`, `"live"`, `"finished"`,
   `"finished"`, `"postponed"`, `"postponed"` ou `"cancelled"`.
5. WHEN um valor de `status` desconhecido é recebido THEN o provider SHALL
   lançar `SportsProviderError`.
6. WHEN `FootballDataProvider.updateLiveMatches()` é chamado THEN o provider
   SHALL buscar partidas ao vivo via `GET /v4/matches?status=LIVE` (ou
   equivalente) e retornar apenas partidas cujo id de competição esteja em
   `SPORT_SA_LEAGUE_IDS`.
7. WHEN duas chamadas HTTP consecutivas do provider ocorreriam com menos de
   6.5s de intervalo THEN o provider SHALL aguardar o tempo necessário antes
   de disparar a segunda chamada (throttling interno, sem expor isso a
   nenhum outro módulo).
8. WHEN qualquer chamada HTTP ao football-data.org falha (network error ou
   HTTP não-2xx) THEN o provider SHALL lançar `SportsProviderError`
   imediatamente, sem retry.

**Independent Test**: Mockar `fetch`, disparar 3 chamadas sequenciais via o
provider e medir (com timers mockados) que a 2ª e 3ª chamada só ocorrem após
o intervalo mínimo de 6.5s desde a chamada anterior.

---

### P1: Composition Root e Dispatch Multi-Provider ⭐ MVP

**User Story**: Como desenvolvedor, quero que os services de sync operem
corretamente com 2 providers simultâneos, para que trocar/adicionar um
provider no futuro continue exigindo o mínimo de mudança possível fora de
`lib/sports-provider/`.

**Why P1**: Sem isso, os dois providers implementados nas stories acima nunca
são efetivamente usados pelos services — é o que conecta a infraestrutura à
aplicação.

**Acceptance Criteria**:

1. WHEN `lib/sports-provider/index.ts` é importado THEN ele SHALL exportar
   `sportsProviders: SportsProvider[]` contendo uma instância de
   `DadosFutebolProvider` e uma de `FootballDataProvider` — nenhum outro
   módulo do projeto SHALL instanciar essas classes diretamente.
2. WHEN `competitions-sync-service.ts` roda THEN ele SHALL iterar sobre
   `sportsProviders`, chamar `syncCompetitions()` em cada um, e fazer upsert
   em `competitions` usando `external_source: provider.source` de cada
   iteração (não mais um `sportsProvider.source` fixo).
3. WHEN `teams-sync-service.ts`, `matches-sync-service.ts` ou o service de
   `updateFinishedMatches` processam uma linha de `competitions` THEN eles
   SHALL resolver o provider a chamar via
   `sportsProviders.find(p => p.source === competition.external_source)`.
4. WHEN uma linha de `competitions` tem `external_source` que não corresponde
   a nenhum provider em `sportsProviders` THEN o service SHALL pular aquela
   linha com um `console.warn`, sem interromper o restante do sync.
5. WHEN `live-matches-sync-service.ts` roda THEN ele SHALL chamar
   `updateLiveMatches()` em cada provider de `sportsProviders`, acumular os
   resultados, e chamar `updateMatchRow` passando o `source` do provider de
   origem de cada partida (em vez de um `sportsProvider.source` global).
6. WHEN `SPORTS_PROVIDER_API_KEY` ou `SPORTS_PROVIDER_LEAGUE_IDS` são
   referenciados em `lib/env.ts` ou em qualquer arquivo do projeto THEN essas
   referências SHALL ter sido removidas, substituídas por
   `DADOS_FUTEBOL_API_KEY`, `SPORTS_BR_LEAGUE_IDS`, `FOOTBALL_DATA_API_KEY` e
   `SPORT_SA_LEAGUE_IDS`.

**Independent Test**: Com 2 providers mockados (`source: "a"` e `source:
"b"`, cada um retornando 1 competição), rodar `competitions-sync-service` e
confirmar 2 linhas em `competitions`, uma com cada `external_source`. Depois,
com uma linha de `competitions` tendo `external_source: "unknown"`, rodar
`teams-sync-service` e confirmar que nenhum provider é chamado para aquela
linha e nenhum erro é lançado.

---

## Edge Cases

- WHEN `syncTeams` do DadosFutebolProvider processa um campeonato sem
  nenhuma partida retornada (`data: []`) THEN o provider SHALL retornar um
  array vazio de times, sem erro.
- WHEN `updateLiveMatches` de qualquer provider retorna partidas cujo
  `campeonato`/competição não está em `SPORTS_BR_LEAGUE_IDS`/
  `SPORT_SA_LEAGUE_IDS` THEN essas partidas SHALL ser filtradas fora do
  resultado, não repassadas ao service.
- WHEN o FootballDataProvider recebe HTTP 429 (estourou o rate limit apesar
  do throttling) THEN o provider SHALL lançar `SportsProviderError` como
  qualquer outro erro HTTP não-2xx, sem tratamento especial/retry.
- WHEN uma resposta paginada do dadosfutebol.com.br tem `meta.ultima_pagina`
  igual a `meta.pagina_atual` já na primeira página THEN o helper de
  paginação SHALL parar após 1 chamada, sem chamada extra desnecessária.

---

## Requirement Traceability

| Requirement ID | Story                                          | Phase | Status |
| -------------- | ---------------------------------------------- | ----- | ------ |
| MPROV-01       | P1: DadosFutebolProvider                       | Done  | Done   |
| MPROV-02       | P1: DadosFutebolProvider                       | Done  | Done   |
| MPROV-03       | P1: DadosFutebolProvider                       | Done  | Done   |
| MPROV-04       | P1: DadosFutebolProvider                       | Done  | Done   |
| MPROV-05       | P1: DadosFutebolProvider                       | Done  | Done   |
| MPROV-06       | P1: DadosFutebolProvider                       | Done  | Done   |
| MPROV-07       | P1: DadosFutebolProvider                       | Done  | Done   |
| MPROV-08       | P1: FootballDataProvider                       | Done  | Done   |
| MPROV-09       | P1: FootballDataProvider                       | Done  | Done   |
| MPROV-10       | P1: FootballDataProvider                       | Done  | Done   |
| MPROV-11       | P1: FootballDataProvider                       | Done  | Done   |
| MPROV-12       | P1: FootballDataProvider                       | Done  | Done   |
| MPROV-13       | P1: FootballDataProvider                       | Done  | Done   |
| MPROV-14       | P1: FootballDataProvider                       | Done  | Done   |
| MPROV-15       | P1: FootballDataProvider                       | Done  | Done   |
| MPROV-16       | P1: Composition Root e Dispatch Multi-Provider | Done  | Done   |
| MPROV-17       | P1: Composition Root e Dispatch Multi-Provider | Done  | Done   |
| MPROV-18       | P1: Composition Root e Dispatch Multi-Provider | Done  | Done   |
| MPROV-19       | P1: Composition Root e Dispatch Multi-Provider | Done  | Done   |
| MPROV-20       | P1: Composition Root e Dispatch Multi-Provider | Done  | Done   |
| MPROV-21       | P1: Composition Root e Dispatch Multi-Provider | Done  | Done   |

**ID format:** `MPROV-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 21 total, 21 mapped to tasks, 0 unmapped — all implemented and covered by tests; production "Verified" (real API keys/ids) still blocked on Open Questions in `context.md`

---

## Success Criteria

- [x] Todos os testes existentes de `lib/sports-provider/` e
      `features/sports-sync/services/*` são substituídos/atualizados e
      passam com os 2 novos providers
- [x] `yarn build`/`tsc` não referencia mais `TheSportsDBProvider`,
      `SPORTS_PROVIDER_API_KEY` ou `SPORTS_PROVIDER_LEAGUE_IDS` em nenhum
      arquivo
- [ ] Uma execução manual (com keys reais) de `syncCompetitions`,
      `syncTeams`, `syncMatches`, `updateLiveMatches` e
      `updateFinishedMatches` popula `competitions`/`teams`/`matches` com
      linhas de ambos `external_source` (`dadosfutebol` e `football-data`)
      — **bloqueado**: depende dos IDs/keys reais (ver Open Questions em
      `context.md`), ainda não validado
      sem duplicatas em execuções repetidas
