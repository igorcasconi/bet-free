import { supabaseAdmin } from "@/lib/supabase/admin";

import type { RankedUser } from "../types";

interface UserRow {
  id: string;
  money_saved: number;
}

export async function computeMoneySavedRanking(): Promise<RankedUser[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, money_saved")
    .order("money_saved", { ascending: false })
    .order("id", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as UserRow[]).map((row) => ({
    userId: row.id,
    points: Math.round(Number(row.money_saved) * 100),
  }));
}
