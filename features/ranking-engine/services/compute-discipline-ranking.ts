import { supabaseAdmin } from "@/lib/supabase/admin";

import type { RankedUser } from "../types";

interface UserRow {
  id: string;
  current_streak: number;
}

export async function computeDisciplineRanking(): Promise<RankedUser[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, current_streak")
    .order("current_streak", { ascending: false })
    .order("id", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as UserRow[]).map((row) => ({
    userId: row.id,
    points: row.current_streak,
  }));
}
