# Review — sports-provider

**Modo:** Local
**Escopo:** 22 arquivos novos (feature `sports-provider` + `sports-sync`) + `lib/env.ts`/`.env.example` modificados + 1 migration nova, 0 commits (mudanças em `main`, não commitadas)
**Subagentes:** 6 de 6 (Security, Requirements, Tests, Architecture, Regression, Performance)
**Docs carregados:** `sports-provider/context.md`, `sports-provider/design.md`, `sports-provider/spec.md`, `sports-provider/tasks.md`, `CLAUDE.md`
**Findings:** 9 across 8 files

---

## SECURITY (3) — ✅ Corrigidos

- ✅ **Corrigido** — Comparação de `x-sync-secret` agora usa `crypto.timingSafeEqual` via novo helper `lib/sync-auth.ts` (`isValidSyncSecret`), com early-return se os tamanhos diferirem. Aplicado nas 4 rotas.
- ✅ **Corrigido** — Adicionada regra ESLint `no-restricted-imports` (`eslint.config.mjs`) bloqueando `@/lib/supabase/admin` fora de `features/sports-sync/services/**`.
- ✅ **Corrigido** — `encodeURIComponent` aplicado em `externalCompetitionId`/`season` nas URLs de `syncTeams`/`syncMatches` em `lib/sports-provider/thesportsdb-provider.ts`.

---

## CRITICAL (1) — ✅ Corrigido

- ✅ **Corrigido** — `SportsProviderError`... `source` adicionado como membro obrigatório da interface `SportsProvider` (`lib/sports-provider/types.ts`), implementado em `TheSportsDBProvider.source = "thesportsdb"`. O export solto `THESPORTSDB_SOURCE` foi removido de `thesportsdb-provider.ts`; os 4 services agora usam `sportsProvider.source` (importado só do barrel `@/lib/sports-provider`), nunca a implementação concreta.

---

## PERFORMANCE (3) — ✅ Corrigidos

- ✅ **Corrigido** — `live-matches-sync-service.ts`: updates paralelizados via `Promise.all` (extraído para `updateOne`).
- ✅ **Corrigido** — `teams-sync-service.ts`: loop de competições paralelizado via `Promise.all`.
- ✅ **Corrigido** — `matches-sync-service.ts`: mesmo padrão, paralelizado via `Promise.all`, mantendo a resolução de `teamIdByExternalId` pré-carregada intacta.

---

## WARNING (2) — 1 corrigido, 1 revertido (falso positivo)

- ✅ **Corrigido** — Criado `features/sports-sync/index.ts` reexportando os 4 services; as 4 rotas agora importam de `@/features/sports-sync`. Os 4 testes de rota foram ajustados para mockar o barrel em vez do arquivo de service individual (evita puxar os outros 3 services reais/não-mockados via re-export).
- ⚠️ **Falso positivo, revertido** — `yarn.lock` na verdade É necessário: o hook local de lint do ambiente (`post-write-lint.sh`) roda `yarn install`/lint via yarn e falha sem o lockfile presente. Removê-lo quebrou o hook; foi restaurado com `yarn install`.

---

## SUGGESTION (3) — 2 corrigidas, 1 mantida como está

- **Mantida** — Branches de erro do Supabase sem teste dedicado nos 4 services — não bloqueador, registrado para uma rodada futura de hardening de testes.
- `bet-free-images/` — segue fora do escopo, não tocado.
- ✅ **Corrigida** — `design.md` atualizado: não afirma mais reuso do guard `getApps()/getApp()` (específico do Firebase SDK) para `lib/supabase/admin.ts`; agora descreve corretamente o padrão module-level client (mesmo de `lib/supabase/client.ts`).
- ✅ **Corrigida** — `updated_at` manual removido do payload de `.update()` em `live-matches-sync-service.ts` — o trigger do banco já cobre isso.

---

## Files With No Findings

- `lib/sports-provider/types.ts`
- `lib/sports-provider/index.ts`
- Todos os arquivos `*.test.ts` (11 arquivos) — 55/55 testes passam

---

## Highlights

- **Security:** `SUPABASE_SERVICE_ROLE_KEY`/`SYNC_SECRET` mantidos exclusivamente no bloco `server` de `env.ts` (nunca `NEXT_PUBLIC_*`); rotas retornam erro genérico sem vazar detalhes internos.
- **Requirements:** todos os 19 acceptance criteria + 4 edge cases de `spec.md` batem com o código real; 14/14 tasks têm implementação correspondente; regra de dependência (`lib/sports-provider` nunca importa Supabase) confirmada por grep; zero SPEC_DEVIATION.
- **Tests:** `thesportsdb-provider.test.ts` é exemplar — `describe` por método, `it.each` para os 13 valores de status (evita repetição), cobre os 3 tipos de falha (Zod, rede, HTTP) sem sobreposição de mocks.
- **Architecture:** separação fetch-vs-persist respeitada estruturalmente — `lib/sports-provider/*` não importa nada de `lib/supabase` nem `features/*` (confirmado via grep); DTOs mantêm vocabulário normalizado sem vazar shape bruto do TheSportsDB.
- **Regression:** nenhuma alucinação de API do Supabase (sintaxe de `.upsert`/`.update`/`onConflict` confirmada contra o código real de `@supabase/supabase-js`); migration 00000000000011 referencia corretamente tabelas já existentes; nenhum TODO/FIXME.
- **Performance:** `matches-sync-service.ts` já evita N+1 no Supabase corretamente — pré-carrega `competitions`/`teams` em paralelo com `Promise.all` uma única vez e resolve times via `Map` em memória, upsert em lote por competição.

---

---

# Rodada 2 — verificação dos fixes + review completo

**Escopo:** mesmo conjunto da Rodada 1 + `lib/sync-auth.ts` (novo) + `eslint.config.mjs` modificado
**Subagentes:** 6 de 6
**Findings:** 2 PERFORMANCE (novos, introduzidos pelos fixes da Rodada 1) + 2 ARCHITECTURE (não bloqueantes) + 3 TESTS (SUGGESTION, não bloqueantes)

## Verificação dos fixes da Rodada 1

Todos os 9 fixes anteriores foram verificados de forma independente e confirmados corretos:

- **SECURITY (3/3):** `isValidSyncSecret` usa `timingSafeEqual` com early-return por tamanho (evita exceção); regra ESLint testada na prática (bloqueia fora de `sports-sync/services`, permite dentro); `encodeURIComponent` cobre todos os pontos que interpolam IDs externos.
- **CRITICAL (1/1):** `THESPORTSDB_SOURCE` não existe mais em lugar nenhum do projeto (`grep` confirma zero ocorrências); `source` é membro de `SportsProvider`, consumido via `sportsProvider.source` nos 4 services.
- **PERFORMANCE (3/3):** os 3 loops sequenciais foram de fato substituídos por `Promise.all` (não cosmético).
- **WARNING:** `features/sports-sync/index.ts` criado e adotado pelas 4 rotas e seus testes.
- **SUGGESTION:** `updated_at` manual removido; `design.md` corrigido.

Todos os 19 acceptance criteria + 4 edge cases do `spec.md` seguem passando; 55/55 testes; zero SPEC_DEVIATION.

## PERFORMANCE (2) — ✅ Corrigidos

- ✅ **Corrigido** — `features/sports-sync/services/teams-sync-service.ts` (e mesmo padrão em `matches-sync-service.ts`, `live-matches-sync-service.ts`): novo helper `lib/concurrency.ts` (`mapWithConcurrency`, worker-pool sem dependência nova) substitui `Promise.all` sem limite. `DEFAULT_CONCURRENCY_LIMIT = 3` aplicado nos 3 services — no máximo 3 chamadas simultâneas ao TheSportsDB/updates ao Supabase por vez, reduzindo a chance de estourar o rate limit do free tier e de saturar o pool de conexões.
  Coberto por `lib/concurrency.test.ts` (4 testes: ordem dos resultados, limite de concorrência respeitado de fato, propagação de erro, array vazio).

## ARCHITECTURE (2) — não bloqueantes

- `eslint.config.mjs` protege só `@/lib/supabase/admin` com `no-restricted-imports`; não há regra equivalente para `@/lib/sports-provider/thesportsdb-provider`, apesar do design.md exigir que só `index.ts` instancie `TheSportsDBProvider`. Hoje ninguém viola, mas o enforcement é assimétrico (um lado tem regra automatizada, o outro só convenção).
- `lib/sync-auth.ts` vive em `lib/` mas só é consumido por `features/sports-sync` até agora — defensável como primitivo genérico (timing-safe compare, zero acoplamento de domínio), mas vale decisão explícita se deveria ficar em `lib/` ou dentro da feature.

## TESTS (3) — SUGGESTION, não bloqueantes

- `lib/sync-auth.ts` sem teste unitário dedicado — lógica de segurança não trivial (early-return por tamanho antes do `timingSafeEqual`), hoje só exercitada indiretamente pelos testes de rota, faltando casos como "mesmo tamanho, valor diferente" e "tamanho diferente".
- Agregação via `Promise.all` (`matches-sync-service.ts` `results.reduce`, `live-matches-sync-service.ts` `results.filter`) não é testada com múltiplos itens — só `teams-sync-service.ts` tem teste com 2 competições validando a soma.
- `updateOne` (função extraída em `live-matches-sync-service.ts`) replica o mesmo padrão já aceito de branch de erro do Supabase sem teste dedicado.

## Files With No Findings (Rodada 2)

- `lib/sports-provider/types.ts`, `index.ts`
- `lib/supabase/admin.ts`
- `features/sports-sync/index.ts`
- `competitions-sync-service.ts` (sem mudança nesta rodada, não precisa paralelização — single call)
- Todos os `*.test.ts` — 55/55 passam

## Highlights (Rodada 2)

- **Security:** helper `isValidSyncSecret` testado na prática contra a regra ESLint nova (criado arquivo de teste manual violando a regra, confirmado bloqueio); zero vazamento de `lib/supabase/admin` fora do escopo permitido.
- **Requirements:** scope creep avaliado explicitamente — `lib/sync-auth.ts` e a regra ESLint são consequência direta de SPORTS-09 e do Success Criteria de isolamento do design.md, não adição não solicitada.
- **Tests:** confirmado que a ordenação de chamadas em `teams-sync-service.test.ts` (`toHaveBeenNthCalledWith`) continua correta após a paralelização — `Array.map` invoca callbacks síncronos em ordem antes do primeiro `await`, garantia da spec do JS, não coincidência de timing.
- **Architecture:** segunda passada de grep confirma que `TheSportsDBProvider`/`THESPORTSDB_SOURCE` não vazam para nenhum lugar fora de `lib/sports-provider/index.ts`.
- **Regression:** contadores agregados (`synced`/`skipped`/`updated`/`ignored`) verificados matematicamente corretos após a paralelização — sem dupla contagem, sem perda.
- **Performance:** pré-carregamento de `competitions`+`teams` em `matches-sync-service.ts` continua fora do loop paralelo — não regrediu para N+1.
