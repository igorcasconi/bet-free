import { supabaseAdmin } from "@/lib/supabase/admin";

import type { PendingPrediction } from "../types";

// Caps a single run's backlog processing. A result at the cap is a signal
// that pending predictions are piling up (e.g. processor broken for a
// while) rather than "normal" — surfaced via the warning below instead of
// silently fetching an unbounded number of rows.
const PENDING_PREDICTIONS_LIMIT = 500;

interface PendingPredictionRow {
  id: string;
  user_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  wagered_amount: number | null;
  matches: {
    match_date: string;
    home_score: number;
    away_score: number;
  } | null;
}

export async function fetchPendingPredictions(): Promise<PendingPrediction[]> {
  const { data, error } = await supabaseAdmin
    .from("predictions")
    .select(
      "id, user_id, predicted_home_score, predicted_away_score, wagered_amount, matches!inner(match_date, home_score, away_score, status)",
    )
    .is("points_earned", null)
    .eq("matches.status", "finished")
    .limit(PENDING_PREDICTIONS_LIMIT);

  if (error) throw error;

  // PostgREST resolves `matches!inner(...)` as a single embedded object (the
  // prediction's own FK, a many-to-one relation) — the client's TS inference
  // defaults relationships to arrays without a generated Database schema,
  // which doesn't match this actual response shape.
  const rows = (data ?? []) as unknown as PendingPredictionRow[];

  if (rows.length === PENDING_PREDICTIONS_LIMIT) {
    console.warn(
      `fetchPendingPredictions hit the ${PENDING_PREDICTIONS_LIMIT}-row limit — pending prediction backlog may be larger than this run processed`,
    );
  }

  return rows
    .filter(
      (
        row,
      ): row is PendingPredictionRow & {
        matches: NonNullable<PendingPredictionRow["matches"]>;
      } => row.matches !== null,
    )
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      matchDate: row.matches.match_date,
      predictedHomeScore: row.predicted_home_score,
      predictedAwayScore: row.predicted_away_score,
      homeScore: row.matches.home_score,
      awayScore: row.matches.away_score,
      wageredAmount: row.wagered_amount,
    }));
}
