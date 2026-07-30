import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  DashboardData,
  DashboardMatch,
  DashboardPrediction,
} from "@/features/dashboard/types";
import { XP_THRESHOLD, levelForXp, xpInLevelForXp } from "@/lib/gamification";
import { getAccuracyPercent } from "@/lib/predictions/accuracy";

const LATEST_PREDICTIONS_LIMIT = 5;

const MATCH_SELECT =
  "id, match_date, competitions(name), home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)";

interface MatchRow {
  id: string;
  match_date: string;
  competitions: { name: string } | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
}

interface PredictionRow {
  id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  created_at: string;
  points_earned: number | null;
  matches: {
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
}

function shortNameFor(name: string): string {
  return name.slice(0, 3).toUpperCase();
}

function toDashboardMatch(row: MatchRow): DashboardMatch {
  const homeTeamName = row.home_team?.name ?? "";
  const awayTeamName = row.away_team?.name ?? "";

  return {
    id: row.id,
    competitionName: row.competitions?.name ?? "",
    matchDate: row.match_date,
    homeTeamName,
    homeTeamShort: shortNameFor(homeTeamName),
    awayTeamName,
    awayTeamShort: shortNameFor(awayTeamName),
    hasPrediction: false,
  };
}

function getUtcDayBounds(): { startOfToday: string; endOfToday: string } {
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  return {
    startOfToday: startOfToday.toISOString(),
    endOfToday: endOfToday.toISOString(),
  };
}

async function getTodayAndUpcomingMatches(): Promise<{
  todayMatches: DashboardMatch[];
  upcomingMatches: DashboardMatch[];
}> {
  const { startOfToday, endOfToday } = getUtcDayBounds();

  const [todayResult, upcomingResult] = await Promise.all([
    supabaseAdmin
      .from("matches")
      .select(MATCH_SELECT)
      .gte("match_date", startOfToday)
      .lt("match_date", endOfToday)
      .order("match_date"),
    supabaseAdmin
      .from("matches")
      .select(MATCH_SELECT)
      .gte("match_date", endOfToday)
      .order("match_date"),
  ]);

  if (todayResult.error) throw todayResult.error;
  if (upcomingResult.error) throw upcomingResult.error;

  return {
    todayMatches: ((todayResult.data ?? []) as unknown as MatchRow[]).map(
      toDashboardMatch,
    ),
    upcomingMatches: ((upcomingResult.data ?? []) as unknown as MatchRow[]).map(
      toDashboardMatch,
    ),
  };
}

export async function getLatestPredictions(
  userId: string,
): Promise<DashboardPrediction[]> {
  const { data, error } = await supabaseAdmin
    .from("predictions")
    .select(
      "id, predicted_home_score, predicted_away_score, created_at, points_earned, matches(home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name))",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(LATEST_PREDICTIONS_LIMIT);

  if (error) throw error;

  return ((data ?? []) as unknown as PredictionRow[]).map((row) => ({
    id: row.id,
    matchLabel: `${row.matches?.home_team?.name ?? ""} vs ${row.matches?.away_team?.name ?? ""}`,
    predictedScore: `${row.predicted_home_score}-${row.predicted_away_score}`,
    createdAt: row.created_at,
    pointsEarned: row.points_earned as 0 | 1 | null,
  }));
}

function zeroStats(): DashboardData["stats"] {
  return {
    moneySaved: 0,
    currentStreak: 0,
    level: 1,
    xpInLevel: 0,
    xpToNextLevel: XP_THRESHOLD,
    accuracyPercent: 0,
  };
}

export async function getDashboardData(
  firebaseUid: string | null,
): Promise<DashboardData> {
  const [userResult, { todayMatches, upcomingMatches }] = await Promise.all([
    firebaseUid
      ? supabaseAdmin
          .from("users")
          .select("id, money_saved, current_streak, xp")
          .eq("firebase_uid", firebaseUid)
          .maybeSingle()
      : Promise.resolve(null),
    getTodayAndUpcomingMatches(),
  ]);

  if (userResult?.error) throw userResult.error;

  const user = userResult?.data ?? null;

  if (!user) {
    return {
      stats: zeroStats(),
      todayMatches,
      upcomingMatches,
      latestPredictions: [],
    };
  }

  const [accuracyPercent, latestPredictions] = await Promise.all([
    getAccuracyPercent(user.id),
    getLatestPredictions(user.id),
  ]);

  return {
    stats: {
      moneySaved: Number(user.money_saved),
      currentStreak: user.current_streak,
      level: levelForXp(user.xp),
      xpInLevel: xpInLevelForXp(user.xp),
      xpToNextLevel: XP_THRESHOLD,
      accuracyPercent,
    },
    todayMatches,
    upcomingMatches,
    latestPredictions,
  };
}
