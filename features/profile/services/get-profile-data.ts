import { supabaseAdmin } from "@/lib/supabase/admin";
import { getLatestPredictions } from "@/features/dashboard";
import type { ProfileData } from "@/features/profile/types";
import { XP_THRESHOLD, levelForXp, xpInLevelForXp } from "@/lib/gamification";
import { getAccuracyPercent } from "@/lib/predictions/accuracy";
import { getUserAchievements } from "./get-user-achievements";

function zeroProfileData(): ProfileData {
  return {
    identity: { displayName: null, email: null, avatarUrl: null },
    stats: {
      moneySaved: 0,
      currentStreak: 0,
      level: 1,
      xpInLevel: 0,
      xpToNextLevel: XP_THRESHOLD,
      accuracyPercent: 0,
    },
    achievements: [],
    latestPredictions: [],
  };
}

export async function getProfileData(
  firebaseUid: string | null,
): Promise<ProfileData> {
  if (!firebaseUid) return zeroProfileData();

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, display_name, avatar_url, email, money_saved, current_streak, xp",
    )
    .eq("firebase_uid", firebaseUid)
    .maybeSingle();

  if (error) throw error;
  if (!user) return zeroProfileData();

  const [accuracyPercent, achievements, latestPredictions] = await Promise.all([
    getAccuracyPercent(user.id),
    getUserAchievements(user.id),
    getLatestPredictions(user.id),
  ]);

  return {
    identity: {
      displayName: user.display_name,
      email: user.email,
      avatarUrl: user.avatar_url,
    },
    stats: {
      moneySaved: Number(user.money_saved),
      currentStreak: user.current_streak,
      level: levelForXp(user.xp),
      xpInLevel: xpInLevelForXp(user.xp),
      xpToNextLevel: XP_THRESHOLD,
      accuracyPercent,
    },
    achievements,
    latestPredictions,
  };
}
