# Sports Provider Abstraction Tasks

**Design**: `.specs/features/sports-provider/design.md`
**Status**: Done

---

## Execution Plan

### Phase 1: Foundation (Parallel OK) — **Est. tokens**: ~30k

```
T1 (migration) ─┐
T2 (env vars)   ─┼── independent, no shared files
T3 (types.ts)   ─┘
```

### Phase 2: Integration Layer (Parallel OK) — **Est. tokens**: ~45k

```
T2 ──→ T4 (supabase admin client)
T2,T3 ──→ T5 (TheSportsDBProvider)
```

### Phase 3: Factory (Sequential) — **Est. tokens**: ~10k

```
T5 ──→ T6 (sportsProvider factory)
```

### Phase 4: Sync Services P1 (Parallel OK) — **Est. tokens**: ~65k

```
T1,T4,T6 ──┬→ T7 (competitions-sync-service)
           ├→ T8 (teams-sync-service)
           └→ T9 (matches-sync-service)
```

### Phase 5: Live Update Service (Sequential) — **Est. tokens**: ~20k

```
T1,T4,T6 ──→ T10 (live-matches-sync-service)
```

### Phase 6: Route Handlers (Parallel OK) — **Est. tokens**: ~30k

```
T7  ──→ T11 (POST /api/sync/competitions)
T8  ──→ T12 (POST /api/sync/teams)
T9  ──→ T13 (POST /api/sync/matches)
T10 ──→ T14 (POST /api/sync/live)
```

---

## Task Breakdown

### T1: Add external_id/external_source migration

**What**: Nova migration adicionando `external_id TEXT`, `external_source TEXT`
e `UNIQUE(external_source, external_id)` em `competitions`, `teams`, `matches`.
**Where**: `supabase/migrations/00000000000011_add_external_id_columns.sql`
**Depends on**: None
**Reuses**: convenção de numeração sequencial de `supabase/migrations/`
**Requirement**: SPORTS-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Colunas `external_id`/`external_source` adicionadas nas 3 tabelas
- [x] Constraint `UNIQUE(external_source, external_id)` por tabela
- [x] SQL sintaticamente válido (revisão estática — sem Docker/CLI disponível, mesma limitação do `database-schema`)

**Tests**: none (DDL puro, sem lógica de aplicação)
**Gate**: build (lint do projeto não cobre SQL; validação é revisão manual)

---

### T2: Add sports-provider env vars

**What**: Estender `lib/env.ts` com `SUPABASE_SERVICE_ROLE_KEY`,
`SPORTS_PROVIDER_API_KEY`, `SPORTS_PROVIDER_LEAGUE_IDS`, `SYNC_SECRET`
(todas server-only); atualizar `.env.example`.
**Where**: `lib/env.ts`, `.env.example`
**Depends on**: None
**Reuses**: padrão `createEnv` já existente em `lib/env.ts`
**Requirement**: SPORTS-01, SPORTS-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] 4 novas vars adicionadas ao bloco `server` de `env.ts`
- [x] `.env.example` documenta as 4 vars com comentário de propósito
- [x] `npm run build` (ou `tsc --noEmit`) não falha por tipos

**Tests**: none (config)
**Gate**: build

---

### T3: Create SportsProvider interface & DTOs

**What**: Definir `SportsProvider`, `ProviderCompetition`, `ProviderTeam`,
`ProviderMatch`, `MatchStatus`, `SportsProviderError` — exatamente como
especificado em design.md.
**Where**: `lib/sports-provider/types.ts`
**Depends on**: None
**Reuses**: nenhum (tipos puros)
**Requirement**: SPORTS-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Interface `SportsProvider` com os 4 métodos exatos do design
- [x] DTOs e `MatchStatus` exportados
- [x] `SportsProviderError` exportado como classe de erro tipada
- [x] `tsc --noEmit` passa

**Tests**: none (tipos, sem lógica executável)
**Gate**: build

---

### T4: Create Supabase service-role admin client

**What**: Novo client Supabase server-only usando `SUPABASE_SERVICE_ROLE_KEY`,
espelhando o padrão singleton de `lib/firebase/admin.ts`.
**Where**: `lib/supabase/admin.ts`
**Depends on**: T2
**Reuses**: padrão `getApps()/getApp()` de `lib/firebase/admin.ts`, `createClient` de `@supabase/supabase-js`
**Requirement**: SPORTS-05 (pré-requisito de infra)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `export const supabaseAdmin: SupabaseClient` criado com service role key
- [x] Nenhum código fora de `features/sports-sync/services/*` importa este arquivo (comentário/convenção documentada no topo do arquivo)
- [x] `tsc --noEmit` passa

**Tests**: none (client de infra, sem lógica própria para testar isoladamente)
**Gate**: build

---

### T5: Implement TheSportsDBProvider

**What**: Classe `TheSportsDBProvider implements SportsProvider` — os 4
métodos contra a API v1 do TheSportsDB, com validação Zod da resposta e
mapeamento de `strStatus` → `MatchStatus` conforme tabela do design.md.
**Where**: `lib/sports-provider/thesportsdb-provider.ts`, `lib/sports-provider/thesportsdb-provider.test.ts`
**Depends on**: T2, T3
**Reuses**: `fetch` nativo, `zod` (já dependência do projeto)
**Requirement**: SPORTS-01, SPORTS-02

**Tools**:

- MCP: NONE
- Skill: `search` se precisar reconfirmar shape exato de algum endpoint v1 durante a implementação

**Done when**:

- [x] `syncCompetitions()` chama `all_leagues.php`, filtra pela lista configurada de league IDs, retorna `ProviderCompetition[]`
- [x] `syncTeams(externalCompetitionId)` retorna `ProviderTeam[]`
- [x] `syncMatches(externalCompetitionId, season)` chama `eventsseason.php`, retorna `ProviderMatch[]` com `matchDate` em ISO 8601
- [x] `updateLiveMatches()` implementado como aproximação v1 (ver design.md), retorna `ProviderMatch[]`
- [x] Mapeamento de status cobre todos os valores da tabela do design; valor desconhecido lança `SportsProviderError`
- [x] Resposta com shape inválido (falha Zod) lança `SportsProviderError` antes de normalizar
- [x] Falha de rede/HTTP lança `SportsProviderError` imediatamente, sem retry
- [x] Gate check passa: `npm test -- thesportsdb-provider`
- [x] Test count: pelo menos 1 teste por método + 1 por valor de status mapeado + 1 para erro de shape inválido + 1 para erro de rede

**Tests**: unit (vitest, `fetch` mockado via `vi.stubGlobal` ou `msw`)
**Gate**: quick

---

### T6: Create sportsProvider factory

**What**: Composition root exportando a única instância ativa do provider.
**Where**: `lib/sports-provider/index.ts`
**Depends on**: T5
**Reuses**: nenhum
**Requirement**: SPORTS-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `export const sportsProvider: SportsProvider = new TheSportsDBProvider(...)`
- [x] Nenhum outro arquivo do projeto instancia `TheSportsDBProvider` diretamente (verificar via grep antes de fechar a task)
- [x] `tsc --noEmit` passa

**Tests**: none (composition root trivial, coberto indiretamente pelos testes de T5 e dos services)
**Gate**: build

---

### T7: Implement competitions-sync-service [P]

**What**: Orquestra `sportsProvider.syncCompetitions()` → upsert em
`competitions` via `supabaseAdmin`, chave de conflito `(external_source, external_id)`.
**Where**: `features/sports-sync/services/competitions-sync-service.ts`, `features/sports-sync/services/competitions-sync-service.test.ts`
**Depends on**: T1, T4, T6
**Reuses**: `sportsProvider` (T6), `supabaseAdmin` (T4)
**Requirement**: SPORTS-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `syncCompetitions(): Promise<{ synced: number }>` implementado
- [x] Upsert usa `onConflict: 'external_source,external_id'`
- [x] Erro do provider propaga sem ser capturado silenciosamente
- [x] Gate check passa: `npm test -- competitions-sync-service`
- [x] Test count: happy path (upsert chamado com dados normalizados do provider mockado) + propagação de erro do provider

**Tests**: unit (vitest, `sportsProvider` e `supabaseAdmin` mockados)
**Gate**: quick

---

### T8: Implement teams-sync-service [P]

**What**: Para cada competição já sincronizada (lida via `supabaseAdmin`),
chama `sportsProvider.syncTeams(externalCompetitionId)` → upsert em `teams`.
**Where**: `features/sports-sync/services/teams-sync-service.ts`, `features/sports-sync/services/teams-sync-service.test.ts`
**Depends on**: T1, T4, T6
**Reuses**: `sportsProvider` (T6), `supabaseAdmin` (T4)
**Requirement**: SPORTS-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `syncTeams(): Promise<{ synced: number }>` implementado
- [x] Itera sobre todas as `competitions` com `external_id` não nulo
- [x] Upsert usa `onConflict: 'external_source,external_id'` em `teams`
- [x] Gate check passa: `npm test -- teams-sync-service`
- [x] Test count: happy path com 2+ competições mockadas + caso de 0 competições (sem erro)

**Tests**: unit (vitest, mocks)
**Gate**: quick

---

### T9: Implement matches-sync-service [P]

**What**: Para cada competição, chama `sportsProvider.syncMatches(externalCompetitionId, season)`,
resolve `home_team_id`/`away_team_id` via `external_id` de `teams`, upsert em `matches`.
**Where**: `features/sports-sync/services/matches-sync-service.ts`, `features/sports-sync/services/matches-sync-service.test.ts`
**Depends on**: T1, T4, T6
**Reuses**: `sportsProvider` (T6), `supabaseAdmin` (T4)
**Requirement**: SPORTS-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `syncMatches(): Promise<{ synced: number; skipped: number }>` implementado
- [x] Time não encontrado por `external_id` → `skipped++`, sync continua (não lança erro)
- [x] Upsert usa `onConflict: 'external_source,external_id'` em `matches`
- [x] Gate check passa: `npm test -- matches-sync-service`
- [x] Test count: happy path + caso de time faltante (skip sem falhar o processo inteiro)

**Tests**: unit (vitest, mocks)
**Gate**: quick

---

### T10: Implement live-matches-sync-service

**What**: Chama `sportsProvider.updateLiveMatches()` → `UPDATE` (nunca
`INSERT`) em `matches` existentes, identificadas por `external_id`.
**Where**: `features/sports-sync/services/live-matches-sync-service.ts`, `features/sports-sync/services/live-matches-sync-service.test.ts`
**Depends on**: T1, T4, T6
**Reuses**: `sportsProvider` (T6), `supabaseAdmin` (T4)
**Requirement**: SPORTS-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `updateLiveMatches(): Promise<{ updated: number; ignored: number }>` implementado
- [x] Atualiza apenas `status`, `home_score`, `away_score`, `updated_at`
- [x] Partida sem correspondência local por `external_id` → `ignored++`, nenhuma linha criada
- [x] Gate check passa: `npm test -- live-matches-sync-service`
- [x] Test count: happy path (update de partida existente) + caso de partida não encontrada (ignored, sem insert)

**Tests**: unit (vitest, mocks)
**Gate**: quick

---

### T11: Create POST /api/sync/competitions route [P]

**What**: Route Handler protegida por `x-sync-secret`, chama `syncCompetitions()`.
**Where**: `app/api/sync/competitions/route.ts`
**Depends on**: T7
**Reuses**: padrão de checagem de header do design.md
**Requirement**: SPORTS-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Sem header correto → `401`, sem chamar o service
- [x] Com header correto → chama `syncCompetitions()`, retorna `200` + resultado
- [x] Erro do service → `500` com mensagem genérica (sem detalhes internos)
- [x] Gate check passa: `npm test -- app/api/sync/competitions`

**Tests**: unit (vitest, request mockado; sem subir servidor real)
**Gate**: quick

---

### T12: Create POST /api/sync/teams route [P]

**What**: Idêntico a T11, chamando `syncTeams()`.
**Where**: `app/api/sync/teams/route.ts`
**Depends on**: T8
**Reuses**: mesmo padrão de T11
**Requirement**: SPORTS-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Mesmos 3 critérios de T11, aplicados a `syncTeams()`
- [x] Gate check passa: `npm test -- app/api/sync/teams`

**Tests**: unit
**Gate**: quick

---

### T13: Create POST /api/sync/matches route [P]

**What**: Idêntico a T11, chamando `syncMatches()`.
**Where**: `app/api/sync/matches/route.ts`
**Depends on**: T9
**Reuses**: mesmo padrão de T11
**Requirement**: SPORTS-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Mesmos 3 critérios de T11, aplicados a `syncMatches()`
- [x] Gate check passa: `npm test -- app/api/sync/matches`

**Tests**: unit
**Gate**: quick

---

### T14: Create POST /api/sync/live route [P]

**What**: Idêntico a T11, chamando `updateLiveMatches()`.
**Where**: `app/api/sync/live/route.ts`
**Depends on**: T10
**Reuses**: mesmo padrão de T11
**Requirement**: SPORTS-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Mesmos 3 critérios de T11, aplicados a `updateLiveMatches()`
- [x] Gate check passa (última task da feature): `npm test && npm run build && npm run lint`

**Tests**: unit
**Gate**: build (última task — full build + lint + todos os testes)

---

## Parallel Execution

- **Phase 1**: T1, T2, T3 — arquivos completamente independentes.
- **Phase 2**: T4, T5 — ambos dependem só de T2/T3, não compartilham arquivo.
- **Phase 4**: T7, T8, T9 — cada um em arquivo próprio, sem import cruzado entre si (dependência de execução em produção — teams depois de competitions — é uma preocupação de runtime/cron, não de código; os arquivos são independentes para fins de implementação e teste).
- **Phase 6**: T11, T12, T13, T14 — 4 rotas independentes, cada uma só depende do seu próprio service já pronto.

---

## Task Verification Standards

Ver "Done when" e "Tests"/"Gate" em cada task acima — todas seguem: outcome
específico e testável, comando de gate check explícito, contagem mínima de
testes esperada.
