import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MoneyPreservedCard } from "@/features/dashboard/components/money-preserved-card";

afterEach(() => {
  cleanup();
});

describe("MoneyPreservedCard", () => {
  it("renders formatted BRL amount for a positive value", () => {
    render(<MoneyPreservedCard amount={4380} />);

    expect(screen.getByText("R$ 4.380,00")).toBeInTheDocument();
  });

  it("renders formatted BRL amount for zero without error", () => {
    render(<MoneyPreservedCard amount={0} />);

    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("renders the 'Money Preserved' badge", () => {
    render(<MoneyPreservedCard amount={100} />);

    expect(screen.getByText("Money Preserved")).toBeInTheDocument();
  });
});
