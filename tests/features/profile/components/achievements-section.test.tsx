import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AchievementsSection } from "@/features/profile/components/achievements-section";
import type { ProfileAchievement } from "@/features/profile/types";

afterEach(() => {
  cleanup();
});

function achievement(
  overrides: Partial<ProfileAchievement> = {},
): ProfileAchievement {
  return {
    id: "ach-1",
    name: "Primeira previsão",
    description: "Fez a primeira previsão",
    iconUrl: null,
    earnedAt: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("AchievementsSection", () => {
  it("renders the empty-state message when there are no achievements", () => {
    render(<AchievementsSection achievements={[]} />);

    expect(screen.getByText("Nenhuma conquista ainda")).toBeInTheDocument();
  });

  it("renders name and description when there is one achievement", () => {
    render(<AchievementsSection achievements={[achievement()]} />);

    expect(screen.getByText("Primeira previsão")).toBeInTheDocument();
    expect(screen.getByText("Fez a primeira previsão")).toBeInTheDocument();
  });

  it("renders all achievements when there are multiple", () => {
    const achievements = [
      achievement({ id: "ach-1", name: "Primeira previsão" }),
      achievement({ id: "ach-2", name: "Sequência de 5" }),
    ];

    render(<AchievementsSection achievements={achievements} />);

    expect(screen.getByText("Primeira previsão")).toBeInTheDocument();
    expect(screen.getByText("Sequência de 5")).toBeInTheDocument();
  });

  it("does not crash and omits the description line when description is null", () => {
    render(
      <AchievementsSection
        achievements={[achievement({ description: null })]}
      />,
    );

    expect(screen.getByText("Primeira previsão")).toBeInTheDocument();
    expect(
      screen.queryByText("Fez a primeira previsão"),
    ).not.toBeInTheDocument();
  });
});
