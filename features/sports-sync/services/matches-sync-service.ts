import {
  DEFAULT_CONCURRENCY_LIMIT,
  mapWithConcurrency,
} from "@/lib/concurrency";
import { sportsProvider } from "@/lib/sports-provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function syncMatches(): Promise<{
  synced: number;
  skipped: number;
}> {
  const [competitionsResult, teamsResult] = await Promise.all([
    supabaseAdmin.from("competitions").select("id, external_id, season"),
    supabaseAdmin.from("teams").select("id, external_id"),
  ]);

  if (competitionsResult.error) throw competitionsResult.error;
  if (teamsResult.error) throw teamsResult.error;

  const competitions = (competitionsResult.data ?? []).filter(
    (
      competition,
    ): competition is typeof competition & { external_id: string } =>
      competition.external_id !== null,
  );

  const teamIdByExternalId = new Map(
    (teamsResult.data ?? [])
      .filter((team) => team.external_id !== null)
      .map((team) => [team.external_id as string, team.id as string]),
  );

  const results = await mapWithConcurrency(
    competitions,
    DEFAULT_CONCURRENCY_LIMIT,
    async (competition) => {
      const matches = await sportsProvider.syncMatches(
        competition.external_id,
        competition.season,
      );

      const rows = [];
      let skipped = 0;

      for (const match of matches) {
        const homeTeamId = teamIdByExternalId.get(match.externalHomeTeamId);
        const awayTeamId = teamIdByExternalId.get(match.externalAwayTeamId);

        if (!homeTeamId || !awayTeamId) {
          console.warn(
            `Skipping match ${match.externalId}: team not yet synced (home=${match.externalHomeTeamId}, away=${match.externalAwayTeamId})`,
          );
          skipped++;
          continue;
        }

        rows.push({
          competition_id: competition.id,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          match_date: match.matchDate,
          round: match.round,
          status: match.status,
          home_score: match.homeScore,
          away_score: match.awayScore,
          external_id: match.externalId,
          external_source: sportsProvider.source,
        });
      }

      if (rows.length === 0) return { synced: 0, skipped };

      const { error: upsertError } = await supabaseAdmin
        .from("matches")
        .upsert(rows, { onConflict: "external_source,external_id" });

      if (upsertError) throw upsertError;

      return { synced: rows.length, skipped };
    },
  );

  return results.reduce(
    (total, result) => ({
      synced: total.synced + result.synced,
      skipped: total.skipped + result.skipped,
    }),
    { synced: 0, skipped: 0 },
  );
}
