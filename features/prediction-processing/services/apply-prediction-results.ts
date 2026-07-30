import { getBrazilCalendarDay } from "@/lib/brazil-time";
import { levelForXp } from "@/lib/gamification";

import { isWinningPrediction } from "../lib/evaluate-outcome";
import type { PendingPrediction, UserGamificationState } from "../types";

const MONEY_SAVED_FALLBACK = 10;
const WIN_XP = 100;

// Fallback applied when a prediction has no wagered_amount — mirrors the
// interview decision that this is an in-memory business rule, not a DB
// default (see design.md).
export function applyPredictionResults(
  user: UserGamificationState,
  predictions: PendingPrediction[],
): {
  userUpdate: UserGamificationState;
  predictionResults: { id: string; pointsEarned: 0 | 1 }[];
} {
  // `predictions` is assumed to already be sorted chronologically by the
  // caller (ascending match_date) — this function does not re-sort.
  let xpDelta = 0;
  let moneyDelta = 0;
  let streak = user.currentStreak;
  let runningLastStreakDate = user.lastStreakDate;

  const predictionResults = predictions.map((prediction) => {
    const isWin = isWinningPrediction(
      {
        home: prediction.predictedHomeScore,
        away: prediction.predictedAwayScore,
      },
      { home: prediction.homeScore, away: prediction.awayScore },
    );
    const pointsEarned: 0 | 1 = isWin ? 1 : 0;

    xpDelta += isWin ? WIN_XP : 0;
    moneyDelta += prediction.wageredAmount ?? MONEY_SAVED_FALLBACK;

    const day = getBrazilCalendarDay(new Date(prediction.matchDate));
    if (day !== runningLastStreakDate) {
      streak += 1;
      runningLastStreakDate = day;
    }

    return { id: prediction.id, pointsEarned };
  });

  const newXp = user.xp + xpDelta;

  return {
    userUpdate: {
      xp: newXp,
      level: levelForXp(newXp),
      moneySaved: user.moneySaved + moneyDelta,
      currentStreak: streak,
      lastStreakDate: runningLastStreakDate,
    },
    predictionResults,
  };
}
