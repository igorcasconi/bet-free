import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HeroSection } from "@/features/landing/components/hero-section";

afterEach(() => {
  cleanup();
});

describe("HeroSection", () => {
  it("renders the headline", () => {
    render(<HeroSection />);

    expect(
      screen.getByRole("heading", {
        name: /transforme.*impulso de apostar.*previsões/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders a CTA link pointing to /login", () => {
    render(<HeroSection />);

    const cta = screen.getByRole("link", { name: /acessar a plataforma/i });

    expect(cta).toHaveAttribute("href", "/login");
  });

  it("renders the illustration image with a descriptive alt text", () => {
    render(<HeroSection />);

    expect(
      screen.getByAltText(/dinheiro.*poupado|economia|crescendo/i),
    ).toBeInTheDocument();
  });
});
