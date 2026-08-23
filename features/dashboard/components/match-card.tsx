import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DashboardMatch } from "@/features/dashboard/types";

interface MatchCardProps {
  match: DashboardMatch;
}

function formatMatchTime(matchDate: string): string {
  const time = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(matchDate));

  return `${time}`;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <Card background="bg-linear-to-r from-blue-300 to-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{match.competitionName}</Badge>
          <span className="text-sm text-white">
            {formatMatchTime(match.matchDate)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-1">
            <Avatar size="lg">
              <AvatarFallback>{match.homeTeamShort}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{match.homeTeamName}</span>
          </div>
          <span className="text-muted-foreground text-sm">vs</span>
          <div className="flex flex-col items-center gap-1">
            <Avatar size="lg">
              <AvatarFallback>{match.awayTeamShort}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{match.awayTeamName}</span>
          </div>
        </div>
        <Button className="text-primary mt-8 w-full cursor-pointer bg-green-400 hover:bg-green-500/40">
          Palpitar
        </Button>
      </CardContent>
    </Card>
  );
}
