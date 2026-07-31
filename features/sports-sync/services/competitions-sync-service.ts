import { sportsProviders } from "@/lib/sports-provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function syncCompetitions(): Promise<{ synced: number }> {
  const rows = await Promise.all(
    sportsProviders.map(async (provider) => {
      const competitions = await provider.syncCompetitions();

      return competitions.map((competition) => ({
        name: competition.name,
        slug: competition.slug,
        season: competition.season,
        logo_url: competition.logoUrl,
        external_id: competition.externalId,
        external_source: provider.source,
      }));
    }),
  ).then((rowsPerProvider) => rowsPerProvider.flat());

  if (rows.length === 0) {
    return { synced: 0 };
  }

  const { error } = await supabaseAdmin
    .from("competitions")
    .upsert(rows, { onConflict: "external_source,external_id" });

  if (error) throw error;

  return { synced: rows.length };
}
