import {
  DEFAULT_CONCURRENCY_LIMIT,
  mapWithConcurrency,
} from "@/lib/concurrency";
import { sportsProviders } from "@/lib/sports-provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function syncTeams(): Promise<{ synced: number }> {
  const { data, error } = await supabaseAdmin
    .from("competitions")
    .select("external_id, external_source");

  if (error) throw error;

  const competitions = (data ?? []).filter(
    (
      competition,
    ): competition is typeof competition & { external_id: string } =>
      competition.external_id !== null,
  );

  const providerBySource = new Map(sportsProviders.map((p) => [p.source, p]));

  const syncedCounts = await mapWithConcurrency(
    competitions,
    DEFAULT_CONCURRENCY_LIMIT,
    async (competition) => {
      const provider = providerBySource.get(competition.external_source);

      if (!provider) {
        console.warn(
          `No provider found for external_source "${competition.external_source}"`,
        );
        return 0;
      }

      const teams = await provider.syncTeams(competition.external_id);

      if (teams.length === 0) return 0;

      const rows = teams.map((team) => ({
        name: team.name,
        slug: team.slug,
        logo_url: team.logoUrl,
        external_id: team.externalId,
        external_source: provider.source,
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
