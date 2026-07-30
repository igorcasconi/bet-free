import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getAccuracyPercent(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("predictions")
    .select("points_earned")
    .eq("user_id", userId)
    .not("points_earned", "is", null);

  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return 0;

  const correct = rows.filter(
    (row) => (row.points_earned as number) > 0,
  ).length;

  return Math.round((correct / rows.length) * 100);
}
