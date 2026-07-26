import {
  DEFAULT_CONCURRENCY_LIMIT,
  mapWithConcurrency,
} from "@/lib/concurrency";
import { sportsProvider } from "@/lib/sports-provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function updateOne(match: {
  externalId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .update({
      status: match.status,
      home_score: match.homeScore,
      away_score: match.awayScore,
    })
    .eq("external_source", sportsProvider.source)
    .eq("external_id", match.externalId)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    console.warn(
      `Ignoring live update for match ${match.externalId}: not found locally`,
    );
    return false;
  }

  return true;
}

export async function updateLiveMatches(): Promise<{
  updated: number;
  ignored: number;
}> {
  const matches = await sportsProvider.updateLiveMatches();

  const results = await mapWithConcurrency(
    matches,
    DEFAULT_CONCURRENCY_LIMIT,
    updateOne,
  );

  return {
    updated: results.filter(Boolean).length,
    ignored: results.filter((found) => !found).length,
  };
}
