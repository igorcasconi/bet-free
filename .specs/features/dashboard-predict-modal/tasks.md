# Dashboard Predict Modal Tasks

**Spec**: `.specs/features/dashboard-predict-modal/spec.md`
**Context**: `.specs/features/dashboard-predict-modal/context.md`
**Status**: Done

**Test convention (derived from codebase, no TESTING.md exists yet):** Vitest + React Testing Library, test files under `tests/<mirror-of-src-path>/*.test.ts(x)`, one test file per source file. Package manager is npm (`package-lock.json` present, no `yarn.lock`) — run gate checks with `npx vitest run <file>`, not `yarn`. Baseline before this feature: `npx vitest run tests/features/dashboard` has 1 pre-existing failure (`match-card.test.tsx` expects a "Fazer Palpite" button that doesn't exist today) — T3 supersedes that test file entirely, resolving it as a byproduct.

---

## Execution Plan

### Phase 1: Public API (Sequential) — **Est. tokens**: ~15k
```
T1
```

### Phase 2: Data layer + card logic (Parallel OK) — **Est. tokens**: ~40k
```
T1 ──┬→ T2
     └→ T3
```

### Phase 3: List section wiring (Sequential) — **Est. tokens**: ~20k
```
T3 → T4
```

### Phase 4: Client boundary (Sequential) — **Est. tokens**: ~25k
```
T4 → T5
```

### Phase 5: Page integration (Sequential) — **Est. tokens**: ~15k
```
T5, T2 → T6
```

---

## Task Breakdown

### T1: Promote predict-flow internals to `features/matches` public API

**What**: Add `PredictDialog`, `useSubmitPrediction`, `submitPrediction`, `predictionStatusFor`, `toMatchCardData`, `MATCH_SELECT`, and `MatchRow` to the `features/matches` barrel so `features/dashboard` can consume them without importing internal file paths (CLAUDE.md: "Never import internal files directly from another feature").
**Where**: `features/matches/index.ts`
**Depends on**: None
**Reuses**: existing implementations in `features/matches/components/predict-dialog.tsx`, `features/matches/hooks/use-submit-prediction.ts`, `features/matches/actions/predictions.ts`, `features/matches/lib/prediction-status.ts`, `features/matches/services/_shared.ts`
**Requirement**: DPM-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `features/matches/index.ts` adds: `export * from "./components/predict-dialog"`, `export * from "./hooks/use-submit-prediction"`, `export * from "./actions/predictions"`, `export * from "./lib/prediction-status"`, `export * from "./services/_shared"`
- [x] `npx tsc --noEmit` passes (no new circular-import or naming-collision errors from the barrel)
- [x] Gate check passes: `npx vitest run tests/features/matches`

**Tests**: none (barrel re-export only, existing matches tests must still pass)
**Gate**: quick

---

### T2: Migrate dashboard data layer to `MatchCardData`

**What**: `getDashboardData` returns `MatchCardData[]` (from `features/matches`) for `todayMatches`/`upcomingMatches` instead of `DashboardMatch[]`, reusing `MATCH_SELECT`/`toMatchCardData` instead of the dashboard's own duplicated query+mapper. Removes `DashboardMatch` and `toDashboardMatch` (dead code — `hasPrediction` was hardcoded `false`, never real).
**Where**: `features/dashboard/types/index.ts`, `features/dashboard/services/get-dashboard-data.ts`, `tests/features/dashboard/services/get-dashboard-data.test.ts`
**Depends on**: T1
**Reuses**: `MATCH_SELECT`, `toMatchCardData`, `MatchRow` (from `@/features/matches`)
**Requirement**: DPM-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `features/dashboard/types/index.ts`: `DashboardMatch` removed; `DashboardData.todayMatches`/`upcomingMatches` typed as `MatchCardData[]` (imported from `@/features/matches`)
- [x] `features/dashboard/services/get-dashboard-data.ts`: local `MATCH_SELECT`, `MatchRow`, `toDashboardMatch`, `shortNameFor` removed; queries use the imported `MATCH_SELECT`; rows mapped via imported `toMatchCardData(row, userId)`, where `userId` is the already-resolved `user.id` from the existing users query (no extra query added)
- [x] Un-authenticated path (`firebaseUid === null` or no matching user row) maps matches with `userId = null`, producing `prediction: null` for every match (mirrors current zero-stats early return)
- [x] `tests/features/dashboard/services/get-dashboard-data.test.ts` updated: `todayMatches`/`upcomingMatches` assertions expect the `MatchCardData` shape (`competitionId`, `status`, `prediction`) instead of `hasPrediction`; add a case where a returned match row's `predictions` array includes a row for the current `user.id` and assert `prediction` is populated with `predictedHomeScore`/`predictedAwayScore`
- [x] Gate check passes: `npx vitest run tests/features/dashboard/services/get-dashboard-data.test.ts`
- [x] Test count: all tests in the file pass (existing 9 + at least 1 new)

**Tests**: unit
**Gate**: quick

---

### T3: Add palpite parity to dashboard `MatchCard` [P]

**What**: Wire the dashboard's "Palpitar" button to an `onPredict` callback, and mirror the matches card's prediction-status behavior: `disabled` when locked, "Editar palpite" label + "Palpite feito"/"Sem palpite" badge based on `predictionStatusFor`. Dashboard's own visual layout (gradient card, green button, `lg` avatars) is preserved — only the matches feature's card visual (competition/live status badge) is NOT copied, per interview decision.
**Where**: `features/dashboard/components/match-card.tsx`, `tests/features/dashboard/components/match-card.test.tsx`
**Depends on**: T1
**Reuses**: `predictionStatusFor` (from `@/features/matches`)
**Requirement**: DPM-04, DPM-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `MatchCardProps` becomes `{ match: MatchCardData; onPredict: (match: MatchCardData) => void }` (import `MatchCardData` from `@/features/matches`), replacing `DashboardMatch`
- [x] Button `onClick={() => onPredict(match)}`, `disabled={predictionStatusFor(match) === "locked"}`, label `"Editar palpite"` when `predictionStatusFor(match) === "predicted"` else `"Palpitar"`
- [x] Badge showing `"Sem palpite"` / `"Palpite feito"` rendered when not locked (same condition as matches card), using dashboard's own badge styling already in the file
- [x] `formatMatchTime` untouched (timezone fix is a separate, out-of-scope concern — noted, not fixed here)
- [x] `tests/features/dashboard/components/match-card.test.tsx` rewritten against `MatchCardData` fixtures (mirrors `tests/features/matches/components/match-card.test.tsx` structure): renders competition/time/teams, shows "Sem palpite" + enabled "Palpitar" when no prediction, shows "Palpite feito" + enabled "Editar palpite" when predicted, disables CTA when `status !== "scheduled"`, calls `onPredict(match)` on click
- [x] Gate check passes: `npx vitest run tests/features/dashboard/components/match-card.test.tsx`
- [x] Test count: 6 tests pass

**SPEC_DEVIATION**: `match-card.tsx` and its test import `MatchCardData`/`predictionStatusFor` from internal paths (`@/features/matches/types`, `@/features/matches/lib/prediction-status`) instead of the `@/features/matches` barrel, contra CLAUDE.md's "never import internal files directly from another feature." Reason: the barrel re-exports `services/_shared.ts`, which references `lib/supabase/admin.ts` — that module reads a server-only env var at import time via `@t3-oss/env-core`, which throws in the jsdom test environment when the barrel is imported client-side. The matches feature's own `match-card.tsx` (T3's reference implementation) has the same internal-path imports for this exact reason. Pre-existing barrel design issue in `features/matches/index.ts` — flagged, not fixed here (out of this task's scope).

**Tests**: unit (component, RTL)
**Gate**: quick

---

### T4: Pass `onPredict` through `MatchListSection`

**What**: `MatchListSection` accepts `matches: MatchCardData[]` and a new `onPredict` prop, forwarding it to each `MatchCard`.
**Where**: `features/dashboard/components/match-list-section.tsx`, `tests/features/dashboard/components/match-list-section.test.tsx`
**Depends on**: T3
**Reuses**: `MatchCardData` (from `@/features/matches`)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `MatchListSectionProps` updates `matches: MatchCardData[]` and adds `onPredict: (match: MatchCardData) => void`
- [x] `<MatchCard key={match.id} match={match} onPredict={onPredict} />`
- [x] `tests/features/dashboard/components/match-list-section.test.tsx` updated: fixtures use `MatchCardData` shape, `onPredict={vi.fn()}` passed in every render call, existing assertions unchanged otherwise
- [x] Gate check passes: `npx vitest run tests/features/dashboard/components/match-list-section.test.tsx`
- [x] Test count: 2 tests pass

**Tests**: unit (component, RTL)
**Gate**: quick

---

### T5: Create dashboard client boundary for the predict dialog

**What**: New client component hosting `selectedMatch` state and `PredictDialog`, wrapping the two `MatchListSection` instances ("Hoje"/"Próximas") — the only client-interactive part of the home page.
**Where**: `features/dashboard/components/match-list-section-client.tsx` (new), `features/dashboard/index.ts`, `tests/features/dashboard/components/match-list-section-client.test.tsx` (new)
**Depends on**: T4, T1
**Reuses**: `PredictDialog` (from `@/features/matches`), same state pattern as `features/matches/components/matches-page-content.tsx`
**Requirement**: DPM-01, DPM-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `match-list-section-client.tsx` has `"use client"`, props `{ todayMatches: MatchCardData[]; upcomingMatches: MatchCardData[] }`, holds `useState<MatchCardData | null>(null)`, renders `<MatchListSection title="Partidas de Hoje" matches={todayMatches} emptyMessage="Nenhuma partida hoje" onPredict={setSelectedMatch} />` and `<MatchListSection title="Próximas Partidas" matches={upcomingMatches} emptyMessage="Nenhuma partida futura" onPredict={setSelectedMatch} />`, plus `<PredictDialog match={selectedMatch} open={selectedMatch !== null} onOpenChange={(open) => { if (!open) setSelectedMatch(null); }} />`
- [x] `features/dashboard/index.ts` adds `export * from "./components/match-list-section-client"`
- [x] `tests/features/dashboard/components/match-list-section-client.test.tsx` (new, mocking `@/features/matches/components/predict-dialog` the same way `matches-page-content.test.tsx` does): renders both sections' titles, clicking a "Palpitar" CTA opens the mocked dialog with the matching `data-match-id`, closing the dialog (mock's `onOpenChange(false)`) clears the selection
- [x] Gate check passes: `npx vitest run tests/features/dashboard/components/match-list-section-client.test.tsx`
- [x] Test count: 3 tests pass

**SPEC_DEVIATION**: `match-list-section-client.tsx` and its test import `PredictDialog`/`MatchCardData` from internal matches paths instead of the `@/features/matches` barrel — same reason as T3: the barrel re-exports `services/_shared.ts`, which throws in jsdom via a server-only env var read at import time.

**Tests**: unit (component, RTL)
**Gate**: quick

---

### T6: Wire the home page to the new client boundary

**What**: `app/(app)/home/page.tsx` renders one `MatchListSectionClient` instead of two direct `MatchListSection` calls.
**Where**: `app/(app)/home/page.tsx`
**Depends on**: T5, T2
**Reuses**: `MatchListSectionClient`, `getDashboardData` (both from `@/features/dashboard`)
**Requirement**: DPM-01, DPM-02, DPM-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Import `MatchListSectionClient` instead of `MatchListSection` from `@/features/dashboard`
- [x] Replace the two `<MatchListSection ... />` blocks with `<MatchListSectionClient todayMatches={todayMatches} upcomingMatches={upcomingMatches} />`
- [x] `npx tsc --noEmit` passes
- [x] Full feature gate passes: `npx vitest run tests/features/dashboard tests/features/matches`

**Tests**: none (page wiring; covered by T5's component test + manual verification)
**Gate**: build

---

## Manual Verification (after T6)

Run `npm run dev`, log in, open `/home`:
1. A scheduled match with no prediction shows "Sem palpite" + enabled "Palpitar".
2. Clicking "Palpitar" opens the same modal used on `/matches`.
3. Submitting a score closes the modal and the card updates to "Palpite feito" / "Editar palpite" after refresh.
4. A non-scheduled match (if any in seed data) shows the CTA disabled.

---

## Requirement Traceability Update (apply to spec.md after approval)

All of DPM-01 .. DPM-06 move to Phase `In Tasks`, Status `In Tasks`.
**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped
