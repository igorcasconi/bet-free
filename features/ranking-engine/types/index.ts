export interface RankedUser {
  userId: string;
  points: number;
}

export type RankingType = "accuracy" | "discipline" | "money_saved";
