# Matches Feature Specification

## Problem Statement

Users have no dedicated place to see all upcoming football matches and act on them. The `/matches` route is currently a placeholder ("Em breve"), and the Dashboard only shows a partial, non-paginated, non-groupable slice of matches with a hardcoded, non-functional "Make Prediction" button. Users can't browse matches by competition, can't see more than the first page of upcoming fixtures, and can't actually submit a prediction anywhere in the product.

## Proposed Solution

Build a full `/matches` page that lists today's matches and upcoming matches, grouped by competition. Each match is a card showing competition, teams, kickoff time (Brazil timezone), the user's prediction status, and a CTA. Clicking the CTA opens a modal where the user enters a predicted score; submitting it creates or updates their prediction via a Server Action. "Today" loads fully; "Upcoming" paginates via infinite scroll (React Query), with the initial data server-rendered and hydrated into the React Query cache.

## Goals

- [x] User can see all of today's matches and browse upcoming matches without an artificial limit, grouped by competition
- [x] User can tell, per match, whether they already predicted it
- [x] User can submit or edit a prediction without leaving the matches page
- [x] Initial page load is server-rendered (no loading-spinner flash for the first screen)

## Out of Scope

| Feature                                                   | Reason                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Points/results display (`points_earned`) on match cards   | Belongs to results/ranking screens — [Deferred, context.md]                                        |
| Dashboard's own match sections/bug fixes                  | This spec only covers the new `/matches` page, not retrofitting Dashboard — [Deferred, context.md] |
| User-configurable timezone preference                     | Timezone fixed to `America/Sao_Paulo` for all users — [Deferred, context.md]                       |
| Per-competition independent pagination                    | Only the "Upcoming" section as a whole paginates — [Deferred, context.md]                          |
| New semantic status colors (live pulse, green/red tokens) | Reuses existing neutral Badge variants — [Deferred, context.md]                                    |
| Real-time score/status updates while page is open         | Not requested; page reflects state as of load/refetch                                              |

---

## User Stories

### P1: View today's and upcoming matches grouped by competition ⭐ MVP

**User Story**: As a logged-in user, I want to see today's matches and upcoming matches grouped by competition so that I can quickly find matches I care about.

**Why P1**: This is the core ask — without it there's no feature.

**Acceptance Criteria**:

1. WHEN the user opens `/matches` THEN system SHALL render a Server Component that fetches today's matches (Brazil-timezone day boundary) and the first page of upcoming matches, both grouped by competition
2. WHEN there are matches today THEN system SHALL render a "Hoje" section with one group per competition, each group listing its matches
3. WHEN there are no matches today THEN system SHALL render an empty state for the "Hoje" section instead of omitting it silently
4. WHEN the page renders upcoming matches THEN system SHALL render a "Próximos" section with one group per competition for the matches in the loaded page(s)
5. WHEN there are no upcoming matches at all THEN system SHALL render an empty state for the "Próximos" section
6. WHEN a match card renders THEN system SHALL display competition name, home team, away team, kickoff time (formatted in `America/Sao_Paulo`), and a status badge (`Agendado`/`Ao vivo`/`Encerrado`/`Adiado`/`Cancelado` per `matches.status`)
7. WHEN the server-fetched data is sent to the client THEN system SHALL seed it into the React Query cache (`initialData`, per design.md — not `dehydrate`/`HydrationBoundary`) so no refetch/loading flash occurs on mount

**Independent Test**: Seed matches today and matches on future dates across ≥2 competitions; load `/matches`; verify both sections render, correctly grouped, with no client-side loading spinner for the first screen.

---

### P1: Submit a prediction via modal ⭐ MVP

**User Story**: As a logged-in user, I want to enter my predicted score for a match so that I can participate before it starts.

**Why P1**: The CTA is explicitly required in the original request; without submission working, the CTA is dead UI.

**Acceptance Criteria**:

1. WHEN a match has `status='scheduled'` AND the user has no existing prediction for it THEN system SHALL show badge "Sem palpite" and an enabled "Predict" CTA
2. WHEN the user clicks "Predict" THEN system SHALL open a modal (Dialog) with two numeric inputs (home score, away score) and a save button
3. WHEN the user submits valid non-negative integer scores THEN system SHALL call a Server Action that upserts a row in `predictions` (unique on `user_id`+`match_id`), close the modal, and invalidate the matches query so the card reflects the new status
4. WHEN the user submits an invalid value (negative, non-integer, empty) THEN system SHALL show an inline validation error and SHALL NOT call the Server Action
5. WHEN the user is not authenticated THEN system SHALL NOT show an enabled "Predict" CTA (routes already require auth via existing session middleware)

**Independent Test**: As a logged-in user, click "Predict" on a scheduled match with no prior prediction, submit `2-1`, confirm a `predictions` row exists and the card now shows "Palpite feito".

---

### P2: Edit an existing prediction

**User Story**: As a logged-in user, I want to change a prediction I already made so that I can correct or update it before the match starts.

**Why P2**: Important for usability but the feature is functional without it (user could theoretically not need to edit).

**Acceptance Criteria**:

1. WHEN a match has `status='scheduled'` AND the user has an existing prediction for it THEN system SHALL show badge "Palpite feito" and a CTA labeled "Editar palpite"
2. WHEN the user clicks "Editar palpite" THEN system SHALL open the same modal pre-filled with the existing predicted scores
3. WHEN the user submits changed scores THEN system SHALL update the existing `predictions` row (not create a duplicate) via the same upsert Server Action

**Independent Test**: Predict a match, reload, click "Editar palpite", change the score, save, confirm the same `predictions` row was updated (not duplicated).

---

### P2: Paginate upcoming matches

**User Story**: As a user, I want to load more upcoming matches beyond the first page so that I can browse fixtures further into the future.

**Why P2**: Explicitly requested ("Pagination ready") but the page is usable at P1 scope with just the first page.

**Acceptance Criteria**:

1. WHEN the "Próximos" section has more matches beyond the first server-rendered page THEN system SHALL show a "Carregar mais" control
2. WHEN the user triggers loading more (click or scroll, per infinite-query pattern) THEN system SHALL fetch the next page via `useInfiniteQuery` using a cursor on `match_date`+`id`, append results, and re-group by competition (existing competition groups may repeat if that competition has matches on a later page)
3. WHEN there are no more pages THEN system SHALL hide/disable the "Carregar mais" control

**Independent Test**: Seed more upcoming matches than one page size; load `/matches`; click "Carregar mais"; verify additional matches appear correctly grouped, and the control disappears once exhausted.

---

## Edge Cases

- WHEN a match's `status` is not `scheduled` (live/finished/postponed/cancelled) THEN system SHALL disable the CTA regardless of prediction existence
- WHEN the day boundary is computed near midnight in `America/Sao_Paulo` THEN system SHALL classify matches using that timezone, not UTC
- WHEN the user double-submits the same prediction (e.g., double-click save) THEN the upsert (unique `user_id`+`match_id`) SHALL prevent duplicate rows
- WHEN a competition group is empty after grouping (defensive case) THEN system SHALL NOT render an empty group header
- WHEN Supabase read fails (network/service error) THEN system SHALL render a page-level error state rather than crashing

---

## Requirement Traceability

| Requirement ID | Story                                     | Phase    | Status       |
| -------------- | ----------------------------------------- | -------- | ------------ |
| MATCHES-01     | P1: View today's/upcoming matches grouped | In Tasks | Done |
| MATCHES-02     | P1: View today's/upcoming matches grouped | In Tasks | Done |
| MATCHES-03     | P1: Submit prediction via modal           | In Tasks | Done |
| MATCHES-04     | P1: Submit prediction via modal           | In Tasks | Done |
| MATCHES-05     | P2: Edit existing prediction              | In Tasks | Done |
| MATCHES-06     | P2: Paginate upcoming matches             | In Tasks | Done |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] `/matches` replaces the placeholder page with real, grouped, paginated data
- [x] A user can go from seeing a match to having a saved prediction without leaving the page
- [x] "Today" boundary is correct in `America/Sao_Paulo` at all hours, including near midnight
- [x] No client-side loading flash on first paint of `/matches`
