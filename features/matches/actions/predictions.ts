"use server";

import { z } from "zod";

import { resolveUserId } from "@/features/matches/services/_shared";
import {
  upsertPrediction,
  type UpsertPredictionResult,
} from "@/features/matches/services/upsert-prediction";
import { getCurrentFirebaseUid } from "@/lib/auth/get-current-user";

const MAX_SCORE = 99;

const submitPredictionSchema = z.object({
  matchId: z.string().uuid(),
  predictedHomeScore: z.number().int().min(0).max(MAX_SCORE),
  predictedAwayScore: z.number().int().min(0).max(MAX_SCORE),
  wageredAmount: z.number().positive().optional(),
});

export type SubmitPredictionInput = z.infer<typeof submitPredictionSchema>;

export async function submitPrediction(
  input: SubmitPredictionInput,
): Promise<UpsertPredictionResult> {
  const parsed = submitPredictionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "entrada inválida" };
  }

  const firebaseUid = await getCurrentFirebaseUid();
  if (!firebaseUid) {
    return { ok: false, error: "não autenticado" };
  }

  const userId = await resolveUserId(firebaseUid);
  if (!userId) {
    return { ok: false, error: "não autenticado" };
  }

  return upsertPrediction({
    userId,
    matchId: parsed.data.matchId,
    predictedHomeScore: parsed.data.predictedHomeScore,
    predictedAwayScore: parsed.data.predictedAwayScore,
    wageredAmount: parsed.data.wageredAmount,
  });
}
