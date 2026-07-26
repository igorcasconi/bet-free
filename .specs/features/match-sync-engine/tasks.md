# Match Sync Engine Tasks

**Design**: `.specs/features/match-sync-engine/design.md`
**Status**: Done

---

## Execution Plan

### Phase 1: Foundation (Parallel OK) — **Est. tokens**: ~67k

```
T1 (migration sync_runs)        ─┐
T2 (SportsProvider + updateFinishedMatches type) ─┼── independentes, sem arquivo compartilhado
T5 (sync-lock-service + tests)  ─┘
```

### Phase 2: Provider & Refactor (Parallel OK) — **Est. tokens**: ~55k

```
T2 ──→ T3 (TheSportsDBProvider.updateFinishedMatches + tests)
T4 (extrair update-match-row.ts + refatorar live-matches-sync-service)
```

### Phase 3: Finished Service (Sequential) — **Est. tokens**: ~50k

```
T3, T4 ──→ T6 (finished-matches-sync-service + tests)
```

### Phase 4: Orchestrator (Sequential) — **Est. tokens**: ~50k

```
T5, T6 ──→ T7 (MatchSyncService + tests)
```

### Phase 5: Barrel (Sequential) — **Est. tokens**: ~27k

```
T7 ──→ T8 (features/sports-sync/index.ts atualizado)
```

### Phase 6: Routes (Parallel OK) — **Est. tokens**: ~59k

```
T8 ──→ T9  (atualizar 4 rotas existentes + 409 + tests)
T8 ──→ T10 (nova rota /finished + test)
T8 ──→ T11 (nova rota /full + test)
```

---

## Task Breakdown

### T1: Create sync_runs migration

**What**: Nova migration com tabela `sync_runs`, `CHECK` de `type`/`status`,
índice comum em `type`, índice único parcial `sync_runs_one_running_per_type`
(atomicidade do lock), RLS `deny-all` (mesma política das demais tabelas).
**Where**: `supabase/migrations/00000000000012_create_sync_runs.sql`
**Depends on**: None
**Reuses**: convenção de numeração e padrão RLS já usados nas migrations 1-11
**Requirement**: MATCHSYNC-01

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Tabela `sync_runs` com colunas `id, type, status, started_at, finished_at`
- [x] `CHECK` em `type` (5 valores) e `status` (3 valores)
- [x] Índice único parcial `WHERE status = 'running'` presente
- [x] RLS habilitado + policy `deny_all`

**Tests**: none (DDL puro)
**Gate**: build

---

### T2: Extend SportsProvider interface

**What**: Adicionar `updateFinishedMatches(externalCompetitionId: string):
Promise<ProviderMatch[]>` à interface `SportsProvider`.
**Where**: `lib/sports-provider/types.ts`
**Depends on**: None
**Reuses**: `ProviderMatch` já existente
**Requirement**: MATCHSYNC-03

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Método adicionado à interface `SportsProvider`
- [x] `tsc --noEmit` falha em `thesportsdb-provider.ts` até T3 implementar (esperado — confirma que a interface está de fato sendo checada)

**Tests**: none (tipos)
**Gate**: build

---

### T3: Implement TheSportsDBProvider.updateFinishedMatches

**What**: Implementar o método novo usando `eventspastleague.php`, reusando
`eventsResponseSchema`/`mapStatus`/`toISODateTime`/`fetchJson` já existentes.
**Where**: `lib/sports-provider/thesportsdb-provider.ts`, `lib/sports-provider/thesportsdb-provider.test.ts`
**Depends on**: T2
**Reuses**: schemas e helpers já existentes no mesmo arquivo
**Requirement**: MATCHSYNC-03

**Tools**: MCP: NONE / Skill: `search` se precisar reconfirmar shape de `eventspastleague.php`

**Done when**:

- [x] `updateFinishedMatches(externalCompetitionId)` chama `eventspastleague.php?id=<encoded>`, retorna `ProviderMatch[]` normalizado
- [x] Shape inválido → `SportsProviderError` (mesmo padrão dos outros métodos)
- [x] Erro de rede/HTTP → `SportsProviderError` imediato, sem retry
- [x] Gate check passa: `npm test -- thesportsdb-provider`
- [x] Test count: happy path + shape inválido + erro de rede (mínimo 3 nesse método)

**Tests**: unit
**Gate**: quick

---

### T4: Extract update-match-row.ts and refactor live-matches-sync-service

**What**: Extrair a lógica de "UPDATE por external_id, nunca INSERT" de
`live-matches-sync-service.ts` (`updateOne`) para uma função compartilhada;
refatorar `live-matches-sync-service.ts` para importá-la.
**Where**: `features/sports-sync/services/update-match-row.ts` (novo),
`features/sports-sync/services/update-match-row.test.ts` (novo),
`features/sports-sync/services/live-matches-sync-service.ts` (modificado)
**Depends on**: None
**Reuses**: lógica hoje inline em `live-matches-sync-service.ts`
**Requirement**: MATCHSYNC-04

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] `updateMatchRow(match): Promise<boolean>` extraída, comportamento idêntico ao `updateOne` original
- [x] `live-matches-sync-service.ts` usa `updateMatchRow`, sem lógica duplicada
- [x] `live-matches-sync-service.test.ts` continua passando sem alteração de asserções (só ajuste de mock se necessário)
- [x] Gate check passa: `npm test -- update-match-row live-matches-sync-service`
- [x] Test count: pelo menos os mesmos testes de antes (2) + testes próprios de `update-match-row.ts` (happy path + not-found)

**Tests**: unit
**Gate**: quick

---

### T5: Implement sync-lock-service

**What**: `withSyncLock`, `SyncAlreadyRunningError`, reap de lock stale
(>10min), aquisição atômica via `INSERT` + tratamento de `unique_violation`.
**Where**: `features/sports-sync/services/sync-lock-service.ts`,
`features/sports-sync/services/sync-lock-service.test.ts`
**Depends on**: None
**Reuses**: `supabaseAdmin`
**Requirement**: MATCHSYNC-01

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] `withSyncLock(type, fn)` adquire lock, executa `fn`, marca `finished` em sucesso
- [x] Lock já `running` (não stale) → `INSERT` falha por `unique_violation` → `SyncAlreadyRunningError` lançado, `fn` NUNCA é chamado
- [x] Lock `running` stale (>10min) → reap automático antes do `INSERT`, nova execução procede
- [x] `fn` lança erro → linha marcada `failed`, erro original relançado (não `SyncAlreadyRunningError`)
- [x] Dois `type`s diferentes não se bloqueiam entre si
- [x] Gate check passa: `npm test -- sync-lock-service`
- [x] Test count: mínimo 5 (um por critério acima)

**Tests**: unit
**Gate**: quick

---

### T6: Implement finished-matches-sync-service

**What**: Consulta partidas presas, agrupa por competição, chama
`sportsProvider.updateFinishedMatches` com concorrência limitada, atualiza
via `updateMatchRow`.
**Where**: `features/sports-sync/services/finished-matches-sync-service.ts`,
`features/sports-sync/services/finished-matches-sync-service.test.ts`
**Depends on**: T3, T4
**Reuses**: `mapWithConcurrency`, `DEFAULT_CONCURRENCY_LIMIT`, `updateMatchRow`, `sportsProvider`, `supabaseAdmin`
**Requirement**: MATCHSYNC-04

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] `updateFinishedMatches(): Promise<{ updated: number; ignored: number }>` implementado
- [x] Query filtra `status IN ('scheduled','live')` e `match_date` antiga, agrupada por `competitions.external_id`
- [x] Chama o provider com concorrência limitada (`DEFAULT_CONCURRENCY_LIMIT`)
- [x] Usa `updateMatchRow` (T4) — sem lógica de update duplicada
- [x] Gate check passa: `npm test -- finished-matches-sync-service`
- [x] Test count: happy path (múltiplas competições) + partida sem correspondência local (ignored) + 0 competições presas (no-op)

**Tests**: unit
**Gate**: quick

---

### T7: Implement MatchSyncService

**What**: Classe orquestradora com os 5 métodos + `runFullSync`, cada um
protegido por `withSyncLock`.
**Where**: `features/sports-sync/services/match-sync-service.ts`,
`features/sports-sync/services/match-sync-service.test.ts`
**Depends on**: T5, T6
**Reuses**: `withSyncLock`, os 4 services de função existentes + `finished-matches-sync-service` (T6)
**Requirement**: MATCHSYNC-02, MATCHSYNC-05

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Os 5 métodos (`syncCompetitions`, `syncTeams`, `syncMatches`, `updateLiveMatches`, `updateFinishedMatches`) delegam via `withSyncLock('<type>', ...)` para o service de função correto
- [x] `runFullSync()` executa os 5 em ordem estrita com `await` sequencial (não `Promise.all`)
- [x] Falha numa etapa de `runFullSync` interrompe as etapas seguintes
- [x] Lock já `running` → método lança `SyncAlreadyRunningError` sem chamar o service subjacente
- [x] Gate check passa: `npm test -- match-sync-service`
- [x] Test count: 1 por método (5) + ordem do `runFullSync` + falha interrompe cadeia + lock já running

**Tests**: unit
**Gate**: quick

---

### T8: Update features/sports-sync barrel

**What**: Adicionar exports de `finished-matches-sync-service`,
`match-sync-service`, `sync-lock-service` (incluindo `SyncAlreadyRunningError`).
**Where**: `features/sports-sync/index.ts`
**Depends on**: T7
**Reuses**: padrão `export *` já existente
**Requirement**: MATCHSYNC-02

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Barrel exporta os 3 módulos novos
- [x] `SyncAlreadyRunningError` acessível via `@/features/sports-sync`
- [x] `tsc --noEmit` passa

**Tests**: none (barrel)
**Gate**: build

---

### T9: Update 4 existing routes to use MatchSyncService [P]

**What**: Trocar chamada direta ao service de função por
`matchSyncService.<método>()`; capturar `SyncAlreadyRunningError` → `409`.
**Where**: `app/api/sync/{competitions,teams,matches,live}/route.ts` e seus `.test.ts`
**Depends on**: T8
**Reuses**: padrão de rota já existente (`isValidSyncSecret`, try/catch)
**Requirement**: MATCHSYNC-06

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] As 4 rotas chamam `matchSyncService.<método correspondente>()`
- [x] `SyncAlreadyRunningError` capturado → `409`, distinto do `500` genérico
- [x] Testes 401/200/500 já existentes continuam passando
- [x] Novo teste de `409` adicionado nas 4 rotas
- [x] Gate check passa: `npm test -- app/api/sync`

**Tests**: unit
**Gate**: quick

---

### T10: Create POST /api/sync/finished route [P]

**What**: Nova rota chamando `matchSyncService.updateFinishedMatches()`.
**Where**: `app/api/sync/finished/route.ts`, `app/api/sync/finished/route.test.ts`
**Depends on**: T8
**Reuses**: mesmo padrão das demais rotas (incluindo 409)
**Requirement**: MATCHSYNC-06

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] 401 sem header correto / 200 com header + resultado / 409 se lock running / 500 genérico em erro do service
- [x] Gate check passa: `npm test -- app/api/sync/finished`

**Tests**: unit
**Gate**: quick

---

### T11: Create POST /api/sync/full route [P]

**What**: Nova rota chamando `matchSyncService.runFullSync()`.
**Where**: `app/api/sync/full/route.ts`, `app/api/sync/full/route.test.ts`
**Depends on**: T8
**Reuses**: mesmo padrão das demais rotas
**Requirement**: MATCHSYNC-06

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Mesmos 4 critérios de T10, aplicados a `runFullSync()`
- [x] Gate check passa (última task da feature): `npm test && npm run build && npm run lint`

**Tests**: unit
**Gate**: build (última task — full build + lint + todos os testes)

---

## Parallel Execution

- **Phase 1**: T1, T2, T5 — arquivos completamente independentes.
- **Phase 2**: T3, T4 — T3 depende só de T2 (tipo), T4 é independente; nenhum compartilha arquivo.
- **Phase 6**: T9, T10, T11 — cada um em rota própria, todos dependem só de T8 (já concluído antes desta fase).

---

## Task Verification Standards

Ver "Done when"/"Tests"/"Gate" em cada task — outcome específico e
testável, comando de gate check explícito, contagem mínima de testes.
