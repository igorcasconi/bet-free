import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { XpProgressCard } from "@/features/dashboard/components/xp-progress-card";

afterEach(() => {
  cleanup();
});

describe("XpProgressCard", () => {
  it("renders xp progress and remaining xp to next level", () => {
    render(<XpProgressCard level={3} xpInLevel={40} xpToNextLevel={100} />);

    expect(screen.getByText("40 / 100")).toBeInTheDocument();
    expect(screen.getByText("60 XP to level 4")).toBeInTheDocument();
  });

  it("renders a progress bar width proportional to xpInLevel / xpToNextLevel", () => {
    render(<XpProgressCard level={3} xpInLevel={40} xpToNextLevel={100} />);

    const fill = screen.getByTestId("xp-progress-bar-fill");
    expect(fill).toHaveStyle({ width: "40%" });
  });

  it("clamps the progress bar width at 100% when xpInLevel exceeds xpToNextLevel", () => {
    render(<XpProgressCard level={3} xpInLevel={150} xpToNextLevel={100} />);

    const fill = screen.getByTestId("xp-progress-bar-fill");
    expect(fill).toHaveStyle({ width: "100%" });
  });
});
