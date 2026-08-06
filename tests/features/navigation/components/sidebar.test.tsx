import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";

import { Sidebar } from "@/features/navigation/components/sidebar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const mockUsePathname = vi.mocked(usePathname);

afterEach(() => {
  cleanup();
});

describe("Sidebar", () => {
  it("renders all 5 nav links", () => {
    mockUsePathname.mockReturnValue("/home");
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /início/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /partidas/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /classificação/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /conquistas/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /perfil/i })).toBeInTheDocument();
  });

  it("marks the link matching the current pathname as active", () => {
    mockUsePathname.mockReturnValue("/home");
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /início/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /partidas/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks a different link as active when pathname changes", () => {
    mockUsePathname.mockReturnValue("/matches");
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /partidas/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /início/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders a container hidden on mobile and flex on desktop", () => {
    mockUsePathname.mockReturnValue("/home");
    const { container } = render(<Sidebar />);

    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("hidden");
    expect(nav?.className).toContain("md:flex");
  });
});
