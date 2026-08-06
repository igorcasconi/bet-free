import { cleanup, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BottomNav } from "@/features/navigation/components/bottom-nav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

afterEach(cleanup);

describe("BottomNav", () => {
  it("renders all 5 links", () => {
    vi.mocked(usePathname).mockReturnValue("/home");

    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /início/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /partidas/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /classificação/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /conquistas/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /perfil/i })).toBeInTheDocument();
  });

  it("marks the active route with aria-current and not others", () => {
    vi.mocked(usePathname).mockReturnValue("/matches");

    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /partidas/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /início/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("has mobile-only fixed bottom bar classes", () => {
    vi.mocked(usePathname).mockReturnValue("/home");

    const { container } = render(<BottomNav />);
    const nav = container.querySelector("nav");

    expect(nav?.className).toContain("flex");
    expect(nav?.className).toContain("md:hidden");
    expect(nav?.className).toContain("fixed");
    expect(nav?.className).toContain("bottom-0");
  });
});
