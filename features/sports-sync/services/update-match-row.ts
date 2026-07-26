import { sportsProvider } from "@/lib/sports-provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface MatchStatusUpdate {
  externalId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}

export async function updateMatchRow(
  match: MatchStatusUpdate,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .update({
      status: match.status,
      home_score: match.homeScore,
      away_score: match.awayScore,
    })
    .eq("external_source", sportsProvider.source)
    .eq("external_id", match.externalId)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    console.warn(
      `Ignoring live update for match ${match.externalId}: not found locally`,
    );
    return false;
  }

  return true;
}
