import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ProfileAchievement } from "@/features/profile/types";

interface AchievementRelation {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
}

interface UserAchievementRow {
  earned_at: string;
  achievements: AchievementRelation | null;
}

export async function getUserAchievements(
  userId: string,
): Promise<ProfileAchievement[]> {
  const { data, error } = await supabaseAdmin
    .from("user_achievements")
    .select("earned_at, achievements(id, name, description, icon_url)")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as UserAchievementRow[])
    .filter(
      (
        row,
      ): row is UserAchievementRow & { achievements: AchievementRelation } =>
        row.achievements !== null,
    )
    .map((row) => ({
      id: row.achievements.id,
      name: row.achievements.name,
      description: row.achievements.description,
      iconUrl: row.achievements.icon_url,
      earnedAt: row.earned_at,
    }));
}
