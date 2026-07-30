# Matches Feature — Review

**Data:** 2026-07-29
**Modo:** Local (working tree não commitado, sem branch de feature — base == HEAD == `main`)
**Escopo:** 37 arquivos (4 modificados, 18 fonte novos, 15 teste novos) — feature `matches`

---

## Status dos Fixes (aplicados em 2026-07-29)

| Finding                                                                                  | Outcome                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL — deep-import em `route.ts`                                                     | **fixed** — export adicionado a `features/matches/index.ts`, import trocado para `@/features/matches`                                                                                                                                                                                                                                                             |
| SECURITY — placar sem validação server-side                                              | **fixed** — schema zod (`uuid`, `int().min(0).max(99)`) no Server Action antes do upsert                                                                                                                                                                                                                                                                          |
| SECURITY — erro cru do Supabase vazando                                                  | **fixed** — `upsert-prediction.ts` loga o erro original e retorna mensagem genérica                                                                                                                                                                                                                                                                               |
| SECURITY — cursor/limit sem validação                                                    | **fixed** — `route.ts` valida `cursorMatchDate` (ISO-8601)/`cursorId` (uuid) e clampa `limit` a [1, 50]                                                                                                                                                                                                                                                           |
| PERFORMANCE — invalidação ampla do infinite query                                        | **fixed** — `useSubmitPrediction` agora usa `setQueriesData` (patch pontual) + `router.refresh()` para "Hoje"                                                                                                                                                                                                                                                     |
| PERFORMANCE — join de `predictions` sem filtro por usuário                               | **skipped** — corrigir exigiria sequenciar `resolveUserId` antes das queries de match (perdendo parte do paralelismo via `Promise.all` já validado) e reescrever os mocks de query builder testados; dado o volume esperado de predições por partida nesta fase do produto, o risco de retrabalho não compensa agora — mantido como otimização futura documentada |
| WARNING — divergência hydrate/HydrationBoundary vs design.md                             | **fixed** — `design.md`/`spec.md` atualizados para documentar `initialData` via props como a decisão real (em vez de reescrever a página para usar dehydrate/HydrationBoundary sem ganho funcional)                                                                                                                                                               |
| WARNING — catch vazio em `route.ts`                                                      | **fixed** — `console.error` adicionado antes da resposta 500                                                                                                                                                                                                                                                                                                      |
| WARNING — unhandled rejection em `predict-dialog.tsx`                                    | **fixed** — `mutateAsync` envolvido em try/catch com mensagem de erro genérica                                                                                                                                                                                                                                                                                    |
| WARNING — testes faltando (`PredictDialog`, `useSubmitPrediction`, `useUpcomingMatches`) | **fixed** — casos de vazio/erro de rede/falha de mutação adicionados                                                                                                                                                                                                                                                                                              |
| SUGGESTION — `get-upcoming-matches-page` caso vazio isolado                              | **fixed**                                                                                                                                                                                                                                                                                                                                                         |
| SUGGESTION — `MatchesPageContent` clique em "Carregar mais"                              | **fixed**                                                                                                                                                                                                                                                                                                                                                         |
| SUGGESTION — API pública incompleta                                                      | **fixed** — resolvido junto do fix do CRITICAL (export do service)                                                                                                                                                                                                                                                                                                |

Gate completo após os fixes: `npm test` → 203/203 (44 arquivos); `npm run lint` → limpo; `npm run build` → sucesso (`/matches` e `/api/matches/upcoming` presentes no output).

---

## Resumo

|                     |                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Modo**            | Local                                                                                                                       |
| **Escopo**          | 37 arquivos, 0 commits (working tree não commitado)                                                                         |
| **Subagentes**      | 6 de 6 (Security, Requirements, Tests, Architecture, Regression, Performance)                                               |
| **Docs carregados** | `matches/spec.md`, `matches/context.md`, `matches/design.md`, `matches/tasks.md`, `CLAUDE.md` (raiz), `CLAUDE.md` (pessoal) |
| **Findings**        | 13 (após deduplicação) em 8 arquivos                                                                                        |

---

### CRITICAL (1)

- `app/api/matches/upcoming/route.ts:3` — Route Handler importa `getUpcomingMatchesPage` direto de `features/matches/services/get-upcoming-matches-page`, furando a fronteira da feature (CLAUDE.md: "Never import internal files directly from another feature"). Causa raiz: `features/matches/index.ts` não reexporta esse service. Fix: adicionar `export * from "./services/get-upcoming-matches-page"` ao `index.ts` e importar via `@/features/matches` na route. _(Confirmado por Architecture; Regression também sinalizou o mesmo import como inconsistência.)_

### SECURITY (3)

- `features/matches/actions/predictions.ts:16`, `features/matches/services/upsert-prediction.ts:13` — `submitPrediction`/`upsertPrediction` não validam `predictedHomeScore`/`predictedAwayScore` no servidor (só existe zod no client). Server Action é endpoint HTTP exposto — chamada direta pode enviar negativos, floats, `NaN`/`Infinity`. Recomendação: replicar o schema zod (int, min 0, com teto) no servidor antes do upsert.
- `features/matches/services/upsert-prediction.ts:38` — mensagem crua do Postgres/PostgREST (`error.message`) é repassada ao client via `predict-dialog.tsx`, podendo vazar nomes de tabela/coluna/constraint. Recomendação: logar o erro original server-side, retornar mensagem genérica ao client.
- `app/api/matches/upcoming/route.ts:9-18`, `features/matches/services/get-upcoming-matches-page.ts:34-38` — `cursorMatchDate`/`cursorId` (query params) são interpolados sem validação de formato dentro de um filtro `.or()` do PostgREST, e `limit` não é clampado (nem checado contra NaN/negativo). Um cursor malformado pode quebrar a sintaxe do filtro; um `limit` arbitrário permite full-scan. Recomendação: validar `cursorMatchDate` (ISO-8601) e `cursorId` (uuid) antes de montar o filtro; clampar `limit` com `Math.min(Math.max(..., 1), MAX_LIMIT)`. _(Confirmado por Security, Regression e Performance — os três sinalizaram esse mesmo par de problemas de forma independente.)_

### PERFORMANCE (2)

- `features/matches/services/_shared.ts:8` — `MATCH_SELECT` embeda **todas** as `predictions` da partida (sem filtro por `user_id` na query), e `toMatchCardData` descarta todas menos a do usuário atual via `.find()` em memória. Payload cresce com a popularidade da partida, não com o tamanho de página. Recomendação: filtrar o embed por `user_id` na própria query Supabase (ou uma query separada `.eq("user_id", userId).in("match_id", ids)` com merge em memória).
- `features/matches/hooks/use-submit-prediction.ts:14` — `invalidateQueries({ queryKey: QUERY_KEYS.MATCHES })` casa por prefixo e força refetch de **todas** as páginas já carregadas do infinite query (não só a primeira), com `staleTime: Infinity` na query. Além disso não cobre "Hoje" (Server Component, fora do React Query). Recomendação: `setQueryData` pontual na página cacheada, ou `refetchType: "none"` + refetch manual da página visível; para "Hoje", `revalidatePath`/`router.refresh()`.

### WARNING (6)

- `app/(app)/matches/page.tsx:8` — Não usa `dehydrate`/`HydrationBoundary` como design.md especifica (diagrama mermaid); usa `initialData` via props no hook, que atinge o mesmo efeito funcional (sem refetch no mount) mas diverge do padrão documentado e do texto literal do critério MATCHES-01 #7 do spec.md. Recomendação: escolher um dos dois — implementar o hydrate real, ou atualizar design.md/spec.md para documentar "initialData via props" como a decisão final.
- `app/api/matches/upcoming/route.ts:24` — `catch` vazio (sem log) mascara a causa real de qualquer erro 500, dificultando debugging em produção.
- `features/matches/components/predict-dialog.tsx:73-86` — `mutateAsync` sem try/catch: se a mutation rejeitar (erro de rede, exceção do Server Action), vira unhandled rejection sem feedback ao usuário.
- `tests/features/matches/components/predict-dialog.test.tsx:43` — só o caso negativo é testado; faltam os casos "vazio" (mensagem "Obrigatório") e "decimal" (regex de inteiro).
- `tests/features/matches/hooks/use-submit-prediction.test.tsx:32` — sem teste para `{ ok: false }`/erro de mutação — hoje o `onSuccess` (que invalida cache) dispara mesmo quando a mutação retorna falha de negócio, sem teste que documente esse comportamento.
- `tests/features/matches/hooks/use-upcoming-matches.test.tsx:60` — sem teste do path de erro (`response.ok === false`) do `fetchNextPage`.

### SUGGESTION (3)

- `features/matches/index.ts:1-3` — API pública da feature incompleta (só exporta types, `getMatchesPageData` e `MatchesPageContent`); hooks/actions/demais componentes ficam de fora sem uma decisão explícita sobre o que é público.
- `tests/features/matches/services/get-upcoming-matches-page.test.ts:67` — caso "last page" usa 1 row, não 0 — o branch de resultado verdadeiramente vazio (`lastRow` undefined) não é exercitado isoladamente.
- `tests/features/matches/components/matches-page-content.test.tsx:104` — falta clicar em "Carregar mais" e verificar `fetchNextPage` chamado / botão desabilitado durante fetch.

---

## Requirements & Functional Validation

Ver relatório completo do subagente de Requirements (reproduzido aqui na íntegra, mode texto):

- **21/21 tasks de tasks.md** batem com o código.
- **MATCHES-01 a 06**: todos PASS, exceto:
  - **MATCHES-01 #7 — FAIL (documentado):** sem `dehydrate`/`HydrationBoundary` literal (ver WARNING acima).
  - **MATCHES-03 #5 — PARTIAL:** ausência de teste explícito cobrindo o caminho não-autenticado dentro da própria feature (a garantia vem do middleware de sessão do grupo `(app)`, não de uma checagem própria da feature).
- **Scope creep:** nenhum encontrado — todas as mudanças rastreiam a MATCHES-01..06 ou infraestrutura prevista em design.md.
- **SPEC_DEVIATION:** um marcador em `matches-page-content.tsx:15-18` (prop extra `upcomingPage`), avaliado como razoável.

---

## Arquivos Sem Findings

- `app/(app)/matches/error.tsx`
- `components/ui/dialog.tsx`
- `config/query-keys.ts`
- `eslint.config.mjs`
- `vitest.config.mts`
- `features/matches/components/match-card.tsx`
- `features/matches/components/match-group-section.tsx`
- `features/matches/hooks/use-upcoming-matches.ts` (implementação — o gap é só no teste, listado acima)
- `features/matches/lib/get-brazil-day-bounds.ts`
- `features/matches/lib/group-by-competition.ts`
- `features/matches/lib/prediction-status.ts`
- `features/matches/services/get-matches-page-data.ts`
- `features/matches/types/index.ts`

---

## Destaques Positivos

- **Security:** `resolveUserId`/`toMatchCardData` filtram corretamente predições de outros usuários em memória antes de montar a resposta — nenhum vazamento cross-user, apesar do select trazer todas as predições da partida via service-role client.
- **Requirements:** arquitetura, nomes de arquivo, interfaces e fluxo batem quase literalmente com design.md, incluindo o módulo compartilhado `_shared.ts` evitando duplicação entre os dois services de leitura.
- **Tests:** os testes de `upsertPrediction` e `getUpcomingMatchesPage` — os pontos mais sensíveis da feature — estão cobertos de forma exemplar, incluindo rejeição de "match already started" e paginação first/middle/last com verificação de que a escrita não ocorre nos paths de rejeição.
- **Architecture:** `_shared.ts` segue à risca a decisão técnica do design.md, e o Server Action evita corretamente importar `@/lib/supabase/admin` direto, delegando ao service.
- **Regression:** nenhum import fantasma ou API inventada — toda a superfície de `@tanstack/react-query` v5, `react-hook-form`+zod e Supabase usada corresponde às versões reais instaladas.
- **Performance:** `get-matches-page-data.ts` paraleliza corretamente via `Promise.all` (today-query + resolveUserId + upcoming primeira página), replicando o padrão já validado em `features/dashboard`.
