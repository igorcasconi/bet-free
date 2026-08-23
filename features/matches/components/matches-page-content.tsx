"use client";

import { useReducer, useState } from "react";

import { Button } from "@/components/ui/button";
import { MatchGroupSection } from "@/features/matches/components/match-group-section";
import { PredictDialog } from "@/features/matches/components/predict-dialog";
import { useUpcomingMatches } from "@/features/matches/hooks/use-upcoming-matches";
import type {
  MatchCardData,
  MatchGroup,
  UpcomingMatchesPage,
} from "@/features/matches/types";
import { useRouter } from "next/navigation";

// SPEC_DEVIATION: design.md's MatchesPageContent interface only listed
// `todayGroups`, but `useUpcomingMatches` requires an explicit initial page
// (per its own design.md interface). Added `upcomingPage` so the hydrated
// first page can reach the hook — there's no other way for it to get there.
interface MatchesPageContentProps {
  todayGroups: MatchGroup[];
  upcomingPage: UpcomingMatchesPage;
}

export function MatchesPageContent({
  todayGroups,
  upcomingPage,
}: MatchesPageContentProps) {
  const [selectedMatch, setSelectedMatch] = useState<MatchCardData | null>(
    null,
  );
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useUpcomingMatches(upcomingPage);

  const upcomingGroups = data?.pages.flatMap((page) => page.groups) ?? [];

  console.log(selectedMatch, "<<<");

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Hoje</h1>
        {todayGroups.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma partida hoje.</p>
        ) : (
          todayGroups.map((group) => (
            <MatchGroupSection
              key={group.competitionId}
              group={group}
              onPredict={setSelectedMatch}
            />
          ))
        )}
      </section>
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Próximos</h1>
        {upcomingGroups.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma partida futura.
          </p>
        ) : (
          upcomingGroups.map((group) => (
            <MatchGroupSection
              key={group.competitionId}
              group={group}
              onPredict={setSelectedMatch}
            />
          ))
        )}
        {hasNextPage && (
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            Carregar mais
          </Button>
        )}
      </section>
      <PredictDialog
        match={selectedMatch}
        open={selectedMatch !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMatch(null);
        }}
      />
    </div>
  );
}
