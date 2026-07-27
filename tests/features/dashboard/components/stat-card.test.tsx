import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Flame } from "lucide-react";

import { StatCard } from "@/features/dashboard/components/stat-card";

afterEach(() => {
  cleanup();
});

describe("StatCard", () => {
  it("renders icon, value, and label according to props", () => {
    const { container } = render(
      <StatCard
        icon={Flame}
        iconClassName="bg-amber-100 text-amber-600"
        value="12"
        label="Streak"
      />,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Streak")).toBeInTheDocument();

    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon?.parentElement?.className).toContain("bg-amber-100");
    expect(icon?.parentElement?.className).toContain("text-amber-600");
  });
});
