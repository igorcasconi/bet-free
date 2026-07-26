import {
  DEFAULT_CONCURRENCY_LIMIT,
  mapWithConcurrency,
} from "@/lib/concurrency";
import { sportsProvider } from "@/lib/sports-provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function syncTeams(): Promise<{ synced: number }> {
  const { data, error } = await supabaseAdmin
    .from("competitions")
    .select("external_id");

  if (error) throw error;

  const externalCompetitionIds = (data ?? [])
    .map((competition) => competition.external_id)
    .filter((externalId): externalId is string => externalId !== null);

  const syncedCounts = await mapWithConcurrency(
    externalCompetitionIds,
    DEFAULT_CONCURRENCY_LIMIT,
    async (externalCompetitionId) => {
      const teams = await sportsProvider.syncTeams(externalCompetitionId);

      if (teams.length === 0) return 0;

      const rows = teams.map((team) => ({
        name: team.name,
        slug: team.slug,
        logo_url: team.logoUrl,
        external_id: team.externalId,
        external_source: sportsProvider.source,
      }));

      const { error: upsertError } = await supabaseAdmin
        .from("teams")
        .upsert(rows, { onConflict: "external_source,external_id" });

      if (upsertError) throw upsertError;

      return rows.length;
    },
  );

  return { synced: syncedCounts.reduce((total, count) => total + count, 0) };
}
