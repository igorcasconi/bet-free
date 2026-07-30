# Matches Feature Tasks

**Design**: `.specs/features/matches/design.md`
**Status**: Done

**Gate commands** (no `.specs/codebase/TESTING.md` yet — derived from `package.json` + existing test conventions):

- Tests: `npm test` (vitest run) — unit tests mirrored under `tests/` (e.g. `features/matches/services/x.ts` → `tests/features/matches/services/x.test.ts`)
- Lint: `npm run lint`
- Full gate = tests + lint (+ `npm run build` only for the final integration task)

---

## Execution Plan

### Phase 1: Foundation — **Est. tokens**: ~40k

```
T1 [P]  T2 [P]  T3 [P]  T4 [P]
           ↓ (T4 feeds into)
        T5 [P]  T6 [P]  T7 [P]
```

### Phase 2: Data Layer — **Est. tokens**: ~70k

```
T8 → T9 [P] ─┐
     T10 [P]─┼→ T12
T11 [P] ─────┴→ T13
```

### Phase 3: UI Layer — **Est. tokens**: ~80k

```
T14 [P]  T15 [P]
   └─────┬─────┘
       T16
   ┌─────┴─────┐
 T17 [P]     T18 [P]
```

### Phase 4: Integration — **Est. tokens**: ~40k

```
T19 → T20 → T21
```

---

## Task Breakdown

### T1: Add `Dialog` shadcn primitive [P]

**What**: Run `npx shadcn@latest add dialog` to generate `components/ui/dialog.tsx`
**Where**: `components/ui/dialog.tsx`
**Depends on**: None
**Reuses**: Existing shadcn setup (`components.json`, new-york style)
**Requirement**: MATCHES-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `components/ui/dialog.tsx` exists, exports `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `DialogTrigger`
- [x] `npm run lint` passes on the generated file

**Tests**: none (generated primitive, no custom logic)
**Gate**: quick (lint only)

---

### T2: Add ESLint override for `features/matches/services/**` [P]

**What**: Add `"features/matches/services/**/*.ts"` to the existing file-scoped override block that disables `no-restricted-imports` for the admin Supabase client
**Where**: `eslint.config.mjs`
**Depends on**: None
**Reuses**: Existing override entries for `dashboard`/`sports-sync`
**Requirement**: MATCHES-01

**Done when**:

- [x] `eslint.config.mjs`'s override `files` array includes `"features/matches/services/**/*.ts"`
- [x] `npm run lint` passes

**Tests**: none (config change)
**Gate**: quick

---

### T3: Add `QUERY_KEYS.MATCHES` [P]

**What**: Add `MATCHES: ["matches"]` to the currently-empty `QUERY_KEYS` object
**Where**: `config/query-keys.ts`
**Depends on**: None
**Requirement**: MATCHES-01

**Done when**:

- [x] `QUERY_KEYS.MATCHES` exported as `["matches"] as const`
- [x] `npm run lint` passes

**Tests**: none (constant only)
**Gate**: quick

---

### T4: Create Matches types [P]

**What**: Define `MatchCardData`, `MatchGroup`, `UpcomingMatchesPage` interfaces per design.md's Data Models section
**Where**: `features/matches/types/index.ts`
**Depends on**: None
**Reuses**: Shape of `features/dashboard/types/index.ts`'s `DashboardMatch` as a starting point
**Requirement**: MATCHES-01, MATCHES-02

**Done when**:

- [x] All three interfaces exported exactly as specified in design.md
- [x] `npm run lint` passes (typecheck via `tsc` runs as part of `next build`, verified in T21)

**Tests**: none (types only)
**Gate**: quick

---

### T5: `getBrazilDayBounds` util [P]

**What**: Function computing `{ startOfToday: string; endOfToday: string }` (ISO, UTC instants) representing the current day boundary in `America/Sao_Paulo`, using `Intl.DateTimeFormat` to extract the Y-M-D and a fixed `-03:00` offset
**Where**: `features/matches/lib/get-brazil-day-bounds.ts`
**Depends on**: None
**Reuses**: Structure of `getUtcDayBounds()` in `features/dashboard/services/get-dashboard-data.ts` (diverges on timezone per design.md)
**Requirement**: MATCHES-01 (edge case: midnight BRT boundary)

**Done when**:

- [x] `getBrazilDayBounds()` returns correct boundaries when system/test clock is mocked at various UTC instants, including ones that are "tomorrow" in UTC but "today" in BRT (e.g. `02:00 UTC` = `23:00 BRT` previous day)
- [x] `npm test` passes: `tests/features/matches/lib/get-brazil-day-bounds.test.ts`

**Tests**: unit (3+ cases: midday, near-midnight-UTC, near-midnight-BRT)
**Gate**: full

---

### T6: `groupByCompetition` util [P]

**What**: Pure function `groupByCompetition(matches: MatchCardData[]): MatchGroup[]` preserving first-appearance order of competitions
**Where**: `features/matches/lib/group-by-competition.ts`
**Depends on**: T4
**Requirement**: MATCHES-01

**Done when**:

- [x] Groups matches by `competitionId`, preserves order of first appearance, never emits an empty group
- [x] `npm test` passes: `tests/features/matches/lib/group-by-competition.test.ts`

**Tests**: unit (empty input, single competition, multiple interleaved competitions)
**Gate**: full

---

### T7: `predictionStatusFor` util [P]

**What**: Pure function implementing the 3-state derivation from design.md (`"no-prediction" | "predicted" | "locked"`)
**Where**: `features/matches/lib/prediction-status.ts`
**Depends on**: T4
**Requirement**: MATCHES-01, MATCHES-03, MATCHES-05

**Done when**:

- [x] Returns `"locked"` for any non-`scheduled` status regardless of prediction
- [x] Returns `"no-prediction"` / `"predicted"` correctly for `scheduled` matches
- [x] `npm test` passes: `tests/features/matches/lib/prediction-status.test.ts`

**Tests**: unit (5 cases — one per status value, plus scheduled+prediction)
**Gate**: full

---

### T8: Shared select/mapping module

**What**: Internal module with the Supabase select string (matches + competitions + teams + predictions-for-user) and the row→`MatchCardData` mapping function, used by both services in T9/T10
**Where**: `features/matches/services/_shared.ts`
**Depends on**: T4
**Reuses**: `MATCH_SELECT` pattern from `features/dashboard/services/get-dashboard-data.ts`, extended with `status` and a `predictions` join filtered by `user_id`
**Requirement**: MATCHES-01, MATCHES-03, MATCHES-05

**Done when**:

- [x] Exports the select string and `toMatchCardData(row, userId)` mapping function
- [x] Prediction join returns `null` when `userId` is `null` (unauthenticated) or no matching row exists
- [x] `npm test` passes: `tests/features/matches/services/_shared.test.ts` (mapping logic only, Supabase client mocked)

**Tests**: unit
**Gate**: full

---

### T9: `getMatchesPageData` service [P]

**What**: Fetch today's matches (full, no pagination) + first page of upcoming matches, both grouped by competition, per design.md's interface
**Where**: `features/matches/services/get-matches-page-data.ts`
**Depends on**: T8, T5, T6
**Reuses**: `_shared.ts`, `getBrazilDayBounds`, `groupByCompetition`
**Requirement**: MATCHES-01, MATCHES-02

**Done when**:

- [x] `getMatchesPageData(firebaseUid)` returns `{ todayGroups, upcomingPage }` matching design.md's shape
- [x] Today's query uses `getBrazilDayBounds()`; upcoming's first page uses the same cursor/limit contract as T10
- [x] `npm test` passes: `tests/features/matches/services/get-matches-page-data.test.ts` (Supabase client mocked, per existing `tests/features/dashboard/services/get-dashboard-data.test.ts` pattern)

**Tests**: unit
**Gate**: full

---

### T10: `getUpcomingMatchesPage` service [P]

**What**: Cursor-paginated fetch of upcoming matches (`matchDate`+`id` cursor), grouped by competition, for reuse by both T9 (first page) and T12 (subsequent pages)
**Where**: `features/matches/services/get-upcoming-matches-page.ts`
**Depends on**: T8
**Reuses**: `_shared.ts`
**Requirement**: MATCHES-06

**Done when**:

- [x] `getUpcomingMatchesPage({ firebaseUid, cursor, limit })` returns `UpcomingMatchesPage` with correct `nextCursor` (null when exhausted)
- [x] `npm test` passes: `tests/features/matches/services/get-upcoming-matches-page.test.ts` (mocked client; cases: first page, middle page, last page)

**Tests**: unit
**Gate**: full

---

### T11: `upsertPrediction` service [P]

**What**: Upsert into `predictions` on conflict `(user_id, match_id)`, rejecting when the match is not `scheduled`
**Where**: `features/matches/services/upsert-prediction.ts`
**Depends on**: T4
**Requirement**: MATCHES-03, MATCHES-04, MATCHES-05

**Done when**:

- [x] Successful upsert returns `{ ok: true }`; non-`scheduled` match returns `{ ok: false, error }` without writing
- [x] Existing prediction is updated in place (no duplicate row) on conflict
- [x] `npm test` passes: `tests/features/matches/services/upsert-prediction.test.ts` (mocked client; cases: create, update, match-not-scheduled)

**Tests**: unit
**Gate**: full

---

### T12: `GET /api/matches/upcoming` Route Handler

**What**: Route Handler reading `cursorMatchDate`/`cursorId`/`limit` query params, resolving the user via `getCurrentFirebaseUid()`, calling `getUpcomingMatchesPage`, returning JSON
**Where**: `app/api/matches/upcoming/route.ts`
**Depends on**: T10
**Reuses**: `getCurrentFirebaseUid` (same as dashboard), pattern of existing `app/api/sync/*/route.ts` handlers
**Requirement**: MATCHES-06

**Done when**:

- [x] Returns `200` with `UpcomingMatchesPage` JSON on success
- [x] Returns `500` with `{ error }` on service failure (per design.md's Error Handling Strategy)
- [x] `npm test` passes: `tests/app/api/matches/upcoming/route.test.ts` (mirrors `tests/app/api/sync/*/route.test.ts` pattern)

**Tests**: unit/integration (route-level, service mocked)
**Gate**: full

---

### T13: `submitPrediction` Server Action

**What**: `"use server"` action resolving the authenticated user (`getCurrentFirebaseUid` + `users` lookup by `firebase_uid`), then delegating to `upsertPrediction`
**Where**: `features/matches/actions/predictions.ts`
**Depends on**: T11
**Reuses**: User-lookup pattern from `features/dashboard/services/get-dashboard-data.ts`'s `getDashboardData`
**Requirement**: MATCHES-03, MATCHES-04, MATCHES-05

**Done when**:

- [x] Returns `{ ok: false, error: "not authenticated" }` when `getCurrentFirebaseUid()` is `null`, without calling the service
- [x] Otherwise resolves `users.id` and calls `upsertPrediction`, returning its result verbatim
- [x] `npm test` passes: `tests/features/matches/actions/predictions.test.ts` (mocked auth + service)

**Tests**: unit
**Gate**: full

---

### T14: `MatchCard` component [P]

**What**: Card showing competition badge, teams, kickoff time (formatted in `America/Sao_Paulo`), status badge, prediction-status badge, and an active CTA (not disabled)
**Where**: `features/matches/components/match-card.tsx`
**Depends on**: T4, T7
**Reuses**: Layout of `features/dashboard/components/match-card.tsx`; status→badge-variant map from design.md/context.md
**Requirement**: MATCHES-01, MATCHES-03, MATCHES-05

**Done when**:

- [x] Renders all fields required by spec.md's acceptance criterion (MATCHES-01 #6)
- [x] CTA label/enabled-state matches `predictionStatusFor` output (`Predict` / `Editar palpite` / disabled)
- [x] `npm test` passes: `tests/features/matches/components/match-card.test.tsx` (mirrors `tests/features/dashboard/components/match-card.test.tsx`)

**Tests**: unit (component, React Testing Library)
**Gate**: full

---

### T15: `MatchGroupSection` component [P]

**What**: Renders one competition's header + its `MatchCard` list
**Where**: `features/matches/components/match-group-section.tsx`
**Depends on**: T4
**Requirement**: MATCHES-01

**Done when**:

- [x] Renders competition name as section header + one `MatchCard` per match, in order
- [x] `npm test` passes: `tests/features/matches/components/match-group-section.test.tsx`

**Tests**: unit
**Gate**: full

---

### T16: `useUpcomingMatches` + `useSubmitPrediction` hooks

**What**: `useUpcomingMatches(initialPage)` wrapping `useInfiniteQuery` (seeded via `initialData`, `getNextPageParam` from `nextCursor`, fetches `GET /api/matches/upcoming`); `useSubmitPrediction()` wrapping `useMutation(submitPrediction)` that invalidates `QUERY_KEYS.MATCHES` on success
**Where**: `features/matches/hooks/use-upcoming-matches.ts`, `features/matches/hooks/use-submit-prediction.ts`
**Depends on**: T3, T12, T13
**Requirement**: MATCHES-06, MATCHES-03, MATCHES-04, MATCHES-05

**Done when**:

- [x] `useUpcomingMatches` renders initial page with no network call, fetches next page on `fetchNextPage()`, exposes `hasNextPage`
- [x] `useSubmitPrediction` invalidates `QUERY_KEYS.MATCHES` after a successful mutation
- [x] `npm test` passes: `tests/features/matches/hooks/use-upcoming-matches.test.ts`, `tests/features/matches/hooks/use-submit-prediction.test.ts` (React Query test utils, mocked fetch/action)

**Tests**: unit (hooks, `@testing-library/react` renderHook + QueryClientProvider wrapper)
**Gate**: full

---

### T17: `PredictDialog` component [P]

**What**: Dialog with RHF+zod form (home score, away score, non-negative integers), pre-filled when editing, calling `useSubmitPrediction` on submit
**Where**: `features/matches/components/predict-dialog.tsx`
**Depends on**: T1, T16
**Reuses**: RHF+zod wiring from `features/auth/components/login-form.tsx`
**Requirement**: MATCHES-03, MATCHES-04, MATCHES-05

**Done when**:

- [x] Invalid input (negative/non-integer/empty) shows inline error, does not call the mutation
- [x] Valid submit calls `useSubmitPrediction`, closes dialog on success, keeps it open with an error on failure
- [x] Editing pre-fills existing `predictedHomeScore`/`predictedAwayScore`
- [x] `npm test` passes: `tests/features/matches/components/predict-dialog.test.tsx`

**Tests**: unit (component)
**Gate**: full

---

### T18: `MatchesPageContent` component [P]

**What**: Client root rendering the "Hoje"/"Próximos" sections (with empty states per spec.md acceptance criteria), owning selected-match state for `PredictDialog`, rendering "Carregar mais" driven by `useUpcomingMatches`
**Where**: `features/matches/components/matches-page-content.tsx`
**Depends on**: T15, T16, T17
**Requirement**: MATCHES-01, MATCHES-02, MATCHES-06

**Done when**:

- [x] Renders empty state when `todayGroups`/upcoming groups are empty (per spec.md #3, #5)
- [x] "Carregar mais" hidden/disabled when `hasNextPage` is false
- [x] Clicking a card's CTA opens `PredictDialog` for that match
- [x] `npm test` passes: `tests/features/matches/components/matches-page-content.test.tsx`

**Tests**: unit (component)
**Gate**: full

---

### T19: Public API (`index.ts`)

**What**: Export the feature's public surface per CLAUDE.md's Feature Public API convention
**Where**: `features/matches/index.ts`
**Depends on**: T18
**Reuses**: Pattern from `features/dashboard/index.ts`
**Requirement**: MATCHES-01

**Done when**:

- [x] Exports components/hooks/actions/types needed by `app/(app)/matches/page.tsx` and nothing internal-only
- [x] `npm run lint` passes (no deep-import violations elsewhere)

**Tests**: none
**Gate**: quick

---

### T20: Wire `app/(app)/matches/page.tsx` + `error.tsx`

**What**: Replace the placeholder page with the real async Server Component (fetch via `getMatchesPageData`, hydrate React Query, render `MatchesPageContent`); add a minimal `error.tsx` boundary for the route
**Where**: `app/(app)/matches/page.tsx`, `app/(app)/matches/error.tsx` (new)
**Depends on**: T9, T19
**Reuses**: `getCurrentFirebaseUid`, `dehydrate`/`HydrationBoundary` from `@tanstack/react-query`
**Requirement**: MATCHES-01, MATCHES-02

**Done when**:

- [x] Page fetches data server-side, renders `MatchesPageContent` (SPEC_DEVIATION: no `dehydrate`/`HydrationBoundary` — per T18's existing deviation, `MatchesPageContent`/`useUpcomingMatches` already accept the first page as `initialData` directly, so passing `upcomingPage` as a prop achieves the same "no extra fetch on mount" outcome without the extra QueryClient/dehydrate boilerplate)
- [x] `error.tsx` renders a minimal "Não foi possível carregar as partidas." message on thrown errors
- [x] `npm test` passes: `tests/app/(app)/matches/page.test.tsx` (SPEC_DEVIATION: no page-level test added — App Router async Server Component pages have no existing test pattern in this repo (`home/page.tsx` is untested), and `MatchesPageContent` is already covered by T18's component test; data-fetching wiring is a 3-line pass-through with no branching logic to unit-test)

**Tests**: unit/integration (best-effort — flag if page-level testing isn't already a pattern in this repo)
**Gate**: full

---

### T21: Full integration gate

**What**: Run the complete gate — tests, lint, and a production build — to confirm the feature compiles and passes end-to-end
**Where**: n/a (verification task, no new files)
**Depends on**: T20
**Requirement**: MATCHES-01 through MATCHES-06

**Done when**:

- [x] `npm test` passes (full suite, not just new tests)
- [x] `npm run lint` passes (full repo)
- [x] `npm run build` succeeds (typecheck + Next.js build)

**Tests**: n/a (runs existing suite)
**Gate**: build
