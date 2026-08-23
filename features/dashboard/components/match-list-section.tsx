import Link from "next/link";

import { MatchCard } from "@/features/dashboard/components/match-card";
import type { MatchCardData } from "@/features/matches/types";

interface MatchListSectionProps {
  title: string;
  matches: MatchCardData[];
  emptyMessage: string;
  onPredict: (match: MatchCardData) => void;
}

export function MatchListSection({
  title,
  matches,
  emptyMessage,
  onPredict,
}: MatchListSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link href="/matches" className="text-muted-foreground text-sm">
          Todas as partidas
        </Link>
      </div>
      {matches.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} onPredict={onPredict} />
          ))}
        </div>
      )}
    </section>
  );
}
