import { supabaseAdmin } from "@/lib/supabase/admin";

import type { RankedUser } from "../types";

const MIN_PROCESSED_PREDICTIONS = 5;

interface PredictionRow {
  user_id: string;
  points_earned: number;
}

interface UserStats {
  total: number;
  correct: number;
}

export async function computeAccuracyRanking(): Promise<RankedUser[]> {
  const { data, error } = await supabaseAdmin
    .from("predictions")
    .select("user_id, points_earned")
    .not("points_earned", "is", null);

  if (error) throw error;

  const rows = (data ?? []) as unknown as PredictionRow[];

  const statsByUser = new Map<string, UserStats>();
  for (const row of rows) {
    const stats = statsByUser.get(row.user_id) ?? { total: 0, correct: 0 };
    stats.total += 1;
    stats.correct += row.points_earned;
    statsByUser.set(row.user_id, stats);
  }

  return Array.from(statsByUser.entries())
    .filter(([, stats]) => stats.total >= MIN_PROCESSED_PREDICTIONS)
    .map(([userId, stats]) => {
      const accuracy = stats.correct / stats.total;
      return { userId, points: Math.round(accuracy * 10_000) };
    })
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId));
}
