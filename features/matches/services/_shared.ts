import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MatchCardData } from "@/features/matches/types";

// Select string reused by both get-matches-page-data.ts (today + first
// upcoming page) and get-upcoming-matches-page.ts (subsequent pages) —
// keeps the query shape and row-mapping logic in one place.
export const MATCH_SELECT =
  "id, match_date, status, competitions(id, name), home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name), predictions(id, predicted_home_score, predicted_away_score, user_id)";

export interface MatchRow {
  id: string;
  match_date: string;
  status: MatchCardData["status"];
  competitions: { id: string; name: string } | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
  predictions:
    | {
        id: string;
        predicted_home_score: number;
        predicted_away_score: number;
        user_id: string;
      }[]
    | null;
}

function shortNameFor(name: string): string {
  return name ? name.slice(0, 3).toUpperCase() : "";
}

export function toMatchCardData(
  row: MatchRow,
  userId: string | null,
): MatchCardData {
  const homeTeamName = row.home_team?.name ?? "";
  const awayTeamName = row.away_team?.name ?? "";

  const predictionRow = userId
    ? (row.predictions ?? []).find((p) => p.user_id === userId)
    : undefined;

  return {
    id: row.id,
    competitionId: row.competitions?.id ?? "",
    competitionName: row.competitions?.name ?? "",
    matchDate: row.match_date,
    status: row.status,
    homeTeamName,
    homeTeamShort: shortNameFor(homeTeamName),
    awayTeamName,
    awayTeamShort: shortNameFor(awayTeamName),
    prediction: predictionRow
      ? {
          id: predictionRow.id,
          predictedHomeScore: predictionRow.predicted_home_score,
          predictedAwayScore: predictionRow.predicted_away_score,
        }
      : null,
  };
}

// Resolves the Supabase `users.id` (uuid) behind a Firebase uid — predictions
// are keyed by `users.id`, not the Firebase uid itself.
export async function resolveUserId(
  firebaseUid: string | null,
): Promise<string | null> {
  if (!firebaseUid) return null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("firebase_uid", firebaseUid)
    .maybeSingle();

  if (error) throw error;

  return data?.id ?? null;
}
