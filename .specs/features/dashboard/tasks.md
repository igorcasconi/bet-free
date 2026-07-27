# Dashboard Tasks

**Design**: `.specs/features/dashboard/design.md`
**Status**: Done

---

## Execution Plan

### Phase 1: Foundation (Parallel OK) — **Est. tokens**: ~80k

```
T1 (test infra: RTL+jsdom)   ─┐
T2 (migration users columns) ─┤
T3 (eslint config extension) ─┼── independentes, sem arquivo compartilhado
T4 (auth redirect hooks)     ─┤
T5 (get-current-user + test) ─┘
```

### Phase 2: Navigation Components (Parallel OK) — **Est. tokens**: ~50k

```
T1 ──→ T6 (Sidebar + test)
T1 ──→ T7 (BottomNav + test)
```

### Phase 3: Navigation Wiring (Sequential) — **Est. tokens**: ~30k

```
T6, T7 ──→ T8 (AppShell + test + features/navigation/index.ts)
```

### Phase 4: Dashboard Data Layer (Sequential) — **Est. tokens**: ~45k

```
T2, T3 ──→ T9 (types + get-dashboard-data.ts + test)
```

### Phase 5: Dashboard Base Components (Parallel OK) — **Est. tokens**: ~70k

```
T9 ──┬→ T10 (StatCard + test)
     ├→ T11 (MoneyPreservedCard + test)
     ├→ T12 (XpProgressCard + test)
     ├→ T13 (MatchCard + test)
     └→ T14 (LatestPredictionsSection + test)
```

### Phase 6: Dashboard Composite Component (Sequential) — **Est. tokens**: ~25k

```
T13 ──→ T15 (MatchListSection + test)
```

### Phase 7: Wiring (Sequential) — **Est. tokens**: ~40k

```
T5, T8, T9, T10, T11, T12, T14, T15 ──→ T16 (barrel + app/(app)/layout.tsx + home/page.tsx)
```

### Phase 8: Placeholder Routes (Sequential) — **Est. tokens**: ~20k

```
T16 ──→ T17 (4 páginas placeholder)
```

---

## Task Breakdown

### T1: Add component testing infra (jsdom + React Testing Library)

**What**: Instalar `@testing-library/react`, `@testing-library/dom`,
`@testing-library/jest-dom`, `jsdom`; configurar `vitest.config.mts` para
usar `jsdom` nos testes de componente (`tests/features/dashboard/components/**`,
`tests/features/navigation/**`) via `environmentMatchGlobs`, mantendo
`node` como default pros demais testes.
**Where**: `package.json`, `vitest.config.mts`
**Depends on**: None
**Reuses**: nenhum
**Requirement**: Infra (suporta DASH-02, DASH-03, DASH-04, DASH-05)

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Dependências instaladas como `devDependencies`
- [x] `vitest.config.mts` usa `test.projects` (equivalente atual — `environmentMatchGlobs` foi removido no Vitest 4) apontando os globs de componente pra `jsdom`
- [x] Suíte existente continua passando sob `node` (nenhuma regressão)
- [x] Um teste-canário simples (`render(<div>ok</div>)` com RTL) comprovou que `jsdom` funciona nos globs configurados (depois removido, conforme nota da task)

**Tests**: none (infra de config, verificado pelo canário acima que é descartado ou vira parte de T6)
**Gate**: build

---

### T2: Add gamification columns migration

**What**: Nova migration adicionando `money_saved`, `current_streak`,
`level`, `xp` em `users`.
**Where**: `supabase/migrations/00000000000014_add_gamification_columns_to_users.sql`
**Depends on**: None
**Reuses**: convenção de numeração já usada
**Requirement**: DASH-01

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] `money_saved NUMERIC(10,2) NOT NULL DEFAULT 0`
- [x] `current_streak INTEGER NOT NULL DEFAULT 0`
- [x] `level INTEGER NOT NULL DEFAULT 1`
- [x] `xp INTEGER NOT NULL DEFAULT 0`
- [x] Migration aplicada no Supabase real (`supabase db push`) e confirmada via `supabase migration list`

**Tests**: none (DDL puro)
**Gate**: build

---

### T3: Extend ESLint no-restricted-imports override

**What**: Adicionar `features/dashboard/services/**/*.ts` ao override que
já libera `features/sports-sync/services/**/*.ts` para importar
`@/lib/supabase/admin`.
**Where**: `eslint.config.mjs`
**Depends on**: None
**Reuses**: override já existente
**Requirement**: DASH-01

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] `files` do override inclui os 2 globs (sports-sync e dashboard)
- [x] `npm run lint` passa sem violação em nenhum arquivo existente

**Tests**: none (config)
**Gate**: build

---

### T4: Update post-login redirect default to /home

**What**: Trocar `router.push(redirectTo ?? "/")` por
`router.push(redirectTo ?? "/home")` nos 2 hooks de login.
**Where**: `features/auth/hooks/use-login-with-google.ts`,
`features/auth/hooks/use-email-password-mutation.ts`
**Depends on**: None
**Reuses**: nenhum
**Requirement**: DASH-02 (edge case de redirect)

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Os 2 arquivos usam `"/home"` como default
- [x] `tsc --noEmit` passa

**Tests**: none (arquivos já não tinham teste antes; mudança de 1 valor default, fora de proporção criar infra de `renderHook` só por isso)
**Gate**: build

---

### T5: Implement getCurrentFirebaseUid

**What**: Helper server-side que lê o cookie `__session` e verifica via
`adminAuth.verifySessionCookie`, retornando o `uid` ou `null`.
**Where**: `lib/auth/get-current-user.ts`, `tests/lib/auth/get-current-user.test.ts`
**Depends on**: None
**Reuses**: `lib/firebase/admin.ts`
**Requirement**: DASH-01

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Retorna `uid` quando cookie válido
- [x] Retorna `null` quando cookie ausente
- [x] Retorna `null` (nunca lança) quando `verifySessionCookie` falha
- [x] Gate check passa: `npm test -- get-current-user`

**Tests**: unit (mock de `next/headers` `cookies()` e `adminAuth`)
**Gate**: quick

---

### T6: Implement Sidebar component [P]

**What**: Sidebar fixa desktop com os 5 links, item ativo destacado via
`usePathname()`.
**Where**: `features/navigation/components/sidebar.tsx`,
`tests/features/navigation/components/sidebar.test.tsx`
**Depends on**: T1
**Reuses**: `cn`, ícones lucide
**Requirement**: DASH-02

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Renderiza os 5 links (Home, Matches, Rankings, Achievements, Profile)
- [x] Link correspondente à rota atual (mock de `usePathname`) recebe classe/estado ativo
- [x] `hidden md:flex` (ou equivalente) — só aparece em viewport desktop
- [x] Gate check passa: `npm test -- sidebar`

**Tests**: unit (RTL, `usePathname` mockado)
**Gate**: quick

---

### T7: Implement BottomNav component [P]

**What**: Tab bar fixa mobile com os mesmos 5 links.
**Where**: `features/navigation/components/bottom-nav.tsx`,
`tests/features/navigation/components/bottom-nav.test.tsx`
**Depends on**: T1
**Reuses**: `cn`, ícones lucide
**Requirement**: DASH-02

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Renderiza os 5 links
- [x] Link ativo destacado (mesma lógica de `usePathname`)
- [x] `flex md:hidden` — só aparece em viewport mobile
- [x] Gate check passa: `npm test -- bottom-nav`

**Tests**: unit (RTL)
**Gate**: quick

---

### T8: Implement AppShell and navigation public API

**What**: `AppShell` compõe `Sidebar` + `BottomNav` ao redor de `children`;
barrel `features/navigation/index.ts`.
**Where**: `features/navigation/components/app-shell.tsx`,
`tests/features/navigation/components/app-shell.test.tsx`,
`features/navigation/index.ts`
**Depends on**: T6, T7
**Reuses**: `Sidebar`, `BottomNav`
**Requirement**: DASH-02

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Renderiza `Sidebar`, `BottomNav`, e `children` juntos
- [x] Barrel exporta `AppShell` (e não expõe `Sidebar`/`BottomNav` diretamente, se não forem necessários fora da feature)
- [x] Gate check passa: `npm test -- app-shell`

**Tests**: unit (RTL)
**Gate**: quick

---

### T9: Implement dashboard types and get-dashboard-data service

**What**: Tipos (`DashboardData`, `DashboardMatch`, `DashboardPrediction`)

- `getDashboardData(firebaseUid)` com as 5 queries paralelas descritas no
  design.md (stats do usuário, accuracy, today/upcoming matches, latest
  predictions).
  **Where**: `features/dashboard/types/index.ts`,
  `features/dashboard/services/get-dashboard-data.ts`,
  `tests/features/dashboard/services/get-dashboard-data.test.ts`
  **Depends on**: T2, T3
  **Reuses**: `supabaseAdmin`
  **Requirement**: DASH-01, DASH-03, DASH-04, DASH-05

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] `firebaseUid === null` → stats zerados, sem query em `users`
- [x] `users` sem linha pro `firebase_uid` → mesmo zero state, sem insert
- [x] Accuracy = `points_earned > 0` / `points_earned IS NOT NULL`, `0%` sem predictions finalizadas
- [x] Level/XP calculados via threshold fixo de 3000 (`level = floor(xp/3000)+1`, `xpInLevel = xp % 3000`)
- [x] `todayMatches`/`upcomingMatches` segmentados corretamente por `match_date`
- [x] `latestPredictions` limitado e ordenado por `created_at desc`
- [x] Gate check passa: `npm test -- get-dashboard-data`

**Tests**: unit (mock de `supabaseAdmin`, casos: zero state, dados completos, sem matches, sem predictions)
**Gate**: quick

---

### T10: Implement StatCard component [P]

**What**: Card genérico (icon, iconClassName, value, label).
**Where**: `features/dashboard/components/stat-card.tsx`,
`tests/features/dashboard/components/stat-card.test.tsx`
**Depends on**: T9
**Reuses**: shadcn `Card`
**Requirement**: DASH-03

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Renderiza icon, value, label conforme props
- [x] Gate check passa: `npm test -- stat-card`

**Tests**: unit (RTL)
**Gate**: quick

---

### T11: Implement MoneyPreservedCard component [P]

**What**: Hero card gradiente formatando `amount` em BRL.
**Where**: `features/dashboard/components/money-preserved-card.tsx`,
`tests/features/dashboard/components/money-preserved-card.test.tsx`
**Depends on**: T9
**Reuses**: shadcn `Card`, `Badge`
**Requirement**: DASH-03

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] `amount=4380` renderiza "R$ 4.380,00" (formato `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`)
- [x] `amount=0` renderiza "R$ 0,00" sem erro
- [x] Gate check passa: `npm test -- money-preserved-card`

**Tests**: unit (RTL)
**Gate**: quick

---

### T12: Implement XpProgressCard component [P]

**What**: Card de progresso (level, xpInLevel, xpToNextLevel) com barra
CSS.
**Where**: `features/dashboard/components/xp-progress-card.tsx`,
`tests/features/dashboard/components/xp-progress-card.test.tsx`
**Depends on**: T9
**Reuses**: shadcn `Card`
**Requirement**: DASH-03

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Renderiza "{xpInLevel} / {xpToNextLevel}" e "{xpToNextLevel - xpInLevel} XP to level {level + 1}"
- [x] Largura da barra proporcional a `xpInLevel / xpToNextLevel`
- [x] Gate check passa: `npm test -- xp-progress-card`

**Tests**: unit (RTL)
**Gate**: quick

---

### T13: Implement MatchCard component [P]

**What**: Card de 1 partida (competição, horário, times, botão Make
Prediction desabilitado).
**Where**: `features/dashboard/components/match-card.tsx`,
`tests/features/dashboard/components/match-card.test.tsx`
**Depends on**: T9
**Reuses**: shadcn `Card`, `Badge`, `Avatar`, `Button`
**Requirement**: DASH-04

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Renderiza nome da competição, horário formatado, nomes/iniciais dos 2 times
- [x] Botão "Make Prediction" renderiza `disabled`
- [x] Gate check passa: `npm test -- match-card`

**Tests**: unit (RTL)
**Gate**: quick

---

### T14: Implement LatestPredictionsSection component [P]

**What**: Lista de predictions recentes + estado vazio.
**Where**: `features/dashboard/components/latest-predictions-section.tsx`,
`tests/features/dashboard/components/latest-predictions-section.test.tsx`
**Depends on**: T9
**Reuses**: shadcn `Card`
**Requirement**: DASH-05

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Lista vazia → estado vazio renderizado, sem erro
- [x] Lista com itens → renderiza cada prediction
- [x] Gate check passa: `npm test -- latest-predictions-section`

**Tests**: unit (RTL)
**Gate**: quick

---

### T15: Implement MatchListSection component

**What**: Título + lista de `MatchCard` + link "All matches" + estado
vazio.
**Where**: `features/dashboard/components/match-list-section.tsx`,
`tests/features/dashboard/components/match-list-section.test.tsx`
**Depends on**: T13
**Reuses**: `MatchCard`
**Requirement**: DASH-04

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] Renderiza título + N `MatchCard`
- [x] Lista vazia → `emptyMessage` renderizado, sem quebrar
- [x] Gate check passa: `npm test -- match-list-section`

**Tests**: unit (RTL)
**Gate**: quick

---

### T16: Wire dashboard barrel, app layout, and home page

**What**: `features/dashboard/index.ts`; `app/(app)/layout.tsx` usando
`AppShell`; `app/(app)/home/page.tsx` chamando `getCurrentFirebaseUid()` +
`getDashboardData()` e renderizando todos os componentes.
**Where**: `features/dashboard/index.ts`, `app/(app)/layout.tsx`,
`app/(app)/home/page.tsx`
**Depends on**: T5, T8, T9, T10, T11, T12, T14, T15
**Reuses**: tudo acima
**Requirement**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] `/home` renderiza sem erro com usuário autenticado (verificado via `npm run dev` + navegação manual)
- [x] Layout aplica `AppShell` a todas as rotas do grupo `(app)`
- [x] Gate check passa (build completo, última verificação de integração antes dos placeholders): `npm test && npm run build && npm run lint`

**Tests**: none (página de composição/integração — lógica real já testada em T9-T15; renderização de página completa verificada manualmente no navegador, não automatizada nesta rodada)
**Gate**: build

---

### T17: Create placeholder pages for Matches, Rankings, Achievements, Profile

**What**: 4 Server Components mínimos ("Em breve").
**Where**: `app/(app)/matches/page.tsx`, `app/(app)/rankings/page.tsx`,
`app/(app)/achievements/page.tsx`, `app/(app)/profile/page.tsx`
**Depends on**: T16
**Reuses**: `AppShell` (via layout, automático)
**Requirement**: DASH-06

**Tools**: MCP: NONE / Skill: NONE

**Done when**:

- [x] As 4 rotas renderizam sem 404 (verificado via `npm run build` — todas as 4 rotas prerenderizadas estaticamente sem erro)
- [x] Gate check passa (última task da feature): `npm test && npm run build && npm run lint`

**Tests**: none (páginas estáticas triviais)
**Gate**: build (última task — full build + lint + todos os testes)

---

## Parallel Execution

- **Phase 1**: T1-T5 — arquivos completamente independentes.
- **Phase 2**: T6, T7 — ambos dependem só de T1, sem arquivo compartilhado.
- **Phase 5**: T10-T14 — cada um em arquivo próprio, dependem só de T9.

---

## Task Verification Standards

Ver "Done when"/"Tests"/"Gate" em cada task — outcome específico e
testável, comando de gate check explícito.
