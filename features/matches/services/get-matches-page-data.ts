import { getBrazilDayBounds } from "@/features/matches/lib/get-brazil-day-bounds";
import { groupByCompetition } from "@/features/matches/lib/group-by-competition";
import { getUpcomingMatchesPage } from "@/features/matches/services/get-upcoming-matches-page";
import {
  MATCH_SELECT,
  resolveUserId,
  toMatchCardData,
  type MatchRow,
} from "@/features/matches/services/_shared";
import type { MatchGroup, UpcomingMatchesPage } from "@/features/matches/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const UPCOMING_PAGE_SIZE = 10;

export async function getMatchesPageData(
  firebaseUid: string | null,
): Promise<{ todayGroups: MatchGroup[]; upcomingPage: UpcomingMatchesPage }> {
  const { startOfToday, endOfToday } = getBrazilDayBounds();

  const [{ data, error }, userId, upcomingPage] = await Promise.all([
    supabaseAdmin
      .from("matches")
      .select(MATCH_SELECT)
      .gte("match_date", startOfToday)
      .lt("match_date", endOfToday)
      .order("match_date")
      .order("id"),
    resolveUserId(firebaseUid),
    getUpcomingMatchesPage({
      firebaseUid,
      cursor: null,
      limit: UPCOMING_PAGE_SIZE,
    }),
  ]);

  if (error) throw error;

  const todayMatches = ((data ?? []) as unknown as MatchRow[]).map((row) =>
    toMatchCardData(row, userId),
  );

  return {
    todayGroups: groupByCompetition(todayMatches),
    upcomingPage,
  };
}
