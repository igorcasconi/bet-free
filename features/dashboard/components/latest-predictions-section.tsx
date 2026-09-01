import { Card } from "@/components/ui/card";
import type { DashboardPrediction } from "@/features/dashboard/types";

interface LatestPredictionsSectionProps {
  predictions: DashboardPrediction[];
}

function formatCreatedAt(createdAt: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(createdAt));
}

export function LatestPredictionsSection({
  predictions,
}: LatestPredictionsSectionProps) {
  if (predictions.length === 0) {
    return (
      <Card className="text-muted-foreground items-center justify-center px-6 py-8 text-center">
        Nenhum palpite ainda
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {predictions.map((prediction) => (
        <Card
          key={prediction.id}
          className="flex-row items-center justify-between px-6 py-4"
        >
          <div>
            <p className="font-medium">{prediction.matchLabel}</p>
            <p className="text-muted-foreground text-sm">
              {formatCreatedAt(prediction.createdAt)}
            </p>
          </div>
          <p className="font-semibold">{prediction.predictedScore}</p>
        </Card>
      ))}
    </div>
  );
}
