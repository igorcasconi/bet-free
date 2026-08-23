import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { predictionStatusFor } from "@/features/matches/lib/prediction-status";
import type { MatchCardData } from "@/features/matches/types";

interface MatchCardProps {
  match: MatchCardData;
  onPredict: (match: MatchCardData) => void;
}

const STATUS_BADGE: Record<
  MatchCardData["status"],
  { variant: "outline" | "destructive" | "secondary" | "ghost"; label: string }
> = {
  scheduled: { variant: "outline", label: "Agendado" },
  live: { variant: "destructive", label: "Ao vivo" },
  finished: { variant: "secondary", label: "Encerrado" },
  postponed: { variant: "ghost", label: "Adiado" },
  cancelled: { variant: "ghost", label: "Cancelado" },
};

const PREDICTION_BADGE_LABEL: Record<"no-prediction" | "predicted", string> = {
  "no-prediction": "Sem palpite",
  predicted: "Palpite feito",
};

function formatKickoffTime(matchDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(matchDate));
}

export function MatchCard({ match, onPredict }: MatchCardProps) {
  const predictionStatus = predictionStatusFor(match);
  const statusBadge = STATUS_BADGE[match.status];
  const isPredicted = predictionStatus === "predicted";
  const ctaLabel = isPredicted ? "Editar palpite" : "Palpitar";

  return (
    <Card background="bg-linear-to-r from-blue-300 to-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{match.competitionName}</Badge>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white">
              {formatKickoffTime(match.matchDate)}
            </span>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <Avatar size="lg">
                <AvatarFallback>{match.homeTeamShort}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{match.homeTeamName}</span>
            </div>
            {match.prediction !== null && (
              <div className="ml-16">
                <span className="text-xl text-white">
                  {match.prediction?.predictedHomeScore}
                </span>
              </div>
            )}
          </div>
          <span className="text-sm text-black">vs</span>
          <div className="flex items-center">
            {match.prediction !== null && (
              <div className="mr-16">
                <span className="text-xl text-white">
                  {match.prediction?.predictedAwayScore}
                </span>
              </div>
            )}
            <div className="flex flex-col items-center gap-1">
              <Avatar size="lg">
                <AvatarFallback>{match.awayTeamShort}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{match.awayTeamName}</span>
            </div>
          </div>
        </div>
        {predictionStatus !== "locked" && (
          <Badge
            variant="outline"
            className={`self-start ${isPredicted ? "bg-green-400" : "bg-amber-200"}`}
          >
            {PREDICTION_BADGE_LABEL[predictionStatus]}
          </Badge>
        )}
        <Button
          className="text-primary w-full cursor-pointer bg-green-400 hover:bg-green-500/40"
          disabled={predictionStatus === "locked"}
          onClick={() => onPredict(match)}
        >
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
