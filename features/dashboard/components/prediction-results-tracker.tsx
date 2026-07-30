"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics/track-event";
import { markPredictionSeen } from "@/lib/analytics/seen-predictions";
import type { DashboardPrediction } from "../types";

interface PredictionResultsTrackerProps {
  predictions: DashboardPrediction[];
}

export function PredictionResultsTracker({
  predictions,
}: PredictionResultsTrackerProps) {
  useEffect(() => {
    predictions.forEach(({ id, pointsEarned }) => {
      if (pointsEarned === null) return;
      if (!markPredictionSeen(id)) return;

      trackEvent(pointsEarned === 1 ? "prediction_won" : "prediction_lost");
    });
  }, [predictions]);

  return null;
}
