import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FinalCtaSection } from "@/features/landing/components/final-cta-section";

afterEach(() => {
  cleanup();
});

describe("FinalCtaSection", () => {
  it("renders the CTA link pointing to /login", () => {
    render(<FinalCtaSection />);

    const link = screen.getByRole("link", { name: /acessar a plataforma/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
