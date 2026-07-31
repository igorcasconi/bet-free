# Sports Provider Swap (Multi-Provider) — Interview Decisions

**Date:** 2026-07-31
**Scope:** Substituir `TheSportsDBProvider` por **dois providers ativos simultaneamente**: `DadosFutebolProvider` (`api.dadosfutebol.com.br`, cobrindo Brasileirão Série A + Copa do Brasil) e `FootballDataProvider` (`football-data.org`, cobrindo Copa Libertadores + Copa Sudamericana). Ambos implementam a interface `SportsProvider` existente sem alterar seu contrato de métodos. Tudo relacionado a COMO fazer essa troca está dentro do escopo; novas capacidades de negócio, não.
**Source:** Discussão via `/interview` (comando com argumentos), sem spec.md prévio para esta rodada — existe `context.md`/`spec.md` anteriores em `.specs/features/sports-provider/` da criação original da abstração (feature base, mantida como referência de arquitetura).

---

## Decisões

### 1. Arquitetura multi-provider

- `lib/sports-provider/index.ts` passa a exportar `sportsProviders: SportsProvider[]` (array com as 2 instâncias), no lugar do singleton `sportsProvider`.
- Cada service (`competitions-sync-service.ts`, `teams-sync-service.ts`, `matches-sync-service.ts`, `live-matches-sync-service.ts`, `update-match-row.ts`, e o service de `updateFinishedMatches`) itera sobre `sportsProviders`, chama o método correspondente em cada um e acumula/upserta o resultado — mesmo padrão já usado para "1 chamada por id configurado, acumula" adotado no `syncCompetitions` do TheSportsDB antes desta troca.
- `external_source` deixa de vir de um `sportsProvider.source` fixo importado globalmente — passa a ser lido do provider da iteração corrente (`provider.source`) em cada loop.
- **Rationale:** interface `SportsProvider` não muda (cada provider continua com `source` fixo e os 5 métodos existentes); a multiplicidade é resolvida no nível dos services/composition root, não vazando para os DTOs nem exigindo um provider "composto" que esconderia a origem de cada item.

### 2. Dispatch por linha de `competitions` (syncTeams / syncMatches / updateFinishedMatches)

- Services que operam por competição já sincronizada (leem `external_id`/`external_source` da tabela `competitions`) resolvem o provider certo via lookup:
  `sportsProviders.find(p => p.source === competition.external_source)`.
- Se nenhum provider corresponder ao `external_source` da linha (ex: source órfão de um provider antigo/removido), o service pula a linha com `console.warn`, sem interromper o restante do sync — mesmo padrão defensivo já usado hoje para times ainda não sincronizados em `matches-sync-service.ts`.
- **Rationale:** único jeito consistente de saber "qual API bater" para uma competição específica, dado que agora coexistem 2 fontes com IDs e formatos de ID diferentes.

### 3. Dados já sincronizados com `external_source='thesportsdb'`

- Sem migração/limpeza de dados: `SPORTS_PROVIDER_API_KEY=123` no `.env.local` era só placeholder de teste, não há sync real em produção a preservar.
- Novas sincronizações criam linhas com `external_source` novo (`dadosfutebol` / `football-data`); linhas antigas com `external_source='thesportsdb'` (se existirem em algum ambiente) ficam órfãs e podem ser removidas manualmente depois, fora do escopo desta troca.
- **Rationale:** evita gastar esforço em migration de dados descartáveis.

### 4. DadosFutebolProvider (`api.dadosfutebol.com.br`)

- **Auth:** header `Authorization: Bearer {DADOS_FUTEBOL_API_KEY}` (key nunca na URL).
- **`syncCompetitions()`:** `GET /v1/campeonatos/:id` uma chamada por id em `SPORTS_BR_LEAGUE_IDS`, acumula — evita paginar a listagem completa só para achar 2 campeonatos.
- **`syncTeams(competitionId)`:** não existe endpoint dedicado de times-por-campeonato na API. Deriva os times buscando todas as partidas do campeonato (`GET /v1/campeonatos/:id/partidas`, paginado) e deduplicando por `id` a partir de `time_mandante`/`time_visitante` de cada partida.
- **`syncMatches(externalCompetitionId, season)`:** usa só `externalCompetitionId` — `season` é ignorado/não usado na URL, já que nesta API cada temporada já é um `campeonato_id` distinto (não existe filtro de season separado). Interface `SportsProvider` e `matches-sync-service.ts` não mudam.
- **`updateFinishedMatches(externalCompetitionId)`:** reaproveita `GET /v1/campeonatos/:id/partidas` (paginado), filtrando por partidas encerradas.
- **`updateLiveMatches()`:** usa o endpoint dedicado `GET /v1/partidas/ao-vivo` (sem paginação, cache de 15s na API), filtrando client-side pelos ids de `SPORTS_BR_LEAGUE_IDS` via `campeonato.id` aninhado em cada partida retornada — evita processar/logar partidas de campeonatos não sincronizados por nós.
- **Paginação:** helper privado `fetchAllPages(path, params)` usado por todo método que bate em endpoint paginável — `por_pagina=100`, avança `pagina` até `meta.pagina_atual >= meta.ultima_pagina`.
- **Mapeamento de status:** `aguardando→scheduled`, `ao_vivo→live`, `encerrado→finished`, `adiado→postponed`. Não existe "cancelado" no enum documentado da API — comportamento de erro para status desconhecido é mantido (lança `SportsProviderError`), igual ao provider anterior.

### 5. FootballDataProvider (`football-data.org`, API v4)

- **Auth:** header `X-Auth-Token: {FOOTBALL_DATA_API_KEY}`.
- **`syncCompetitions()`:** `GET /v4/competitions/:id` uma chamada por id/code em `SPORT_SA_LEAGUE_IDS`, acumula (mesmo padrão do DadosFutebolProvider).
  - Campo `season` do `ProviderCompetition` é derivado como o ano de `currentSeason.startDate` (ex: `"2026"`) — CONMEBOL roda dentro de um ano civil, então o ano de início já identifica a temporada de forma única.
- **`syncTeams(competitionId)`:** endpoint dedicado existe — `GET /v4/competitions/:id/teams`.
- **`syncMatches(externalCompetitionId, season)`:** `season` é usado de fato aqui — `GET /v4/competitions/:id/matches?season={season}` (diferente do DadosFutebolProvider, onde o parâmetro é ignorado).
- **`updateFinishedMatches(externalCompetitionId)`:** `GET /v4/competitions/:id/matches?status=FINISHED`.
- **`updateLiveMatches()`:** `GET /v4/matches?status=LIVE` (ou equivalente incluindo `IN_PLAY`), filtrando client-side pelos ids configurados em `SPORT_SA_LEAGUE_IDS`.
- **Mapeamento de status:**
  ```
  SCHEDULED → scheduled
  TIMED     → scheduled
  IN_PLAY   → live
  PAUSED    → live
  FINISHED  → finished
  AWARDED   → finished   (placar definitivo por W.O./decisão administrativa, mesmo tratamento que o TheSportsDBProvider dava a "Awarded")
  POSTPONED → postponed
  SUSPENDED → postponed  (jogo interrompido, retomar depois — sem status próprio no domínio)
  CANCELLED → cancelled
  ```
- **Rate limit (10 req/min no free tier):** `throttledFetch` privado no provider — guarda o timestamp da última chamada e aguarda o necessário para garantir intervalo mínimo de 6.5s entre requests (10/min = 6s + 0.5s de margem). Contido inteiramente dentro da classe, nenhuma outra parte do sistema precisa saber disso.
- **Rationale geral:** mesma filosofia de "falha imediata, sem retry embutido" já documentada na feature original — únicas exceções são o dispatch multi-provider (decisão 1/2) e o throttling acima, que é uma proteção preventiva contra 429, não um mecanismo de retry.

### 6. Env vars

- `SPORTS_PROVIDER_API_KEY` e `SPORTS_PROVIDER_LEAGUE_IDS` são **removidas** (TheSportsDB sai de cena).
- Novas env vars:
  - `DADOS_FUTEBOL_API_KEY` — key do dadosfutebol.
  - `SPORTS_BR_LEAGUE_IDS` — ids configurados de Brasileirão + Copa do Brasil (renomeação de `SPORTS_PROVIDER_LEAGUE_IDS`, mesmo formato: string separada por vírgula).
  - `FOOTBALL_DATA_API_KEY` — key do football-data.org.
  - `SPORT_SA_LEAGUE_IDS` — ids/codes configurados de Libertadores + Sudamericana, mesmo formato separado por vírgula.
- **Valores reais dos ids ficam como placeholder** em `.env.local`/`.env.example` (ver Open Questions) — só dá para confirmar batendo nas APIs reais com uma key válida.
- `lib/env.ts` (schema `createEnv`) precisa refletir a remoção das 2 vars antigas e adição das 4 novas.

---

## Agent's Discretion

- Nomes exatos de arquivos (`lib/sports-provider/dadosfutebol-provider.ts`, `lib/sports-provider/football-data-provider.ts`) e das classes, seguindo a convenção já usada (`thesportsdb-provider.ts` → `TheSportsDBProvider`).
- Schemas Zod exatos para validar as respostas de cada API (campos completos documentados nas decisões acima já cobrem o necessário).
- Endpoint/filtro exato usado por `updateFinishedMatches` no DadosFutebolProvider (`status=encerrado` como query param vs. filtrar client-side após `fetchAllPages`) — qualquer abordagem que respeite a paginação já decidida serve.
- Estrutura interna do helper `fetchAllPages` e do `throttledFetch` (privados a cada provider, não precisam ser genéricos/compartilhados entre os dois).
- Testes: cobertura equivalente à que já existe para `TheSportsDBProvider` (mock de `fetch` por provider, casos de paginação, throttling, dispatch por `external_source` nos services).

---

## Deferred Ideas

- Migração/limpeza de dados órfãos `external_source='thesportsdb'` — fica para quando/se necessário, fora desta rodada (ver decisão 3).
- Retry automático / backoff em falhas de API externa (429 incluso) — mantém a mesma decisão já registrada na feature original: falha imediata, sem retry embutido.
- Descoberta e validação dos IDs reais de Brasileirão, Copa do Brasil, Libertadores e Sudamericana nas duas APIs — ver Open Questions.
- Webhooks do dadosfutebol.com.br (mencionados na documentação como alternativa a polling) — não avaliados nesta rodada, sync continua via polling/endpoints acionados manualmente.

---

## Open Questions

- **IDs reais de configuração:** `SPORTS_BR_LEAGUE_IDS` (Brasileirão Série A + Copa do Brasil no dadosfutebol) e `SPORT_SA_LEAGUE_IDS` (Libertadores + Sudamericana no football-data.org) precisam ser confirmados batendo nas APIs reais (`GET /v1/campeonatos` e `GET /v4/competitions`) com uma key válida — ficam como placeholder no `.env` até lá.
- **Cobertura do plano free do dadosfutebol.com.br:** a documentação menciona que o plano Free restringe a "4 endpoints específicos" mas não lista quais — precisa validar durante a implementação se todos os endpoints usados aqui (`campeonatos/:id`, `campeonatos/:id/partidas`, `partidas/ao-vivo`) estão de fato disponíveis no tier gratuito.
- **Cobertura CONMEBOL no football-data.org:** não confirmado na documentação pública se Copa Libertadores e Copa Sudamericana estão disponíveis no plano free (`TIER_ONE`) ou exigem plano pago — validar com a key real antes de assumir que o provider funciona sem custo.
- **Paginação em `/v4/competitions/:id/matches`:** a documentação v4 consultada não deixou claro se este endpoint pagina (diferente do dadosfutebol, que documenta paginação explicitamente) — validar durante a implementação se uma única chamada já traz todas as partidas da temporada ou se é necessário paginar/página por `dateFrom`/`dateTo`.

---

## Relação com a feature original

Esta rodada não substitui `.specs/features/sports-provider/` (context.md/spec.md/design.md da criação da abstração `SportsProvider`) — ela continua válida como registro de por que a interface existe e como os DTOs são normalizados. Esta é uma evolução: troca de implementação(ões) por trás da mesma interface, mais a mudança de "1 provider" para "N providers simultâneos".
