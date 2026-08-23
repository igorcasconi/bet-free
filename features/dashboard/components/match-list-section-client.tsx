"use client";

import { useState } from "react";

import { MatchListSection } from "@/features/dashboard/components/match-list-section";
// SPEC_DEVIATION: imports from internal matches paths instead of the
// `@/features/matches` barrel, same reason as T3 (features/dashboard/components/match-card.tsx):
// the barrel re-exports services/_shared.ts, which pulls in a server-only env
// var via lib/supabase/admin.ts that throws when imported client-side in jsdom.
import { PredictDialog } from "@/features/matches/components/predict-dialog";
import type { MatchCardData } from "@/features/matches/types";

interface MatchListSectionClientProps {
  todayMatches: MatchCardData[];
  upcomingMatches: MatchCardData[];
}

export function MatchListSectionClient({
  todayMatches,
  upcomingMatches,
}: MatchListSectionClientProps) {
  const [selectedMatch, setSelectedMatch] = useState<MatchCardData | null>(
    null,
  );

  return (
    <>
      <MatchListSection
        title="Partidas de Hoje"
        matches={todayMatches}
        emptyMessage="Nenhuma partida hoje"
        onPredict={setSelectedMatch}
      />
      <MatchListSection
        title="Próximas Partidas"
        matches={upcomingMatches}
        emptyMessage="Nenhuma partida futura"
        onPredict={setSelectedMatch}
      />
      <PredictDialog
        match={selectedMatch}
        open={selectedMatch !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMatch(null);
        }}
      />
    </>
  );
}
