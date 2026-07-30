# PredictionProcessor Tasks

**Design**: `.specs/features/prediction-processor/design.md`
**Status**: Done

**Nota sobre testes**: não existe `.specs/codebase/TESTING.md`. Convenção inferida do código existente (`tests/features/sports-sync/services/*.test.ts`): Vitest, ambiente `node` para services/lib puros, `vi.mock` sobre `@/lib/supabase/admin`, comando `npx vitest run <path>`. Testes ficam em `tests/` espelhando a estrutura de `features/`/`lib/`/`app/`.

---

## Execution Plan

### Phase 1: Foundation — schema + shared libs (Parallel OK) — **Est. tokens**: ~40k

```
T1 (migration) ─┐
T2 (gamification lib) ─┼─→ (nada bloqueado entre si)
T3 (brazil-time lib) ─┘
```

### Phase 2: Refactors sobre a fundação (Parallel OK) — **Est. tokens**: ~35k

```
T2 ──→ T4 (refactor dashboard)
T1 ──→ T13 (wagered_amount na criação de previsão)
```

### Phase 3: Domínio puro do processor (Parallel OK) — **Est. tokens**: ~45k

```
T5 (types) ──┐
T6 (evaluate-outcome) ──┤
T1 ──→ T7 (fetch-pending-predictions) ──┤
T2,T3,T5,T6 ──→ T8 (apply-prediction-results)
```

### Phase 4: Orquestração + rota (Sequential) — **Est. tokens**: ~40k

```
T7,T8 ──→ T9 (process-pending-predictions) ──→ T10 (index.ts)
T11 (SyncType) ──┘
T10,T11 ──→ T12 (route)
```

### Phase 5: Integração final (Sequential) — **Est. tokens**: ~10k

```
T12 ──→ T14 (descomenta step do cron)
```

---

## Task Breakdown

### T1: Migration — colunas novas + constraint de sync_runs

**What**: Criar `supabase/migrations/00000000000015_add_prediction_processing_columns.sql` com: `predictions.wagered_amount NUMERIC(10,2) CHECK (> 0)`, `users.last_streak_date DATE`, e substituição do CHECK de `sync_runs.type` para incluir `'predictions'`.
**Where**: `supabase/migrations/00000000000015_add_prediction_processing_columns.sql`
**Depends on**: None
**Reuses**: Padrão de `00000000000014_add_gamification_columns_to_users.sql` e `00000000000012_create_sync_runs.sql`
**Requirement**: PRED-03, PRED-04, PRED-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Migration aplica sem erro localmente (`supabase migration up` ou equivalente do projeto)
- [x] Nome exato da constraint de `sync_runs.type` confirmado antes do `DROP CONSTRAINT` (verificar via `\d sync_runs` ou `pg_constraint`)
- [x] `predictions.wagered_amount` aceita `NULL` e rejeita valores `<= 0`
- [x] `sync_runs` aceita `type = 'predictions'`

**Tests**: none (migration SQL, verificado por aplicação local)
**Gate**: build (migration precisa aplicar sem erro)

---

### T2: `lib/gamification.ts` [P]

**What**: Criar módulo com `XP_THRESHOLD`, `levelForXp(xp)`, `xpInLevelForXp(xp)`.
**Where**: `lib/gamification.ts`
**Depends on**: None
**Reuses**: Fórmula hoje inline em `features/dashboard/services/get-dashboard-data.ts`
**Requirement**: PRED-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `levelForXp(0) === 1`, `levelForXp(2999) === 1`, `levelForXp(3000) === 2`
- [x] `xpInLevelForXp(3500) === 500`
- [x] Gate check passa: `npx vitest run tests/lib/gamification.test.ts`
- [x] Test count: 4+ testes passam

**Tests**: unit
**Gate**: quick

---

### T3: `lib/brazil-time.ts` [P]

**What**: Criar `getBrazilCalendarDay(date: Date): string` retornando `YYYY-MM-DD` no fuso `America/Sao_Paulo` (offset fixo `-03:00`).
**Where**: `lib/brazil-time.ts`
**Depends on**: None
**Reuses**: Lógica de `todayInBrazil()` em `features/matches/lib/get-brazil-day-bounds.ts`
**Requirement**: PRED-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Data UTC próxima da meia-noite (ex: `2026-01-01T02:00:00Z`) resolve para o dia civil correto em `-03:00` (`2025-12-31`)
- [x] Gate check passa: `npx vitest run tests/lib/brazil-time.test.ts`
- [x] Test count: 3+ testes passam

**Tests**: unit
**Gate**: quick

---

### T4: Refatorar dashboard para usar `lib/gamification.ts` [P]

**What**: Substituir `XP_THRESHOLD` local e fórmula inline em `features/dashboard/services/get-dashboard-data.ts` por import de `lib/gamification.ts`. Nenhuma mudança de comportamento observável.
**Where**: `features/dashboard/services/get-dashboard-data.ts`
**Depends on**: T2
**Reuses**: `lib/gamification.ts`
**Requirement**: PRED-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `zeroStats()` e `getDashboardData()` usam `XP_THRESHOLD`, `levelForXp`, `xpInLevelForXp` importados
- [x] Constante local e fórmula duplicada removidas
- [x] Gate check passa: `npx vitest run tests/features/dashboard/services/get-dashboard-data.test.ts`
- [x] Test count: todos os testes existentes continuam passando (sem novos)

**Tests**: unit (testes existentes, sem novos)
**Gate**: quick

---

### T5: `features/prediction-processing/types/index.ts` [P]

**What**: Definir `PendingPrediction` e `UserGamificationState` conforme design.
**Where**: `features/prediction-processing/types/index.ts`
**Depends on**: None
**Reuses**: N/A
**Requirement**: PRED-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Tipos exportados batem exatamente com os campos do design.md
- [x] `tsc --noEmit` sem erros

**Tests**: none (apenas tipos)
**Gate**: build

---

### T6: `features/prediction-processing/lib/evaluate-outcome.ts` [P]

**What**: Funções puras `matchOutcome(homeScore, awayScore)` e `isWinningPrediction(predicted, actual)`.
**Where**: `features/prediction-processing/lib/evaluate-outcome.ts`
**Depends on**: None
**Reuses**: N/A
**Requirement**: PRED-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `matchOutcome` cobre os 3 casos (`home`, `draw`, `away`)
- [x] `isWinningPrediction` retorna `true` quando resultado previsto == resultado real (incluindo empate previsto = empate real) e `false` em qualquer divergência
- [x] Gate check passa: `npx vitest run tests/features/prediction-processing/lib/evaluate-outcome.test.ts`
- [x] Test count: 6+ testes passam (cobrindo win por V, E, D e lose correspondentes)

**Tests**: unit
**Gate**: quick

---

### T7: `features/prediction-processing/services/fetch-pending-predictions.ts`

**What**: `fetchPendingPredictions(): Promise<PendingPrediction[]>` — busca `predictions` com `points_earned IS NULL` join `matches!inner` filtrando `status = 'finished'`, limite `PENDING_PREDICTIONS_LIMIT = 500` com warning se atingido.
**Where**: `features/prediction-processing/services/fetch-pending-predictions.ts`
**Depends on**: T1, T5
**Reuses**: Padrão de query/warning de `features/sports-sync/services/finished-matches-sync-service.ts` (`STUCK_MATCHES_LIMIT`)
**Requirement**: PRED-01, PRED-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Query filtra corretamente por `points_earned IS NULL` e `matches.status = 'finished'`
- [x] `wagered_amount` incluído no resultado (pode ser `null`)
- [x] `console.warn` disparado quando resultado atinge o limite de 500
- [x] Gate check passa: `npx vitest run tests/features/prediction-processing/services/fetch-pending-predictions.test.ts`
- [x] Test count: 3+ testes passam (mock de `supabaseAdmin` como em `tests/features/sports-sync/services/finished-matches-sync-service.test.ts`)

**Tests**: unit
**Gate**: quick

---

### T8: `features/prediction-processing/services/apply-prediction-results.ts`

**What**: Função pura `applyPredictionResults(user, predictions)` — calcula `points_earned` por previsão e o novo estado do usuário (xp, level, money_saved, current_streak, last_streak_date), processando previsões em ordem cronológica.
**Where**: `features/prediction-processing/services/apply-prediction-results.ts`
**Depends on**: T2, T3, T5, T6
**Reuses**: `lib/gamification.ts`, `lib/brazil-time.ts`, `evaluate-outcome.ts`
**Requirement**: PRED-01, PRED-02, PRED-03, PRED-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Win soma 100 XP, Lose soma 0
- [x] `level` recalculado via `levelForXp` sobre o novo `xp` total
- [x] `money_saved` incrementado por `wagered_amount` quando presente, ou R$10 quando `null`, em toda previsão (Win ou Lose)
- [x] `current_streak` incrementa 1 por dia civil distinto (comparado a `last_streak_date` evoluindo previsão a previsão), nunca decrementa
- [x] Múltiplas previsões no mesmo dia civil incrementam o streak uma única vez
- [x] Gate check passa: `npx vitest run tests/features/prediction-processing/services/apply-prediction-results.test.ts`
- [x] Test count: 8+ testes passam (cobrindo win/lose, streak mesmo dia, streak dias diferentes, fallback de wagered_amount)

**Tests**: unit
**Gate**: quick

---

### T9: `features/prediction-processing/services/process-pending-predictions.ts`

**What**: Orquestrador `processPendingPredictions()` — busca pendentes, agrupa por usuário (ordenado por `matchDate`), processa cada grupo via `mapWithConcurrency`, persiste `users` e `predictions.points_earned` por usuário, isolando erros por usuário.
**Where**: `features/prediction-processing/services/process-pending-predictions.ts`
**Depends on**: T7, T8
**Reuses**: `lib/concurrency.ts` (`mapWithConcurrency`, `DEFAULT_CONCURRENCY_LIMIT`), padrão de update pontual de `update-match-row.ts`
**Requirement**: PRED-01, PRED-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Agrupamento por `userId`, ordenação por `matchDate` ascendente dentro de cada grupo
- [x] Erro em um usuário (mock de erro Supabase) não impede a persistência dos demais usuários (try/catch por worker)
- [x] `predictions.points_earned` atualizado individualmente por previsão processada
- [x] Retorna `{ usersUpdated, predictionsProcessed }`
- [x] Gate check passa: `npx vitest run tests/features/prediction-processing/services/process-pending-predictions.test.ts`
- [x] Test count: 5+ testes passam

**Tests**: unit
**Gate**: quick

---

### T10: `features/prediction-processing/index.ts`

**What**: Barrel de API pública do feature.
**Where**: `features/prediction-processing/index.ts`
**Depends on**: T9
**Reuses**: Padrão de `features/sports-sync/index.ts`
**Requirement**: PRED-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Exporta `processPendingPredictions` (e tipos públicos necessários)
- [x] `tsc --noEmit` sem erros

**Tests**: none (barrel)
**Gate**: build

---

### T11: Estender `SyncType` com `"predictions"` [P]

**What**: Adicionar `"predictions"` à union `SyncType` em `sync-lock-service.ts`.
**Where**: `features/sports-sync/services/sync-lock-service.ts`
**Depends on**: None
**Reuses**: `withSyncLock` existente (sem outra mudança de lógica)
**Requirement**: PRED-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `SyncType` inclui `"predictions"`
- [x] Teste existente `tests/features/sports-sync/services/sync-lock-service.test.ts` continua passando
- [x] Gate check passa: `npx vitest run tests/features/sports-sync/services/sync-lock-service.test.ts`

**Tests**: unit (teste existente, sem novo)
**Gate**: quick

---

### T12: `app/api/predictions/process/route.ts`

**What**: Rota `POST` que valida `x-sync-secret`, chama `withSyncLock("predictions", () => processPendingPredictions())`, trata `SyncAlreadyRunningError` (409) e erros genéricos (500).
**Where**: `app/api/predictions/process/route.ts`
**Depends on**: T10, T11
**Reuses**: Template de `app/api/sync/finished/route.ts`, `isValidSyncSecret`, `env.SYNC_SECRET`
**Requirement**: PRED-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Sem `x-sync-secret` válido → 401, sem chamar o processor
- [x] Com secret válido → 200 com `{ usersUpdated, predictionsProcessed }`
- [x] `SyncAlreadyRunningError` → 409
- [x] Erro genérico → 500
- [x] Gate check passa: `npx vitest run tests/app/api/predictions/process/route.test.ts`
- [x] Test count: 4+ testes passam (mesmo padrão de `tests/app/api/sync/finished/route.test.ts`, se existir; caso não exista, seguir estrutura equivalente)

**Tests**: unit/integration (mock de `withSyncLock` e do serviço)
**Gate**: quick

---

### T13: Aceitar `wagered_amount` opcional na criação de previsão

**What**: `submitPrediction` (zod: `wageredAmount` opcional, `z.number().positive()`, sem teto) e `upsertPrediction` passam a aceitar e persistir `wagered_amount`.
**Where**: `features/matches/actions/predictions.ts`, `features/matches/services/upsert-prediction.ts`
**Depends on**: T1
**Reuses**: Schema zod e fluxo de upsert já existentes
**Requirement**: PRED-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `wageredAmount` ausente → `wagered_amount = NULL` gravado (comportamento atual preservado)
- [x] `wageredAmount <= 0` → validação zod rejeita antes de chegar ao banco
- [x] `wageredAmount` válido → persistido em `predictions.wagered_amount`
- [x] Gate check passa: `npx vitest run tests/features/matches/actions/predictions.test.ts tests/features/matches/services/upsert-prediction.test.ts`
- [x] Test count: todos os testes existentes + 3+ novos (caso ausente, caso inválido, caso válido)

**Tests**: unit
**Gate**: quick

---

### T14: Ativar step de prediction processing no cron

**What**: Descomentar o step "Trigger prediction processing" em `.github/workflows/live-sync.yml`.
**Where**: `.github/workflows/live-sync.yml`
**Depends on**: T12
**Reuses**: Bloco já escrito como comentário no próprio arquivo
**Requirement**: PRED-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Step descomentado, chamando `POST /api/predictions/process` com `x-sync-secret`, logo após "Update finished matches"
- [x] YAML válido (`yamllint` ou equivalente, se disponível no projeto)

**Tests**: none (config de CI)
**Gate**: none

---

## Task Verification Standards

Todas as tarefas seguem o padrão de teste inferido: Vitest, `vi.mock("@/lib/supabase/admin")`, ambiente `node`, comando `npx vitest run <path>`. Nenhum TESTING.md formal existe — este documento serve como referência até que um seja criado.

---

## Requirement Traceability Coverage

PRED-01 a PRED-05 mapeados nas tarefas acima (ver campo `Requirement` de cada task). `spec.md` será atualizado após aprovação deste documento.
