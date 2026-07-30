import {
  DEFAULT_CONCURRENCY_LIMIT,
  mapWithConcurrency,
} from "@/lib/concurrency";
import { levelForXp } from "@/lib/gamification";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { applyPredictionResults } from "./apply-prediction-results";
import { fetchPendingPredictions } from "./fetch-pending-predictions";
import type { PendingPrediction, UserGamificationState } from "../types";

interface UserRow {
  id: string;
  xp: number;
  money_saved: number;
  current_streak: number;
  last_streak_date: string | null;
}

interface UserGroupResult {
  predictionsWritten: number;
}

function groupByUserSortedByMatchDate(
  predictions: PendingPrediction[],
): Map<string, PendingPrediction[]> {
  const groups = new Map<string, PendingPrediction[]>();

  for (const prediction of predictions) {
    const existing = groups.get(prediction.userId);
    if (existing) {
      existing.push(prediction);
    } else {
      groups.set(prediction.userId, [prediction]);
    }
  }

  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
    );
  }

  return groups;
}

async function fetchUserState(userId: string): Promise<UserGamificationState> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, xp, money_saved, current_streak, last_streak_date")
    .eq("id", userId)
    .single();

  if (error) throw error;

  const row = data as UserRow;

  return {
    xp: row.xp,
    level: levelForXp(row.xp),
    moneySaved: row.money_saved,
    currentStreak: row.current_streak,
    lastStreakDate: row.last_streak_date,
  };
}

async function persistUserUpdate(
  userId: string,
  userUpdate: UserGamificationState,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("users")
    .update({
      xp: userUpdate.xp,
      level: userUpdate.level,
      money_saved: userUpdate.moneySaved,
      current_streak: userUpdate.currentStreak,
      last_streak_date: userUpdate.lastStreakDate,
    })
    .eq("id", userId);

  if (error) throw error;
}

async function persistPredictionResults(
  predictionResults: { id: string; pointsEarned: 0 | 1 }[],
): Promise<void> {
  for (const { id, pointsEarned } of predictionResults) {
    const { error } = await supabaseAdmin
      .from("predictions")
      .update({ points_earned: pointsEarned })
      .eq("id", id);

    if (error) throw error;
  }
}

async function processUserGroup(
  userId: string,
  predictions: PendingPrediction[],
): Promise<UserGroupResult | null> {
  try {
    const userState = await fetchUserState(userId);
    const { userUpdate, predictionResults } = applyPredictionResults(
      userState,
      predictions,
    );

    await persistUserUpdate(userId, userUpdate);
    await persistPredictionResults(predictionResults);

    return { predictionsWritten: predictionResults.length };
  } catch (error) {
    console.error(
      `processPendingPredictions: failed to process userId=${userId}`,
      error,
    );
    return null;
  }
}

export async function processPendingPredictions(): Promise<{
  usersUpdated: number;
  predictionsProcessed: number;
}> {
  const predictions = await fetchPendingPredictions();
  const groups = groupByUserSortedByMatchDate(predictions);

  const results = await mapWithConcurrency(
    [...groups.entries()],
    DEFAULT_CONCURRENCY_LIMIT,
    ([userId, userPredictions]) => processUserGroup(userId, userPredictions),
  );

  const succeeded = results.filter(
    (result): result is UserGroupResult => result !== null,
  );

  return {
    usersUpdated: succeeded.length,
    predictionsProcessed: succeeded.reduce(
      (total, result) => total + result.predictionsWritten,
      0,
    ),
  };
}
