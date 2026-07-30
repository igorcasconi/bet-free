import { supabaseAdmin } from "@/lib/supabase/admin";

import type { RankedUser, RankingType } from "../types";

export async function persistRanking(
  rankingType: RankingType,
  rankedUsers: RankedUser[],
): Promise<number> {
  const { error: deleteError } = await supabaseAdmin
    .from("ranking_cache")
    .delete()
    .eq("ranking_type", rankingType)
    .is("competition_id", null);

  if (deleteError) throw deleteError;

  if (rankedUsers.length === 0) return 0;

  const rows = rankedUsers.map((user, index) => ({
    user_id: user.userId,
    competition_id: null,
    ranking_type: rankingType,
    points: user.points,
    position: index + 1,
  }));

  const { error: insertError } = await supabaseAdmin
    .from("ranking_cache")
    .insert(rows);

  if (insertError) throw insertError;

  return rankedUsers.length;
}
