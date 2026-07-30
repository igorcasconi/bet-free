import type { MatchCardData } from "@/features/matches/types";

export type PredictionStatus = "no-prediction" | "predicted" | "locked";

export function predictionStatusFor(match: MatchCardData): PredictionStatus {
  if (match.status !== "scheduled") return "locked";

  return match.prediction === null ? "no-prediction" : "predicted";
}
