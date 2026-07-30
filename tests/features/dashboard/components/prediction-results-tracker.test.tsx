import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { trackEvent } from "@/lib/analytics/track-event";
import { markPredictionSeen } from "@/lib/analytics/seen-predictions";
import { PredictionResultsTracker } from "@/features/dashboard/components/prediction-results-tracker";
import type { DashboardPrediction } from "@/features/dashboard/types";

vi.mock("@/lib/analytics/track-event", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/seen-predictions", () => ({
  markPredictionSeen: vi.fn(),
}));

const mockTrackEvent = vi.mocked(trackEvent);
const mockMarkPredictionSeen = vi.mocked(markPredictionSeen);

function buildPrediction(
  overrides: Partial<DashboardPrediction>,
): DashboardPrediction {
  return {
    id: "pred-1",
    matchLabel: "Flamengo x Palmeiras",
    predictedScore: "2-1",
    createdAt: "2026-07-30",
    pointsEarned: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("PredictionResultsTracker", () => {
  it("tracks prediction_won for a resolved, unseen winning prediction", () => {
    mockMarkPredictionSeen.mockReturnValue(true);
    const predictions = [buildPrediction({ id: "p1", pointsEarned: 1 })];

    render(<PredictionResultsTracker predictions={predictions} />);

    expect(mockMarkPredictionSeen).toHaveBeenCalledWith("p1");
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith("prediction_won");
  });

  it("tracks prediction_lost for a resolved, unseen losing prediction", () => {
    mockMarkPredictionSeen.mockReturnValue(true);
    const predictions = [buildPrediction({ id: "p2", pointsEarned: 0 })];

    render(<PredictionResultsTracker predictions={predictions} />);

    expect(mockMarkPredictionSeen).toHaveBeenCalledWith("p2");
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith("prediction_lost");
  });

  it("does not mark seen or track anything for an unresolved prediction", () => {
    const predictions = [buildPrediction({ id: "p3", pointsEarned: null })];

    render(<PredictionResultsTracker predictions={predictions} />);

    expect(mockMarkPredictionSeen).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("does not track when the prediction was already seen", () => {
    mockMarkPredictionSeen.mockReturnValue(false);
    const predictions = [buildPrediction({ id: "p4", pointsEarned: 1 })];

    render(<PredictionResultsTracker predictions={predictions} />);

    expect(mockMarkPredictionSeen).toHaveBeenCalledWith("p4");
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("does not fire additional events on re-render once the prediction is seen", () => {
    mockMarkPredictionSeen.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const predictions = [buildPrediction({ id: "p5", pointsEarned: 1 })];

    const { rerender } = render(
      <PredictionResultsTracker predictions={predictions} />,
    );
    rerender(<PredictionResultsTracker predictions={[...predictions]} />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it("renders nothing", () => {
    const predictions = [buildPrediction({ id: "p6", pointsEarned: null })];
    const { container } = render(
      <PredictionResultsTracker predictions={predictions} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
