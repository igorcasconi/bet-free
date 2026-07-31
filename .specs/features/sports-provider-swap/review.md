# Sports Provider Swap (Multi-Provider) — Review

**Modo:** Local (working tree não commitado, sem commits à frente de `origin/main`)
**Branch:** main
**Escopo:** 27 arquivos (diff de working tree + arquivos novos untracked relevantes)
**Subagents:** 6 de 6 — Security, Requirements & Functional Validation, Test Coverage, Architecture & Conventions, Regression & Hallucination Detection, Performance
**Docs carregados:** `sports-provider-swap/spec.md`, `sports-provider-swap/context.md`, `sports-provider-swap/design.md`, `sports-provider-swap/tasks.md`, `CLAUDE.md`

---

## Resumo

|               |                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Modo**      | Local                                                                                     |
| **Escopo**    | 27 arquivos (16 modificados/deletados rastreados + 8 novos + 3 fora do escopo da feature) |
| **Subagents** | 6 de 6                                                                                    |
| **Findings**  | 7 across 6 arquivos                                                                       |

---

### SECURITY (1)

- `app/api/sync/live/route.ts:14,25` — `console.log(error)` despeja o erro completo (incluindo cause/ZodError com payload bruto de terceiros) no stdout sem redação/estrutura, em ambas as rotas de erro (401 e 500). Não vaza API keys (headers não entram na mensagem), mas é log frouxo que pode acumular dados de terceiros em agregadores sem controle de retenção. **Fora do escopo da feature sports-provider-swap** — mudança pré-existente de outra tarefa do usuário, sinalizada aqui só para rastreabilidade.
  - Recomendação: logar `error.message` + id de correlação, ou usar logger estruturado com redação de campos sensíveis.

### CRITICAL (1)

- `features/sports-sync/services/finished-matches-sync-service.ts:89-96` — o guard "external_source desconhecido → `console.warn` + skip, sem lançar" não tem teste cobrindo esse branch especificamente em `finished-matches-sync-service.test.ts` (só usa sources que batem com os providers mockados). Se uma regressão futura remover o `if (!provider)`, nenhum teste detecta.
  - Recomendação: adicionar teste com `external_source: "unknown-source"`, espiar `console.warn`, assertar que retorna sem lançar e sem chamar `updateFinishedMatches`.

### PERFORMANCE (1)

- `lib/sports-provider/dadosfutebol-provider.ts:114-147` — `fetchAllPages` não tem cap superior de páginas; depende inteiramente de `meta.pagina_atual`/`meta.ultima_pagina` vindos da API externa (ainda não validados contra a API real, ver Open Questions do `context.md`). Se a API retornar `meta` malformado, o loop roda indefinidamente acumulando itens em memória.
  - Recomendação: adicionar um `MAX_PAGES` defensivo que lança `SportsProviderError` se excedido.

### WARNING (0)

_(o achado de `console.log` em `app/api/sync/live/route.ts` foi consolidado em SECURITY acima para evitar duplicidade entre subagents)_

### SUGGESTION (4)

- `features/sports-sync/services/update-match-row.ts:25` — falta teste cobrindo propagação de erro do Supabase (`if (error) throw error`). Gap pré-existente, barato de fechar já que a assinatura mudou nesta feature.
- `features/sports-sync/services/competitions-sync-service.ts:20-22` — falta teste do branch "todos os providers retornam `[]`" (`return { synced: 0 }` sem upsert).
- `lib/sports-provider/dadosfutebol-provider.ts:110` — `configuredLeagueIds` (split+trim por vírgula) duplicado idêntico em `football-data-provider.ts:109`. Duplicação real, mas de baixo custo/baixo ganho — não bloqueia, mencionar se um dos arquivos for tocado de novo.
- `config/providers/theme-provider.tsx:13` — `defaultTheme` mudou de `"system"` para `"light"`, mudança não relacionada à feature sports-provider-swap misturada no mesmo working tree. Sinalizado só para rastreabilidade/isolamento de commits.

---

## Requirements & Functional Validation (detalhado)

**Fonte:** `spec.md`, `context.md`, `design.md`, `tasks.md`

Todos os 21 critérios de aceite (MPROV-01 a MPROV-21) avaliados como **✅ PASS** contra o diff real, incluindo a reversão crítica de `syncTeams(competitionSlug)` → `syncTeams(externalCompetitionId)` (T3) confirmada em `types.ts`/`teams-sync-service.ts`. 15/15 tasks de `tasks.md` confirmadas refletidas no código. Grep full-repo confirma zero resíduo de `thesportsdb`/`TheSportsDBProvider`/env vars antigas fora de `.specs/`. `yarn tsc --noEmit` limpo, `yarn vitest run` → 355/355 testes passando.

Nenhuma discrepância entre tasks.md e o diff. Scope creep identificado: `app/api/sync/live/route.ts` e `config/providers/theme-provider.tsx` (mudanças paralelas de outra tarefa, não falhas desta feature).

---

## Files With No Findings

- `lib/sports-provider/football-data-provider.ts`
- `lib/sports-provider/http.ts`
- `lib/sports-provider/normalize.ts`
- `lib/sports-provider/index.ts`
- `lib/env.ts`, `.env.example`
- `features/sports-sync/services/teams-sync-service.ts`
- `features/sports-sync/services/matches-sync-service.ts`
- `features/sports-sync/services/live-matches-sync-service.ts`
- Todos os arquivos de teste (`tests/lib/sports-provider/*.test.ts`, `tests/features/sports-sync/services/*.test.ts`) — cobertos na seção Test Coverage acima, sem findings adicionais além dos 2 SUGGESTION já listados

---

## Highlights

- **Security:** nenhuma API key vaza para logs/URLs/erros; toda entrada de path passa por `encodeURIComponent`; validação de resposta via zod `safeParse` em ambos os providers.
- **Requirements:** 21/21 critérios de aceite PASS, incluindo a reversão intencional de `syncTeams` corretamente propagada por toda a cadeia (interface → provider → service → teste).
- **Test Coverage:** testes de throttling (`FootballDataProvider`) usam fake timers com precisão real (falha a 6000ms, passa a 6500ms) — teste de comportamento, não de implementação.
- **Architecture:** direção de dependência limpa (`lib/sports-provider/` sem imports de `features/`), extração de `http.ts`/`normalize.ts` capturou exatamente a duplicação real sem abstração especulativa.
- **Regression:** nenhum import fantasma, nenhum resíduo do singleton `sportsProvider` ou do dispatch por slug antigo; reversão de `syncTeams` consistente ponta a ponta.
- **Performance:** multi-provider corretamente paralelizado (`Promise.all`/`mapWithConcurrency`); nenhum await sequencial desnecessário introduzido pela troca.
