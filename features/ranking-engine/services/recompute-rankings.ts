import { computeAccuracyRanking } from "./compute-accuracy-ranking";
import { computeDisciplineRanking } from "./compute-discipline-ranking";
import { computeMoneySavedRanking } from "./compute-money-saved-ranking";
import { persistRanking } from "./persist-ranking";

export async function recomputeRankings(): Promise<{
  accuracyRanked: number;
  disciplineRanked: number;
  moneySavedRanked: number;
}> {
  const accuracyRanked = await persistRanking(
    "accuracy",
    await computeAccuracyRanking(),
  );
  const disciplineRanked = await persistRanking(
    "discipline",
    await computeDisciplineRanking(),
  );
  const moneySavedRanked = await persistRanking(
    "money_saved",
    await computeMoneySavedRanking(),
  );

  return { accuracyRanked, disciplineRanked, moneySavedRanked };
}
