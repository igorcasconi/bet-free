# Sports Provider Swap (Multi-Provider) Tasks

**Design**: `.specs/features/sports-provider-swap/design.md`
**Status**: Done

**Testing note**: No `.specs/codebase/TESTING.md` exists yet. Inferred from
the codebase (brownfield, existing convention): Vitest, one test file per
source file under `tests/` mirroring `lib/`/`features/` paths, `fetch`/
Supabase mocked via `vi.mock`/`vi.hoisted`. Gate commands: `yarn vitest run
<path>` per task, `yarn tsc --noEmit` + `yarn vitest run` (full suite) as the
final gate.

---

## Execution Plan

### Phase 1: Foundation (Parallel OK) — **Est. tokens**: ~25k

```
T1 [P] ┐
T2 [P] ┤
T3 [P] ├──→ (Phase 2)
T4 [P] ┤
T5 [P] ┘
```

### Phase 2: Providers (Parallel OK) — **Est. tokens**: ~45k

```
T6 [P] ┐
       ├──→ T8
T7 [P] ┘
```

### Phase 3: Composition Root (Sequential) — **Est. tokens**: ~10k

```
T8 ──→ (Phase 4)
```

### Phase 4: Services, Wave A (Parallel OK) — **Est. tokens**: ~35k

```
T9  [P] ┐
T10 [P] ┤
T11 [P] ├──→ (Phase 5)
T12 [P] ┘
```

### Phase 5: Services, Wave B (Parallel OK) — **Est. tokens**: ~20k

```
T13 [P] ┐
        ├──→ T15
T14 [P] ┘
```

### Phase 6: Final Verification (Sequential) — **Est. tokens**: ~10k

```
T15
```

---

## Task Breakdown

### T1: Create shared HTTP helper [P]

**What**: Extract header-aware `fetchJson` + a throttling factory into a new shared module.
**Where**: `lib/sports-provider/http.ts`
**Depends on**: None
**Reuses**: Error-wrapping pattern from `thesportsdb-provider.ts`'s current `fetchJson` (network failure / non-2xx / JSON parse failure → `SportsProviderError`)
**Requirement**: MPROV-07, MPROV-15, MPROV-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `fetchJson(url: string, headers?: HeadersInit): Promise<unknown>` throws `SportsProviderError` on network failure, non-2xx response, and JSON parse failure
- [x] `createThrottledFetchJson(minIntervalMs: number)` returns a function with the same signature that waits until `minIntervalMs` has elapsed since its own previous call before firing
- [x] Gate check passes: `yarn vitest run tests/lib/sports-provider/http.test.ts`
- [x] Test count: 5+ tests pass (3 error modes + throttle-delays + throttle-no-delay-when-elapsed)

**Tests**: unit (`tests/lib/sports-provider/http.test.ts`, new — use fake timers for the throttle tests)
**Gate**: quick

---

### T2: Create shared slug normalizer [P]

**What**: Move `toSlug` out of `thesportsdb-provider.ts` into a standalone reusable module.
**Where**: `lib/sports-provider/normalize.ts`
**Depends on**: None
**Reuses**: `toSlug` implementation from `thesportsdb-provider.ts` (verbatim)
**Requirement**: MPROV-08 (football-data has no slug field, needs this), MPROV-01 (dadosfutebol teams also lack a slug field)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `toSlug(name: string): string` exported, behavior unchanged (lowercase, strip diacritics, dashes for non-alphanumeric, trim leading/trailing dashes)
- [x] Gate check passes: `yarn vitest run tests/lib/sports-provider/normalize.test.ts`
- [x] Test count: 3+ tests pass

**Tests**: unit (`tests/lib/sports-provider/normalize.test.ts`, new)
**Gate**: quick

---

### T3: Revert `syncTeams` parameter to `externalCompetitionId` [P]

**What**: Change `SportsProvider.syncTeams` back from `competitionSlug: string` to `externalCompetitionId: string` in the interface.
**Where**: `lib/sports-provider/types.ts`
**Depends on**: None
**Reuses**: N/A (type-only change)
**Requirement**: MPROV-02, MPROV-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `SportsProvider.syncTeams(externalCompetitionId: string): Promise<ProviderTeam[]>` in `types.ts`
- [x] `yarn tsc --noEmit` shows the expected downstream errors (to be fixed in T6/T7/T11 — acceptable transient state within this phase, since it's parallel with provider work)

**Tests**: none (type-only; verified transitively by later tasks' test suites)
**Gate**: none (type-only, no test file)

---

### T4: Update env schema [P]

**What**: Remove `SPORTS_PROVIDER_API_KEY`/`SPORTS_PROVIDER_LEAGUE_IDS`, add `DADOS_FUTEBOL_API_KEY`, `SPORTS_BR_LEAGUE_IDS`, `FOOTBALL_DATA_API_KEY`, `SPORT_SA_LEAGUE_IDS`.
**Where**: `lib/env.ts`
**Depends on**: None
**Reuses**: Existing `createEnv` structure
**Requirement**: MPROV-21

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] The 2 old vars are gone from `server: {}`
- [x] The 4 new vars are added as `z.string().min(1)`
- [x] `yarn tsc --noEmit` on this file in isolation shows no new errors from this change alone

**Tests**: none (config schema; exercised indirectly by provider tests mocking `@/lib/env`)
**Gate**: none

---

### T5: Update env files [P]

**What**: Mirror the T4 var rename/addition in the actual env files, with placeholder league ids per the Open Questions.
**Where**: `.env.local`, `.env.example`
**Depends on**: None (parallel-safe — different file, and the var _names_ were already decided in `context.md`, not blocked by T4 landing first)
**Reuses**: N/A
**Requirement**: MPROV-21

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `.env.local` and `.env.example` have `DADOS_FUTEBOL_API_KEY`, `SPORTS_BR_LEAGUE_IDS`, `FOOTBALL_DATA_API_KEY`, `SPORT_SA_LEAGUE_IDS` with placeholder values and a `# TODO: confirm real ids` comment on the two league-id vars
- [x] Old `SPORTS_PROVIDER_API_KEY`/`SPORTS_PROVIDER_LEAGUE_IDS` lines removed

**Tests**: none
**Gate**: none

---

### T6: Implement DadosFutebolProvider [P]

**What**: New `SportsProvider` implementation for `api.dadosfutebol.com.br` — all 5 methods, Zod schemas, pagination helper.
**Where**: `lib/sports-provider/dadosfutebol-provider.ts`
**Depends on**: T1, T2, T3, T4
**Reuses**: `fetchJson` from `http.ts`, `toSlug` from `normalize.ts`, `SportsProviderError`, `MatchStatus` mapping pattern
**Requirement**: MPROV-01, MPROV-02, MPROV-03, MPROV-04, MPROV-05, MPROV-06, MPROV-07

**Tools**:

- MCP: NONE
- Skill: `search` (optional — re-verify exact dadosfutebol response shapes against docs while writing Zod schemas)

**Done when**:

- [x] `source = "dadosfutebol"`
- [x] `syncCompetitions()` calls `GET /v1/campeonatos/:id` once per id in `SPORTS_BR_LEAGUE_IDS`, accumulates
- [x] `syncTeams(externalCompetitionId)` paginates `GET /v1/campeonatos/:id/partidas` and dedupes teams from `time_mandante`/`time_visitante`
- [x] `syncMatches(externalCompetitionId, _season)` paginates the same endpoint, ignoring `_season`
- [x] `updateLiveMatches()` calls `GET /v1/partidas/ao-vivo`, filters by configured ids via nested `campeonato.id`
- [x] `updateFinishedMatches(externalCompetitionId)` paginates matches filtered to `status === "encerrado"`
- [x] Status map: `aguardando→scheduled`, `ao_vivo→live`, `encerrado→finished`, `adiado→postponed`; unknown status throws `SportsProviderError`
- [x] `Authorization: Bearer {DADOS_FUTEBOL_API_KEY}` header sent on every request
- [x] Gate check passes: `yarn vitest run tests/lib/sports-provider/dadosfutebol-provider.test.ts`
- [x] Test count: 10+ tests pass (one per method + pagination + status mapping + error cases, mirroring the depth of the old `thesportsdb-provider.test.ts`)

**Tests**: unit (`tests/lib/sports-provider/dadosfutebol-provider.test.ts`, new)
**Gate**: quick

---

### T7: Implement FootballDataProvider [P]

**What**: New `SportsProvider` implementation for `football-data.org` v4 — all 5 methods, Zod schemas, throttled fetch.
**Where**: `lib/sports-provider/football-data-provider.ts`
**Depends on**: T1, T2, T3, T4
**Reuses**: `fetchJson`/`createThrottledFetchJson` from `http.ts`, `toSlug` from `normalize.ts`, `SportsProviderError`
**Requirement**: MPROV-08, MPROV-09, MPROV-10, MPROV-11, MPROV-12, MPROV-13, MPROV-14, MPROV-15

**Tools**:

- MCP: NONE
- Skill: `search` (optional — re-verify football-data v4 response shapes/pagination behavior while writing Zod schemas)

**Done when**:

- [x] `source = "football-data"`
- [x] `syncCompetitions()` calls `GET /v4/competitions/:id` once per id in `SPORT_SA_LEAGUE_IDS`; `season` derived as `currentSeason.startDate.slice(0, 4)`
- [x] `syncTeams(externalCompetitionId)` calls `GET /v4/competitions/:id/teams`
- [x] `syncMatches(externalCompetitionId, season)` calls `GET /v4/competitions/:id/matches?season={season}` (season used)
- [x] `updateLiveMatches()` calls `GET /v4/matches?status=LIVE`, filters by configured ids
- [x] `updateFinishedMatches(externalCompetitionId)` calls `GET /v4/competitions/:id/matches?status=FINISHED`
- [x] Status map: `SCHEDULED/TIMED→scheduled`, `IN_PLAY/PAUSED→live`, `FINISHED/AWARDED→finished`, `POSTPONED/SUSPENDED→postponed`, `CANCELLED→cancelled`; unknown status throws `SportsProviderError`
- [x] `X-Auth-Token: {FOOTBALL_DATA_API_KEY}` header sent on every request
- [x] Every HTTP call goes through the throttled fetch (6.5s minimum interval between calls, verified with fake timers)
- [x] Gate check passes: `yarn vitest run tests/lib/sports-provider/football-data-provider.test.ts`
- [x] Test count: 10+ tests pass

**Tests**: unit (`tests/lib/sports-provider/football-data-provider.test.ts`, new)
**Gate**: quick

---

### T8: Rewire composition root, remove TheSportsDB

**What**: Replace the `sportsProvider` singleton export with `sportsProviders: SportsProvider[]`; delete the old provider and its test.
**Where**: `lib/sports-provider/index.ts` (modified), `lib/sports-provider/thesportsdb-provider.ts` (deleted), `tests/lib/sports-provider/thesportsdb-provider.test.ts` (deleted)
**Depends on**: T6, T7
**Reuses**: N/A
**Requirement**: MPROV-16

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `index.ts` exports `sportsProviders: SportsProvider[]` = `[new DadosFutebolProvider(...), new FootballDataProvider(...)]`, constructed from the T4 env vars
- [x] `thesportsdb-provider.ts` and its test file are deleted
- [x] `yarn tsc --noEmit` shows no remaining reference to `TheSportsDBProvider`, `sportsProvider` (singleton), `SPORTS_PROVIDER_API_KEY`, or `SPORTS_PROVIDER_LEAGUE_IDS` **outside** of files already scheduled for Phase 4/5 changes (those are expected to still fail until their own task lands)

**Tests**: none directly (this file has no dedicated test; correctness verified transitively by every service test in Phase 4/5)
**Gate**: none

---

### T9: Update `update-match-row` to accept an explicit source [P]

**What**: Change signature to `updateMatchRow(match, source: string)`, stop importing the singleton.
**Where**: `features/sports-sync/services/update-match-row.ts`
**Depends on**: T8
**Reuses**: Existing Supabase update/select pattern
**Requirement**: MPROV-20

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `updateMatchRow(match: MatchStatusUpdate, source: string): Promise<boolean>` — `.eq("external_source", source)` instead of `sportsProvider.source`
- [x] No import of `@/lib/sports-provider` remains in this file
- [x] Gate check passes: `yarn vitest run tests/features/sports-sync/services/update-match-row.test.ts`
- [x] Test count: existing test count maintained, updated to pass `source` explicitly

**Tests**: unit (`tests/features/sports-sync/services/update-match-row.test.ts`, modified)
**Gate**: quick

---

### T10: Update `competitions-sync-service` for multi-provider [P]

**What**: Loop `sportsProviders`, tag each row with its provider's `source`, accumulate into a single upsert.
**Where**: `features/sports-sync/services/competitions-sync-service.ts`
**Depends on**: T8
**Reuses**: Existing upsert-on-conflict pattern
**Requirement**: MPROV-17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Calls `syncCompetitions()` on every entry of `sportsProviders`, `external_source` per row comes from that provider's `.source`
- [x] All rows across all providers are upserted together (single `upsert` call ok, matching current single-call shape)
- [x] Gate check passes: `yarn vitest run tests/features/sports-sync/services/competitions-sync-service.test.ts`
- [x] Test count: existing tests updated + 1 new test proving 2 providers → 2 distinct `external_source` values in the upserted rows

**Tests**: unit (`tests/features/sports-sync/services/competitions-sync-service.test.ts`, modified)
**Gate**: quick

---

### T11: Update `teams-sync-service` for multi-provider dispatch [P]

**What**: Revert `competitions` select from `slug` back to `external_id`; add `external_source`; dispatch per row via a `providerBySource` map.
**Where**: `features/sports-sync/services/teams-sync-service.ts`
**Depends on**: T8
**Reuses**: `mapWithConcurrency`, existing upsert pattern
**Requirement**: MPROV-02, MPROV-09, MPROV-18, MPROV-19

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Selects `external_id, external_source` from `competitions` (not `slug`)
- [x] Builds `providerBySource = new Map(sportsProviders.map(p => [p.source, p]))`
- [x] For each competition row, resolves provider via the map; calls `provider.syncTeams(competition.external_id)`
- [x] Rows with no matching provider are skipped with `console.warn`, without throwing
- [x] Gate check passes: `yarn vitest run tests/features/sports-sync/services/teams-sync-service.test.ts`
- [x] Test count: existing tests updated (back to `external_id`-based assertions) + 1 new test for the unknown-source skip path

**Tests**: unit (`tests/features/sports-sync/services/teams-sync-service.test.ts`, modified)
**Gate**: quick

---

### T12: Update `matches-sync-service` for multi-provider dispatch [P]

**What**: Add `external_source` to the `competitions` select; dispatch per row via the same `providerBySource` pattern.
**Where**: `features/sports-sync/services/matches-sync-service.ts`
**Depends on**: T8
**Reuses**: `mapWithConcurrency`, existing team-lookup/upsert pattern
**Requirement**: MPROV-18, MPROV-19

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Selects `id, external_id, external_source, season` from `competitions`
- [x] Resolves provider per row via `providerBySource`; calls `provider.syncMatches(competition.external_id, competition.season)`
- [x] Rows with no matching provider are skipped with `console.warn`, without throwing
- [x] Gate check passes: `yarn vitest run tests/features/sports-sync/services/matches-sync-service.test.ts`
- [x] Test count: existing tests updated + 1 new test for the unknown-source skip path

**Tests**: unit (`tests/features/sports-sync/services/matches-sync-service.test.ts`, modified)
**Gate**: quick

---

### T13: Update `live-matches-sync-service` for multi-provider [P]

**What**: Loop `sportsProviders`, call `updateLiveMatches()` on each, pass that provider's `source` into `updateMatchRow`.
**Where**: `features/sports-sync/services/live-matches-sync-service.ts`
**Depends on**: T8, T9
**Reuses**: `mapWithConcurrency`
**Requirement**: MPROV-06, MPROV-13, MPROV-20

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Calls `updateLiveMatches()` on every provider in `sportsProviders`
- [x] Calls `updateMatchRow(match, provider.source)` for matches from that provider
- [x] `updated`/`ignored` counts aggregate across all providers
- [x] Gate check passes: `yarn vitest run tests/features/sports-sync/services/live-matches-sync-service.test.ts`
- [x] Test count: existing tests updated + 1 new test proving matches from 2 different providers both get updated with their own source

**Tests**: unit (`tests/features/sports-sync/services/live-matches-sync-service.test.ts`, modified)
**Gate**: quick

---

### T14: Update `finished-matches-sync-service` for multi-provider dispatch [P]

**What**: Embed `external_source` in the stuck-matches query; dispatch per unique `(external_source, external_id)` pair; pass `source` into `updateMatchRow`.
**Where**: `features/sports-sync/services/finished-matches-sync-service.ts`
**Depends on**: T8, T9
**Reuses**: `mapWithConcurrency`, existing stuck-match cutoff/limit logic (unchanged)
**Requirement**: MPROV-18, MPROV-19, MPROV-20

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Query selects `competitions(external_id, external_source)` (not just `external_id`)
- [x] Builds unique `(external_source, external_id)` pairs from the stuck-match rows
- [x] Resolves provider per pair via `providerBySource`, calls `provider.updateFinishedMatches(external_id)`, tags resulting matches with that `source`
- [x] Calls `updateMatchRow(match, source)` per match
- [x] Gate check passes: `yarn vitest run tests/features/sports-sync/services/finished-matches-sync-service.test.ts`
- [x] Test count: existing tests updated + 1 new test proving stuck matches from 2 different provider sources are each resolved correctly

**Tests**: unit (`tests/features/sports-sync/services/finished-matches-sync-service.test.ts`, modified)
**Gate**: quick

---

### T15: Full-suite verification

**What**: Run the complete test suite and a full type check to confirm the swap is clean end-to-end.
**Where**: N/A (verification task, no new files)
**Depends on**: T10, T11, T12, T13, T14
**Reuses**: N/A

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `yarn tsc --noEmit` passes with zero errors
- [x] `yarn vitest run` passes with zero failures across the whole suite
- [x] `grep -rn "thesportsdb\|TheSportsDBProvider\|SPORTS_PROVIDER_API_KEY\|SPORTS_PROVIDER_LEAGUE_IDS" --include="*.ts" .` (excluding `.specs/` docs) returns no matches
- [x] `match-sync-service.test.ts` still passes unmodified (confirms the orchestrator layer needed zero changes, per design.md)

**Tests**: full suite (existing)
**Gate**: full

---

## Parallel Execution

Tasks marked `[P]` run via sub-agents — one per task, launched concurrently,
per phase.

**Parallelism constraints respected:**

- Phase 1 (T1–T5): 5 independent files, no shared state
- Phase 2 (T6–T7): 2 independent provider files, no shared state (each has its own test file, its own Zod schemas)
- Phase 4 Wave A (T9–T12): 4 independent files, no shared state
- Phase 5 Wave B (T13–T14): 2 independent files, no shared state, both depend only on T9's already-landed signature

---

## Requirement Traceability Update

See `spec.md` — all 21 requirement IDs (MPROV-01 through MPROV-21) now map
to at least one task above. Phase/Status for each updated to `In Tasks`.
