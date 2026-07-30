import { supabaseAdmin } from "@/lib/supabase/admin";

export interface UpsertPredictionInput {
  userId: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
}

export type UpsertPredictionResult =
  { ok: true } | { ok: false; error: string };

export async function upsertPrediction(
  input: UpsertPredictionInput,
): Promise<UpsertPredictionResult> {
  const { data: match, error: matchError } = await supabaseAdmin
    .from("matches")
    .select("status")
    .eq("id", input.matchId)
    .maybeSingle();

  if (matchError) throw matchError;

  if (!match || match.status !== "scheduled") {
    return { ok: false, error: "match already started" };
  }

  const { error } = await supabaseAdmin.from("predictions").upsert(
    {
      user_id: input.userId,
      match_id: input.matchId,
      predicted_home_score: input.predictedHomeScore,
      predicted_away_score: input.predictedAwayScore,
    },
    { onConflict: "user_id,match_id" },
  );

  if (error) {
    console.error("[upsertPrediction] supabase upsert error", error);
    return { ok: false, error: "Não foi possível salvar o palpite." };
  }

  return { ok: true };
}
