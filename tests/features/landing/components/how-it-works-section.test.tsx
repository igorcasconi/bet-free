import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HowItWorksSection } from "@/features/landing/components/how-it-works-section";

afterEach(() => {
  cleanup();
});

describe("HowItWorksSection", () => {
  it("renders the 3 steps in the correct order", () => {
    const { container } = render(<HowItWorksSection />);

    const step1Index = container.textContent!.indexOf("Palpite grátis");
    const step2Index = container.textContent!.search(/ganhe xp|streak/i);
    const step3Index = container.textContent!.indexOf(
      "Veja o dinheiro preservado"
    );

    expect(step1Index).toBeGreaterThan(-1);
    expect(step2Index).toBeGreaterThan(step1Index);
    expect(step3Index).toBeGreaterThan(step2Index);
  });

  it("renders all 3 step descriptions", () => {
    render(<HowItWorksSection />);

    expect(
      screen.getByText(/palpite grátis em jogos reais/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/xp/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/veja o dinheiro preservado/i)).toBeInTheDocument();
  });
});
