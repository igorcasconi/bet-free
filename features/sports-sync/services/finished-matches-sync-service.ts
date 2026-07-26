import {
  DEFAULT_CONCURRENCY_LIMIT,
  mapWithConcurrency,
} from "@/lib/concurrency";
import { sportsProvider } from "@/lib/sports-provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { updateMatchRow } from "./update-match-row";

// Matches sitting in a non-final status this long are considered "stuck" —
// the live-sync approximation (today's fixtures only, see
// thesportsdb-provider.ts) never reconciled them to a final result.
const STUCK_THRESHOLD_HOURS = 4;

// Caps a single run's backlog processing. A result at the cap is a signal
// that stuck matches are piling up (e.g. live-sync broken for days) rather
// than "normal" — surfaced via the warning below instead of silently
// fetching an unbounded number of rows.
const STUCK_MATCHES_LIMIT = 500;

interface StuckMatchRow {
  competitions: { external_id: string | null } | null;
}

export async function updateFinishedMatches(): Promise<{
  updated: number;
  ignored: number;
}> {
  const cutoff = new Date(
    Date.now() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from("matches")
    .select("competitions(external_id)")
    .in("status", ["scheduled", "live"])
    .lt("match_date", cutoff)
    .limit(STUCK_MATCHES_LIMIT);

  if (error) throw error;

  // PostgREST resolves `competitions(...)` as a single embedded object (the
  // match's own FK, a many-to-one relation) — the client's TS inference
  // defaults relationships to arrays without a generated Database schema,
  // which doesn't match this actual response shape.
  const rows = (data ?? []) as unknown as StuckMatchRow[];

  if (rows.length === STUCK_MATCHES_LIMIT) {
    console.warn(
      `updateFinishedMatches hit the ${STUCK_MATCHES_LIMIT}-row limit — stuck match backlog may be larger than this run processed`,
    );
  }

  const competitionExternalIds = [
    ...new Set(
      rows
        .map((row) => row.competitions?.external_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (competitionExternalIds.length === 0) {
    return { updated: 0, ignored: 0 };
  }

  const matchesPerCompetition = await mapWithConcurrency(
    competitionExternalIds,
    DEFAULT_CONCURRENCY_LIMIT,
    (externalCompetitionId) =>
      sportsProvider.updateFinishedMatches(externalCompetitionId),
  );

  const results = await mapWithConcurrency(
    matchesPerCompetition.flat(),
    DEFAULT_CONCURRENCY_LIMIT,
    updateMatchRow,
  );

  return {
    updated: results.filter(Boolean).length,
    ignored: results.filter((found) => !found).length,
  };
}
