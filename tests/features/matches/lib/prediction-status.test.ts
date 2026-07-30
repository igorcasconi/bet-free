import { describe, expect, it } from "vitest";

import { predictionStatusFor } from "@/features/matches/lib/prediction-status";
import type { MatchCardData } from "@/features/matches/types";

function match(overrides: Partial<MatchCardData>): MatchCardData {
  return {
    id: "match-1",
    competitionId: "comp-1",
    competitionName: "Competition 1",
    matchDate: "2026-07-29T15:00:00.000Z",
    status: "scheduled",
    homeTeamName: "Home",
    homeTeamShort: "HOM",
    awayTeamName: "Away",
    awayTeamShort: "AWY",
    prediction: null,
    ...overrides,
  };
}

const prediction = {
  id: "pred-1",
  predictedHomeScore: 1,
  predictedAwayScore: 0,
};

describe("predictionStatusFor", () => {
  it("returns 'no-prediction' for a scheduled match without a prediction", () => {
    expect(
      predictionStatusFor(match({ status: "scheduled", prediction: null })),
    ).toBe("no-prediction");
  });

  it("returns 'predicted' for a scheduled match with a prediction", () => {
    expect(
      predictionStatusFor(match({ status: "scheduled", prediction })),
    ).toBe("predicted");
  });

  it("returns 'locked' for a live match regardless of prediction", () => {
    expect(predictionStatusFor(match({ status: "live", prediction }))).toBe(
      "locked",
    );
  });

  it("returns 'locked' for a finished match regardless of prediction", () => {
    expect(
      predictionStatusFor(match({ status: "finished", prediction: null })),
    ).toBe("locked");
  });

  it("returns 'locked' for a postponed or cancelled match", () => {
    expect(
      predictionStatusFor(match({ status: "postponed", prediction: null })),
    ).toBe("locked");
    expect(
      predictionStatusFor(match({ status: "cancelled", prediction: null })),
    ).toBe("locked");
  });
});
