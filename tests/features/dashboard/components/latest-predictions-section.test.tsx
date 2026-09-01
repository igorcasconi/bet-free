import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LatestPredictionsSection } from "@/features/dashboard/components/latest-predictions-section";
import type { DashboardPrediction } from "@/features/dashboard/types";

afterEach(() => {
  cleanup();
});

describe("LatestPredictionsSection", () => {
  it("renders an empty state without erroring when there are no predictions", () => {
    render(<LatestPredictionsSection predictions={[]} />);

    expect(screen.getByText(/nenhum palpite ainda/i)).toBeInTheDocument();
  });

  it("renders each prediction when the list has items", () => {
    const predictions: DashboardPrediction[] = [
      {
        id: "1",
        matchLabel: "Flamengo vs Palmeiras",
        predictedScore: "2-1",
        createdAt: "2026-07-20T15:00:00.000Z", // 12:00 in America/Sao_Paulo (UTC-3)
        pointsEarned: null,
      },
      {
        id: "2",
        matchLabel: "Corinthians vs Santos",
        predictedScore: "0-0",
        createdAt: "2026-07-21T18:30:00.000Z", // 15:30 in America/Sao_Paulo (UTC-3)
        pointsEarned: null,
      },
    ];

    render(<LatestPredictionsSection predictions={predictions} />);

    expect(screen.getByText("Flamengo vs Palmeiras")).toBeInTheDocument();
    expect(screen.getByText("2-1")).toBeInTheDocument();
    expect(screen.getByText("20/07/2026, 12:00")).toBeInTheDocument();

    expect(screen.getByText("Corinthians vs Santos")).toBeInTheDocument();
    expect(screen.getByText("0-0")).toBeInTheDocument();
    expect(screen.getByText("21/07/2026, 15:30")).toBeInTheDocument();
  });
});
