import { getBrazilDayBounds } from "@/features/matches/lib/get-brazil-day-bounds";
import { groupByCompetition } from "@/features/matches/lib/group-by-competition";
import {
  MATCH_SELECT,
  resolveUserId,
  toMatchCardData,
  type MatchRow,
} from "@/features/matches/services/_shared";
import type { UpcomingMatchesPage } from "@/features/matches/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface GetUpcomingMatchesPageParams {
  firebaseUid: string | null;
  cursor: { matchDate: string; id: string } | null;
  limit: number;
}

export async function getUpcomingMatchesPage({
  firebaseUid,
  cursor,
  limit,
}: GetUpcomingMatchesPageParams): Promise<UpcomingMatchesPage> {
  const { endOfToday } = getBrazilDayBounds();

  let query = supabaseAdmin
    .from("matches")
    .select(MATCH_SELECT)
    .gte("match_date", endOfToday)
    .order("match_date")
    .order("id")
    // Fetch one extra row to detect whether a further page exists.
    .limit(limit + 1);

  if (cursor) {
    query = query.or(
      `match_date.gt.${cursor.matchDate},and(match_date.eq.${cursor.matchDate},id.gt.${cursor.id})`,
    );
  }

  const [{ data, error }, userId] = await Promise.all([
    query,
    resolveUserId(firebaseUid),
  ]);

  if (error) throw error;

  const rows = (data ?? []) as unknown as MatchRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const matches = pageRows.map((row) => toMatchCardData(row, userId));
  const lastRow = pageRows[pageRows.length - 1];

  return {
    groups: groupByCompetition(matches),
    nextCursor:
      hasMore && lastRow
        ? { matchDate: lastRow.match_date, id: lastRow.id }
        : null,
  };
}
