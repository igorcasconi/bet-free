import { describe, expect, it } from "vitest";

import {
  isWinningPrediction,
  matchOutcome,
} from "@/features/prediction-processing/lib/evaluate-outcome";

describe("matchOutcome", () => {
  it("returns 'home' when home score is greater", () => {
    expect(matchOutcome(2, 1)).toBe("home");
  });

  it("returns 'away' when away score is greater", () => {
    expect(matchOutcome(0, 3)).toBe("away");
  });

  it("returns 'draw' when scores are equal", () => {
    expect(matchOutcome(1, 1)).toBe("draw");
  });
});

describe("isWinningPrediction", () => {
  it("wins when home win predicted and actual", () => {
    expect(
      isWinningPrediction({ home: 2, away: 0 }, { home: 3, away: 1 }),
    ).toBe(true);
  });

  it("wins when draw predicted and actual", () => {
    expect(
      isWinningPrediction({ home: 1, away: 1 }, { home: 2, away: 2 }),
    ).toBe(true);
  });

  it("wins when away win predicted and actual", () => {
    expect(
      isWinningPrediction({ home: 0, away: 2 }, { home: 1, away: 3 }),
    ).toBe(true);
  });

  it("loses when home win predicted but draw actual", () => {
    expect(
      isWinningPrediction({ home: 2, away: 0 }, { home: 1, away: 1 }),
    ).toBe(false);
  });

  it("loses when draw predicted but away win actual", () => {
    expect(
      isWinningPrediction({ home: 1, away: 1 }, { home: 0, away: 2 }),
    ).toBe(false);
  });

  it("loses when away win predicted but home win actual", () => {
    expect(
      isWinningPrediction({ home: 0, away: 2 }, { home: 3, away: 0 }),
    ).toBe(false);
  });
});
