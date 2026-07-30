# Firebase Analytics Tasks

**Design**: `.specs/features/firebase-analytics/design.md`
**Status**: Done

**Nota sobre testes**: não existe `.specs/codebase/TESTING.md`. Convenção inferida do código existente: Vitest, `vi.mock` a nível de módulo para dependências externas (padrão já usado em `tests/features/matches/hooks/use-submit-prediction.test.tsx` e nos hooks de auth), Testing Library + jsdom pra componentes/hooks (glob já cobre `tests/features/matches/hooks/**`; `tests/features/navigation/**` já está no `JSDOM_GLOBS`; `tests/features/dashboard/components/**` idem — `PredictionResultsTracker` e `PageViewTracker` já caem nesses globs existentes, sem precisar editar `vitest.config.mts` desta vez). Comando `npx vitest run <path>`.

---

## Execution Plan

### Phase 1: Foundation (Parallel OK) — **Est. tokens**: ~35k

```
T1 (firebaseApp + measurementId env) ─┐
T3 (seen-predictions) ─┼─→ (nada bloqueado entre si)
T4 (DashboardPrediction.pointsEarned) ─┘
```

### Phase 2: Wrapper de eventos (Sequential) — **Est. tokens**: ~25k

```
T1 ──→ T2 (track-event.ts)
```

### Phase 3: Instrumentação (Parallel OK) — **Est. tokens**: ~50k

```
T2 ──→ T7 (Login)
T2 ──→ T8 (Prediction Created)
T2 ──→ T6 (PageViewTracker + AppShell)
T2,T3,T4 ──→ T5 (PredictionResultsTracker)
```

### Phase 4: Integração final (Sequential) — **Est. tokens**: ~15k

```
T5 ──→ T9 (wire tracker nas páginas Dashboard/Profile)
```

---

## Task Breakdown

### T1: Exportar `firebaseApp` + `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

**What**: Adicionar `export { app as firebaseApp }` em `lib/firebase/client.ts`; adicionar `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` ao schema `client` e ao `experimental__runtimeEnv` de `lib/env.ts`; documentar a nova var em `.env.example`.
**Where**: `lib/firebase/client.ts`, `lib/env.ts`, `.env.example`
**Depends on**: None
**Reuses**: Estrutura já existente de `lib/firebase/client.ts`/`lib/env.ts`
**Requirement**: ANLY-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `lib/firebase/client.ts` exporta `firebaseApp` (a mesma instância `app` já usada por `getAuth`)
- [x] `lib/env.ts` valida `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (client schema + runtimeEnv)
- [x] `.env.example` documenta a nova variável na seção Firebase
- [x] `npx tsc --noEmit` sem erros

**Tests**: none (config/env)
**Gate**: build

---

### T3: `lib/analytics/seen-predictions.ts` [P]

**What**: `markPredictionSeen(predictionId: string): boolean` — de-dup via `localStorage`.
**Where**: `lib/analytics/seen-predictions.ts`
**Depends on**: None
**Reuses**: N/A
**Requirement**: ANLY-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Primeira chamada para um `predictionId` novo retorna `true` e persiste no `localStorage`
- [x] Chamada subsequente para o mesmo `predictionId` retorna `false`
- [x] IDs diferentes são rastreados independentemente (não sobrescreve o set)
- [x] Erro de acesso ao `localStorage` (ex: mock lançando exceção) é capturado, retorna `true` (degrada para "sempre dispara"), sem lançar
- [x] Gate check passa: `npx vitest run tests/lib/analytics/seen-predictions.test.ts`
- [x] Test count: 4+ testes passam

**Tests**: unit (jsdom — precisa de `window.localStorage`; já coberto pois `tests/lib/**` roda no projeto `node` por padrão, então usar `vi.stubGlobal("localStorage", ...)` ou rodar este arquivo sob jsdom explicitamente — ver nota abaixo)
**Gate**: quick

**Nota de execução**: `tests/lib/**` não está em `JSDOM_GLOBS`, então roda no projeto `node` do Vitest, onde `window`/`localStorage` não existem nativamente. Mockar `localStorage` via `vi.stubGlobal("localStorage", { getItem, setItem })` dentro do teste (não editar `vitest.config.mts` — mais simples que mover o teste pra um glob jsdom só por causa de uma API global).

---

### T4: Estender `DashboardPrediction` com `pointsEarned` [P]

**What**: Adicionar `pointsEarned: 0 | 1 | null` ao tipo `DashboardPrediction`; estender a query e o mapeamento de `getLatestPredictions` em `get-dashboard-data.ts` para selecionar e repassar `points_earned`.
**Where**: `features/dashboard/types/index.ts`, `features/dashboard/services/get-dashboard-data.ts`
**Depends on**: None
**Reuses**: Query/mapeamento já existente de `getLatestPredictions`
**Requirement**: ANLY-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `DashboardPrediction.pointsEarned: 0 | 1 | null` adicionado ao tipo
- [x] Query de `getLatestPredictions` seleciona `points_earned` (além dos campos já buscados)
- [x] Mapeamento inclui `pointsEarned: row.points_earned` no objeto retornado
- [x] Teste existente `tests/features/dashboard/services/get-dashboard-data.test.ts` atualizado (rows mockadas passam a incluir `points_earned`) e continua passando
- [x] Gate check passa: `npx vitest run tests/features/dashboard/services/get-dashboard-data.test.ts`
- [x] Test count: testes existentes 100% passando, sem novo teste obrigatório (é extensão de campo, não lógica nova)

**Tests**: unit (teste existente atualizado)
**Gate**: quick

---

### T2: `lib/analytics/track-event.ts`

**What**: Wrapper único de disparo de eventos — inicialização lazy do Firebase Analytics, tolerante a falhas, fire-and-forget.
**Where**: `lib/analytics/track-event.ts`
**Depends on**: T1
**Reuses**: `firebaseApp` de `lib/firebase/client.ts`
**Requirement**: ANLY-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `AnalyticsEventName` union com os 7 nomes de evento (`login`, `prediction_created`, `prediction_won`, `prediction_lost`, `dashboard_viewed`, `profile_viewed`, `matches_viewed`)
- [x] `trackEvent(name: AnalyticsEventName): void` — não é `async` do ponto de vista do chamador
- [x] `typeof window === "undefined"` → no-op imediato, sem erro
- [x] `isSupported()` resolvendo `false` → todas as chamadas seguintes viram no-op (cacheado, não rechama `isSupported()` a cada evento)
- [x] `logEvent` lançando erro → capturado internamente, `console.error`, nunca propaga pro chamador
- [x] Inicialização do Analytics ocorre no máximo uma vez (cacheada em variável de módulo)
- [x] Gate check passa: `npx vitest run tests/lib/analytics/track-event.test.ts`
- [x] Test count: 5+ testes passam (mock de `firebase/analytics`: `isSupported`, `getAnalytics`, `logEvent`)

**Tests**: unit
**Gate**: quick

---

### T7: Instrumentar evento Login [P]

**What**: Adicionar `trackEvent("login")` no callback de sucesso pós-`syncSession`, em `use-email-password-mutation.ts` e `use-login-with-google.ts`.
**Where**: `features/auth/hooks/use-email-password-mutation.ts`, `features/auth/hooks/use-login-with-google.ts`
**Depends on**: T2
**Reuses**: `trackEvent` de `lib/analytics/track-event.ts`
**Requirement**: ANLY-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `use-email-password-mutation.ts`: `trackEvent("login")` chamado dentro do `onSuccess`, antes ou junto de `router.push`
- [x] `use-login-with-google.ts`: `trackEvent("login")` chamado em `resolveRedirect`, após `syncSession` bem-sucedido, antes de `router.push`
- [x] `AuthProvider`/`onAuthStateChanged` **não** é tocado (garantia de não duplicar em reload)
- [x] Testes existentes de ambos os hooks atualizados com `vi.mock("@/lib/analytics/track-event")` e assertiva de que `trackEvent` é chamado com `"login"` exatamente uma vez por fluxo de sucesso, zero vezes em erro
- [x] Gate check passa: `npx vitest run tests/features/auth/hooks/`
- [x] Test count: testes existentes + 2 novas asserções (uma por hook), todos passando

**Tests**: unit
**Gate**: quick

---

### T8: Instrumentar evento Prediction Created [P]

**What**: Adicionar `trackEvent("prediction_created")` dentro do `onSuccess` de `use-submit-prediction.ts`, após o guard `if (!result.ok) return;`.
**Where**: `features/matches/hooks/use-submit-prediction.ts`
**Depends on**: T2
**Reuses**: `trackEvent` de `lib/analytics/track-event.ts`
**Requirement**: ANLY-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `trackEvent("prediction_created")` chamado somente quando `result.ok === true`
- [x] Nenhum disparo quando `result.ok === false`
- [x] Teste existente `tests/features/matches/hooks/use-submit-prediction.test.tsx` atualizado com `vi.mock("@/lib/analytics/track-event")` e novas asserções (sucesso → 1 chamada; falha → 0 chamadas)
- [x] Gate check passa: `npx vitest run tests/features/matches/hooks/use-submit-prediction.test.tsx`
- [x] Test count: testes existentes + 2 novos casos, todos passando

**Tests**: unit
**Gate**: quick

---

### T6: `PageViewTracker` + integração no `AppShell` [P]

**What**: Componente client invisível que mapeia `pathname` → evento de page view; integrado no `AppShell`.
**Where**: `features/navigation/components/page-view-tracker.tsx`, `features/navigation/components/app-shell.tsx`
**Depends on**: T2
**Reuses**: `trackEvent` de `lib/analytics/track-event.ts`
**Requirement**: ANLY-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `ROUTE_EVENTS` mapeia `"/home"` → `"dashboard_viewed"`, `"/profile"` → `"profile_viewed"`, `"/matches"` → `"matches_viewed"`
- [x] `useEffect` reagindo a `usePathname()` dispara o evento correspondente quando a rota está no mapa
- [x] Rota fora do mapa (ex: `/rankings`) não dispara nada
- [x] Navegação entre 2 rotas mapeadas dispara exatamente 1 evento por rota nova (não duplica ao permanecer na mesma rota)
- [x] `AppShell` renderiza `<PageViewTracker />` junto de `Sidebar`/`BottomNav`; componente retorna `null` (sem alteração visual)
- [x] Gate check passa: `npx vitest run tests/features/navigation/`
- [x] Test count: 4+ testes passam (mock de `next/navigation` `usePathname` + `vi.mock` de `trackEvent`)

**Tests**: unit (Testing Library, jsdom — já coberto por `tests/features/navigation/**` no `JSDOM_GLOBS`)
**Gate**: quick

---

### T5: `PredictionResultsTracker`

**What**: Componente client invisível que dispara Won/Lost para previsões resolvidas ainda não vistas.
**Where**: `features/dashboard/components/prediction-results-tracker.tsx`
**Depends on**: T2, T3, T4
**Reuses**: `trackEvent`, `markPredictionSeen`, tipo `DashboardPrediction` (agora com `pointsEarned`)
**Requirement**: ANLY-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Previsão com `pointsEarned === 1` e ainda não vista → `trackEvent("prediction_won")`, marcada como vista
- [x] Previsão com `pointsEarned === 0` e ainda não vista → `trackEvent("prediction_lost")`, marcada como vista
- [x] Previsão com `pointsEarned === null` → nenhum disparo
- [x] Re-render com as mesmas previsões (já vistas) → zero disparos adicionais
- [x] Componente retorna `null` — nenhuma marcação visual/HTML renderizado
- [x] Exportado via `features/dashboard/index.ts` (mesmo barrel dos demais componentes de dashboard)
- [x] Gate check passa: `npx vitest run tests/features/dashboard/components/prediction-results-tracker.test.tsx`
- [x] Test count: 5+ testes passam (mock de `trackEvent` e `markPredictionSeen`)

**Tests**: unit (Testing Library, jsdom — já coberto por `tests/features/dashboard/components/**` no `JSDOM_GLOBS`)
**Gate**: quick

---

### T9: Renderizar `PredictionResultsTracker` nas páginas Dashboard e Profile

**What**: Adicionar `<PredictionResultsTracker predictions={latestPredictions} />` em `app/(app)/home/page.tsx` e `app/(app)/profile/page.tsx`, ao lado de `LatestPredictionsSection` (mesma lista de previsões já buscada por ambas as páginas).
**Where**: `app/(app)/home/page.tsx`, `app/(app)/profile/page.tsx`
**Depends on**: T5
**Reuses**: `latestPredictions` já retornado por `getDashboardData`/`getProfileData` — nenhuma nova busca de dados
**Requirement**: ANLY-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `PredictionResultsTracker` renderizado em ambas as páginas, recebendo a mesma `latestPredictions` já usada por `LatestPredictionsSection`
- [x] Nenhuma mudança visual perceptível nas duas páginas
- [x] Sem teste dedicado de página (convenção do projeto — nenhuma página tem teste próprio)
- [x] `npx tsc --noEmit` sem erros
- [x] `npx vitest run` (suíte completa) sem regressões

**Tests**: none (páginas, sem precedente de teste no projeto)
**Gate**: build

---

## Task Verification Standards

Todas as tarefas seguem o padrão de teste inferido: Vitest, `vi.mock` a nível de módulo pra dependências externas/wrapper de analytics, Testing Library + jsdom pra componentes/hooks (globs já existentes cobrem os novos arquivos), comando `npx vitest run <path>`.

---

## Requirement Traceability Coverage

ANLY-01 a ANLY-05 mapeados nas tarefas acima (ver campo `Requirement` de cada task). `spec.md` será atualizado após aprovação deste documento.
