# Ranking Engine Tasks

**Design**: `.specs/features/ranking-engine/design.md`
**Status**: Done

**Nota sobre testes**: não existe `.specs/codebase/TESTING.md`. Mesma convenção inferida usada em `prediction-processor/tasks.md`: Vitest, ambiente `node`, `vi.mock` sobre `@/lib/supabase/admin`, comando `npx vitest run <path>`.

---

## Execution Plan

### Phase 1: Foundation (Parallel OK) — **Est. tokens**: ~30k

```
T1 (migration) ─┐
T2 (types) ─┼─→ (nada bloqueado entre si)
T9 (SyncType) ─┘
```

### Phase 2: Cálculo e persistência (Parallel OK) — **Est. tokens**: ~45k

```
T2 ──→ T3 (compute-accuracy)
T2 ──→ T4 (compute-discipline)
T2 ──→ T5 (compute-money-saved)
T1,T2 ──→ T6 (persist-ranking)
```

### Phase 3: Orquestração (Sequential) — **Est. tokens**: ~25k

```
T3,T4,T5,T6 ──→ T7 (recompute-rankings) ──→ T8 (index.ts)
```

### Phase 4: Rota (Sequential) — **Est. tokens**: ~25k

```
T8,T9 ──→ T10 (route)
```

### Phase 5: Integração final (Sequential) — **Est. tokens**: ~10k

```
T10 ──→ T11 (step no cron)
```

---

## Task Breakdown

### T1: Migration — `ranking_type` + constraints + sync_runs

**What**: Criar `supabase/migrations/00000000000016_add_ranking_type_to_ranking_cache.sql` com: coluna `ranking_type` (NOT NULL, CHECK IN accuracy/discipline/money_saved), UNIQUE `(user_id, competition_id, ranking_type)` substituindo a antiga, índice parcial geral e índice composto atualizados, e CHECK de `sync_runs.type` estendido com `'rankings'`.
**Where**: `supabase/migrations/00000000000016_add_ranking_type_to_ranking_cache.sql`
**Depends on**: None
**Reuses**: Padrão de `00000000000015_add_prediction_processing_columns.sql`
**Requirement**: RANK-01, RANK-02, RANK-03, RANK-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Migration aplica sem erro localmente
- [x] Nome exato da UNIQUE constraint original de `ranking_cache` confirmado antes do `DROP CONSTRAINT` (`\d ranking_cache` ou `pg_constraint`)
- [x] `ranking_cache` aceita 3 linhas por `(user_id, competition_id NULL)` — uma por `ranking_type`
- [x] `sync_runs` aceita `type = 'rankings'`

**Tests**: none (migration SQL, verificado por aplicação local)
**Gate**: build

---

### T2: `features/ranking-engine/types/index.ts`

**What**: Definir `RankedUser` e `RankingType` conforme design.
**Where**: `features/ranking-engine/types/index.ts`
**Depends on**: None
**Reuses**: N/A
**Requirement**: RANK-01, RANK-02, RANK-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Tipos exportados batem com design.md
- [x] `tsc --noEmit` sem erros

**Tests**: none (apenas tipos)
**Gate**: build

---

### T3: `features/ranking-engine/services/compute-accuracy-ranking.ts` [P]

**What**: `computeAccuracyRanking(): Promise<RankedUser[]>` — agrega `predictions` por usuário, filtra mínimo de 5 processadas, calcula `points = round(accuracy * 10000)`, ordena por `points` desc, `userId` asc.
**Where**: `features/ranking-engine/services/compute-accuracy-ranking.ts`
**Depends on**: T2
**Reuses**: N/A (primeira agregação em memória desse tipo no projeto)
**Requirement**: RANK-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Usuário com < 5 previsões processadas é excluído do resultado
- [x] Usuário com >= 5 excluído/incluído corretamente conforme `points_earned`
- [x] `points` calculado como basis points (`Math.round(accuracy * 10000)`)
- [x] Ordenação por `points` desc, `userId` asc como desempate
- [x] Gate check passa: `npx vitest run tests/features/ranking-engine/services/compute-accuracy-ranking.test.ts`
- [x] Test count: 5+ testes passam

**Tests**: unit
**Gate**: quick

---

### T4: `features/ranking-engine/services/compute-discipline-ranking.ts` [P]

**What**: `computeDisciplineRanking(): Promise<RankedUser[]>` — busca todos os usuários ordenados por `current_streak` desc, `id` asc.
**Where**: `features/ranking-engine/services/compute-discipline-ranking.ts`
**Depends on**: T2
**Reuses**: N/A
**Requirement**: RANK-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Todos os usuários incluídos, inclusive `current_streak = 0`
- [x] `points` = `current_streak` direto (sem conversão)
- [x] Ordenação por `current_streak` desc, `id` asc
- [x] Gate check passa: `npx vitest run tests/features/ranking-engine/services/compute-discipline-ranking.test.ts`
- [x] Test count: 3+ testes passam

**Tests**: unit
**Gate**: quick

---

### T5: `features/ranking-engine/services/compute-money-saved-ranking.ts` [P]

**What**: `computeMoneySavedRanking(): Promise<RankedUser[]>` — busca todos os usuários ordenados por `money_saved` desc, `id` asc, `points = round(money_saved * 100)`.
**Where**: `features/ranking-engine/services/compute-money-saved-ranking.ts`
**Depends on**: T2
**Reuses**: N/A
**Requirement**: RANK-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Todos os usuários incluídos, inclusive `money_saved = 0`
- [x] `points` = centavos (`Math.round(money_saved * 100)`)
- [x] Ordenação por `money_saved` desc, `id` asc
- [x] Gate check passa: `npx vitest run tests/features/ranking-engine/services/compute-money-saved-ranking.test.ts`
- [x] Test count: 3+ testes passam

**Tests**: unit
**Gate**: quick

---

### T6: `features/ranking-engine/services/persist-ranking.ts` [P]

**What**: `persistRanking(rankingType, rankedUsers): Promise<number>` — apaga linhas existentes do `ranking_type` (escopo geral) e insere o novo conjunto com `position` sequencial.
**Where**: `features/ranking-engine/services/persist-ranking.ts`
**Depends on**: T1, T2
**Reuses**: N/A
**Requirement**: RANK-01, RANK-02, RANK-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `DELETE` sempre executado antes do `INSERT`, filtrado por `ranking_type` e `competition_id IS NULL`
- [x] `position` atribuído sequencialmente (1-based) na ordem recebida (assume-se já ordenado pelo compute-*)
- [x] Lista vazia: só o delete, sem erro, retorna 0
- [x] Gate check passa: `npx vitest run tests/features/ranking-engine/services/persist-ranking.test.ts`
- [x] Test count: 4+ testes passam

**Tests**: unit
**Gate**: quick

---

### T7: `features/ranking-engine/services/recompute-rankings.ts`

**What**: Orquestrador `recomputeRankings()` — computa e persiste os 3 rankings sequencialmente, retorna contagens.
**Where**: `features/ranking-engine/services/recompute-rankings.ts`
**Depends on**: T3, T4, T5, T6
**Reuses**: N/A
**Requirement**: RANK-01, RANK-02, RANK-03, RANK-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Chama os 3 `compute-*` e `persistRanking` correspondente, na ordem accuracy → discipline → money_saved
- [x] Retorna `{ accuracyRanked, disciplineRanked, moneySavedRanked }`
- [x] Gate check passa: `npx vitest run tests/features/ranking-engine/services/recompute-rankings.test.ts`
- [x] Test count: 3+ testes passam

**Tests**: unit
**Gate**: quick

---

### T8: `features/ranking-engine/index.ts`

**What**: Barrel de API pública do feature.
**Where**: `features/ranking-engine/index.ts`
**Depends on**: T7
**Reuses**: Padrão de `features/prediction-processing/index.ts`
**Requirement**: RANK-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Exporta `recomputeRankings` (e tipos públicos necessários)
- [x] `tsc --noEmit` sem erros

**Tests**: none (barrel)
**Gate**: build

---

### T9: Estender `SyncType` com `"rankings"` [P]

**What**: Adicionar `"rankings"` à union `SyncType` em `sync-lock-service.ts`.
**Where**: `features/sports-sync/services/sync-lock-service.ts`
**Depends on**: None
**Reuses**: `withSyncLock` existente
**Requirement**: RANK-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `SyncType` inclui `"rankings"`
- [x] Teste existente `tests/features/sports-sync/services/sync-lock-service.test.ts` continua passando
- [x] Gate check passa: `npx vitest run tests/features/sports-sync/services/sync-lock-service.test.ts`

**Tests**: unit (teste existente, sem novo)
**Gate**: quick

---

### T10: `app/api/rankings/process/route.ts`

**What**: Rota `POST` que valida `x-sync-secret`, chama `withSyncLock("rankings", () => recomputeRankings())`, trata `SyncAlreadyRunningError` (409) e erros genéricos (500).
**Where**: `app/api/rankings/process/route.ts`
**Depends on**: T8, T9
**Reuses**: Template de `app/api/predictions/process/route.ts`
**Requirement**: RANK-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Sem `x-sync-secret` válido → 401, sem chamar o serviço
- [x] Com secret válido → 200 com `{ accuracyRanked, disciplineRanked, moneySavedRanked }`
- [x] `SyncAlreadyRunningError` → 409
- [x] Erro genérico → 500
- [x] Gate check passa: `npx vitest run tests/app/api/rankings/process/route.test.ts`
- [x] Test count: 4+ testes passam (mesmo padrão de `tests/app/api/predictions/process/route.test.ts`)

**Tests**: unit/integration
**Gate**: quick

---

### T11: Ativar step de ranking recompute no cron

**What**: Adicionar step "Trigger ranking recompute" em `.github/workflows/live-sync.yml`, logo após "Trigger prediction processing".
**Where**: `.github/workflows/live-sync.yml`
**Depends on**: T10
**Reuses**: Estrutura do step existente de prediction processing
**Requirement**: RANK-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Step adicionado, chamando `POST /api/rankings/process` com `x-sync-secret`, após "Trigger prediction processing"
- [x] YAML válido

**Tests**: none (config de CI)
**Gate**: none

---

## Task Verification Standards

Todas as tarefas seguem o padrão de teste inferido: Vitest, `vi.mock("@/lib/supabase/admin")`, ambiente `node`, comando `npx vitest run <path>`.

---

## Requirement Traceability Coverage

RANK-01 a RANK-04 mapeados nas tarefas acima (ver campo `Requirement` de cada task). `spec.md` será atualizado após aprovação deste documento.
