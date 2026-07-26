# Review — match-sync-engine

**Modo:** Local
**Escopo:** 24 arquivos (feature `match-sync-engine`) — 13 modificados + 11 novos, 0 commits (mudanças em `main`, não commitadas)
**Subagentes:** 6 de 6 (Security, Requirements, Tests, Architecture, Regression, Performance)
**Docs carregados:** `match-sync-engine/context.md`, `match-sync-engine/design.md`, `match-sync-engine/spec.md`, `match-sync-engine/tasks.md`, `CLAUDE.md`
**Findings:** 5 across 3 files (0 SECURITY, 0 CRITICAL, 3 PERFORMANCE, 0 WARNING, 2 SUGGESTION)

---

## SECURITY (0)

Nenhum. RLS `deny-all` aplicada em `sync_runs` (o gap encontrado e corrigido na feature anterior não se repetiu); `encodeURIComponent` presente em `updateFinishedMatches`; as 2 rotas novas seguem a mesma proteção `isValidSyncSecret` das demais; mensagem de `SyncAlreadyRunningError` no `409` não vaza detalhe interno (só o nome do `type`, de um enum fechado).

## CRITICAL (0)

Nenhum.

## PERFORMANCE (3) — ✅ Corrigidos

- ✅ **Corrigido** — `features/sports-sync/services/finished-matches-sync-service.ts`: `.limit(STUCK_MATCHES_LIMIT)` (500) adicionado à query; `console.warn` quando o resultado bate o teto, sinalizando backlog anormal em vez de processar silenciosamente um volume sem controle.
- ✅ **Corrigido** — `features/sports-sync/services/sync-lock-service.ts`: reap-then-insert fundidos num único round-trip via função Postgres `acquire_sync_lock` (`supabase/migrations/00000000000013_add_acquire_sync_lock_function.sql`), chamada via `supabaseAdmin.rpc(...)`. `withSyncLock` cai de 3 para 2 round-trips por chamada (`runFullSync` de 15 para 10).
- ✅ **Corrigido** — `features/sports-sync/services/finished-matches-sync-service.ts`: `select` reduzido para `"competitions(external_id)"` — `id`/`external_id` de `matches` (nunca consumidos) removidos.

## WARNING (0)

`yarn.lock` aparece novamente no diff — já confirmado nas rodadas anteriores que é necessário (hook local de lint do ambiente), não é um achado novo.

## SUGGESTION (2) — não bloqueantes

- Branches de erro do Supabase (`if (error) throw`) em `sync-lock-service.ts` (reap/acquire genérico/finish), `update-match-row.ts` e `finished-matches-sync-service.ts` sem teste dedicado — mesma categoria de gap já aceita em features anteriores, mas a contagem de branches não cobertos cresceu (5 novos). Vale um lote de testes futuro, sem bloquear esta feature.

---

## Files With No Findings

- `lib/sports-provider/types.ts`, `thesportsdb-provider.ts` (+`.test.ts`)
- `features/sports-sync/services/match-sync-service.ts` (+`.test.ts`)
- `features/sports-sync/services/update-match-row.ts` (+`.test.ts`)
- `features/sports-sync/services/live-matches-sync-service.ts`
- `features/sports-sync/index.ts`
- Todas as 6 rotas `app/api/sync/*` (+`.test.ts`)
- `supabase/migrations/00000000000012_create_sync_runs.sql`

---

## Highlights

- **Security:** índice único parcial `sync_runs_one_running_per_type` resolve a race condition de lock no nível do banco, não do app — mesmo padrão sólido já usado em `ranking_cache_general_unique`.
- **Requirements:** todos os 19 acceptance criteria + 4 edge cases de `spec.md` batem com o código real; 11/11 tasks; `MatchSyncService` confirmado como camada fina de lock + delegação, zero lógica de negócio duplicada; `runFullSync` sequencial na ordem certa; zero SPEC_DEVIATION, zero scope creep.
- **Tests:** 92/92 testes passam (18 arquivos); `live-matches-sync-service.test.ts` original continua intocado e passando após o refactor de `update-match-row.ts` — prova de refactor seguro guiado por teste.
- **Architecture:** `sync-lock-service`/`match-sync-service` corretamente em `features/sports-sync/services/` (não `lib/`); `update-match-row.ts` extraído e reusado por `live` e `finished` antes de duplicar; nenhuma violação nas 7 regras do checklist.
- **Regression:** cast `as unknown as StuckMatchRow[]` em `finished-matches-sync-service.ts` verificado como legítimo (limitação real de tipos do client Supabase sem schema gerado, não alucinação); `error.code === "23505"` confirmado como forma real de detectar `unique_violation` no `@supabase/supabase-js`; refactor de `live-matches-sync-service.ts` comportamentalmente idêntico ao original.
- **Performance:** `finished-matches-sync-service.ts` reaproveita `mapWithConcurrency`/`DEFAULT_CONCURRENCY_LIMIT` corretamente nos dois estágios de fan-out — nenhuma regressão de `Promise.all` sem limite reintroduzida.
